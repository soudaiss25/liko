import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getPanier, getPanierCount, ajouterAuPanier, modifierQuantite, retirerDuPanier, viderPanier,
} from '@/lib/cart'

beforeEach(() => localStorage.clear())

describe('Ajouter au panier', () => {
  it('ajoute une nouvelle ligne', () => {
    ajouterAuPanier('robe', 'unite', 2)
    expect(getPanier()).toEqual([{ id: 'robe', mode: 'unite', quantite: 2 }])
  })
  it('regroupe le même produit dans le même mode (pas de ligne en double)', () => {
    ajouterAuPanier('robe', 'unite', 1)
    ajouterAuPanier('robe', 'unite', 2)
    expect(getPanier()).toEqual([{ id: 'robe', mode: 'unite', quantite: 3 }])
  })
  it('sépare l\u2019achat à l\u2019unité et l\u2019achat par lot du même produit', () => {
    ajouterAuPanier('robe', 'unite', 1)
    ajouterAuPanier('robe', 'lot', 1)
    expect(getPanier()).toHaveLength(2)
  })
  it('prévient les autres composants de la page (compteur du panier)', () => {
    const ecouteur = vi.fn()
    window.addEventListener('panier-modifie', ecouteur)
    ajouterAuPanier('robe')
    expect(ecouteur).toHaveBeenCalledOnce()
    window.removeEventListener('panier-modifie', ecouteur)
  })
})

describe('Modifier et retirer', () => {
  it('change la quantité d\u2019une ligne', () => {
    ajouterAuPanier('robe', 'unite', 1)
    modifierQuantite('robe', 'unite', 5)
    expect(getPanierCount()).toBe(5)
  })
  it('retire la ligne quand la quantité tombe à 0', () => {
    ajouterAuPanier('robe', 'unite', 1)
    modifierQuantite('robe', 'unite', 0)
    expect(getPanier()).toEqual([])
  })
  it('retire uniquement la ligne visée (bon produit ET bon mode)', () => {
    ajouterAuPanier('robe', 'unite', 1)
    ajouterAuPanier('robe', 'lot', 1)
    retirerDuPanier('robe', 'lot')
    expect(getPanier()).toEqual([{ id: 'robe', mode: 'unite', quantite: 1 }])
  })
  it('vide tout le panier (après une commande)', () => {
    ajouterAuPanier('robe'); ajouterAuPanier('sneakers')
    viderPanier()
    expect(getPanierCount()).toBe(0)
  })
})

describe('Robustesse', () => {
  it('repart d\u2019un panier vide si le stockage est corrompu', () => {
    localStorage.setItem('salut_panier', 'pas du JSON')
    expect(getPanier()).toEqual([])
  })
})
