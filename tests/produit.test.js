import { describe, it, expect } from 'vitest'
import {
  emojiPour, flagPour, formatKMF, photoPrincipale, prixPieceEnLot, normaliserTexte,
} from '@/lib/produit'

describe('Emoji de secours (produit sans photo)', () => {
  it('donne l\u2019emoji de la catégorie', () => {
    expect(emojiPour('Chaussures')).toBe('👟')
  })
  it('donne un carton pour une catégorie inconnue ou vide', () => {
    expect(emojiPour('Jardin')).toBe('📦')
    expect(emojiPour(undefined)).toBe('📦')
  })
})

describe('Origine avec drapeau', () => {
  it('ajoute le drapeau d\u2019un pays connu', () => {
    expect(flagPour('Chine')).toBe('🇨🇳 Chine')
  })
  it('laisse un pays inconnu tel quel', () => {
    expect(flagPour('Autre')).toBe('Autre')
  })
})

describe('Affichage des prix en KMF', () => {
  it('sépare les milliers à la française', () => {
    // toLocaleString utilise une espace insécable fine : on compare sans espaces
    expect(formatKMF(18000).replace(/\s/g, '')).toBe('18000')
    expect(formatKMF(18000)).toMatch(/^18\s000$/)
  })
  it('affiche 0 plutôt que planter sur une valeur vide', () => {
    expect(formatKMF(null)).toBe('0')
    expect(formatKMF(undefined)).toBe('0')
  })
})

describe('Photo principale', () => {
  it('prend la 1re photo de la liste', () => {
    expect(photoPrincipale({ images: ['a.webp', 'b.webp'] })).toBe('a.webp')
  })
  it('renvoie null sans photo (l\u2019emoji prendra le relais)', () => {
    expect(photoPrincipale({ images: [] })).toBeNull()
    expect(photoPrincipale({})).toBeNull()
    expect(photoPrincipale(null)).toBeNull()
  })
})

describe('Prix d\u2019une pièce quand on achète le lot', () => {
  it('divise le prix TOTAL du lot par le nombre de pièces', () => {
    // Règle métier : en base, prix_gros = prix du lot complet
    expect(prixPieceEnLot({ prix_gros: 18000, qte_min_gros: 10 })).toBe(1800)
  })
  it('arrondit au KMF près', () => {
    expect(prixPieceEnLot({ prix_gros: 8000, qte_min_gros: 6 })).toBe(1333)
  })
  it('renvoie null si le produit n\u2019est pas vendu par lot', () => {
    expect(prixPieceEnLot({ prix_gros: null, qte_min_gros: null })).toBeNull()
    expect(prixPieceEnLot({ prix_gros: 18000 })).toBeNull()
  })
})

describe('Recherche sans accents ni majuscules', () => {
  it('rend "Boubou Brodé" et "boubou brode" identiques', () => {
    expect(normaliserTexte('Boubou Brodé')).toBe(normaliserTexte('boubou brode'))
  })
  it('gère Mohéli / Moheli (îles écrites avec ou sans accent)', () => {
    expect(normaliserTexte('Mohéli')).toBe('moheli')
  })
  it('enlève les espaces autour et supporte une valeur vide', () => {
    expect(normaliserTexte('  Robe  ')).toBe('robe')
    expect(normaliserTexte(null)).toBe('')
  })
})
