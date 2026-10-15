import { describe, it, expect } from 'vitest'
import { regrouperParProduit } from '@/lib/achats'

const ligne = (produit_id, quantite, confirmee_le, extra = {}) => ({
  id: `${produit_id}-${quantite}-${confirmee_le}`, produit_id, nom: `Produit ${produit_id}`,
  categorie: 'Vêtements', images: [], prix_achat: 1000, quantite, confirmee_le, ...extra,
})

describe('Regroupement des lignes à acheter', () => {
  it('une liste vide donne une liste vide', () => {
    expect(regrouperParProduit([])).toEqual([])
    expect(regrouperParProduit()).toEqual([])
  })

  it('regroupe par produit et additionne les quantités', () => {
    const groupes = regrouperParProduit([
      ligne('robe', 2, '2026-09-01T10:00:00Z'),
      ligne('sac', 1, '2026-09-02T10:00:00Z'),
      ligne('robe', 5, '2026-09-03T10:00:00Z'),
    ])
    expect(groupes).toHaveLength(2)
    const robe = groupes.find((g) => g.produit_id === 'robe')
    expect(robe.total).toBe(7)
    expect(robe.lignes).toHaveLength(2)
    expect(robe.nom).toBe('Produit robe')
    expect(robe.prix_achat).toBe(1000)
  })

  it('retient la confirmation la plus ancienne du groupe', () => {
    const [robe] = regrouperParProduit([
      ligne('robe', 1, '2026-09-05T10:00:00Z'),
      ligne('robe', 1, '2026-09-01T10:00:00Z'),
      ligne('robe', 1, '2026-09-03T10:00:00Z'),
    ])
    expect(robe.plusAncienne).toBe('2026-09-01T10:00:00Z')
  })

  it('trie le plus ancien d’abord quand rien n’est relancé', () => {
    const groupes = regrouperParProduit([
      ligne('recent', 1, '2026-09-10T10:00:00Z'),
      ligne('vieux', 1, '2026-09-01T10:00:00Z'),
      ligne('milieu', 1, '2026-09-05T10:00:00Z'),
    ])
    expect(groupes.map((g) => g.produit_id)).toEqual(['vieux', 'milieu', 'recent'])
  })

  it('met un groupe relancé en tête, même s’il est plus récent', () => {
    const groupes = regrouperParProduit([
      ligne('vieux', 1, '2026-09-01T10:00:00Z'),
      ligne('relance', 1, '2026-09-10T10:00:00Z', { relance_le: '2026-09-11T08:00:00Z' }),
    ])
    expect(groupes[0].produit_id).toBe('relance')
    expect(groupes[0].relancee).toBe(true)
    expect(groupes[1].relancee).toBe(false)
  })

  it('un groupe sans date de confirmation passe en dernier', () => {
    const groupes = regrouperParProduit([
      ligne('sans-date', 1, null),
      ligne('avec-date', 1, '2026-09-01T10:00:00Z'),
    ])
    expect(groupes.map((g) => g.produit_id)).toEqual(['avec-date', 'sans-date'])
    expect(groupes[1].plusAncienne).toBeNull()
  })
})
