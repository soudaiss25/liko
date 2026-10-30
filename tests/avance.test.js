import { describe, it, expect } from 'vitest'
import {
  avanceEstimee, avanceNette, avanceReste, avanceEnAttente, resteALaLivraison, remboursementReste,
  numeroPaiement, PHRASE_NUMERO_A_COMMUNIQUER, messageAvanceWhatsApp,
} from '@/lib/avance'
import { messageErreurCommande, MOYENS_PAIEMENT } from '@/lib/commandes'
import { WHATSAPP_SERVICE, WHATSAPP_CHIFFRES, NUMEROS_PAIEMENT } from '@/lib/config'

const robe = { id: 'robe', mode_paiement: 'avance', avance_unitaire: 500, prix_detail: 2500, prix_gros: 18000, qte_min_gros: 10 }
const sac = { id: 'sac', mode_paiement: 'livraison', avance_unitaire: null, prix_detail: 4000, prix_gros: null, qte_min_gros: null }
const bijou = { id: 'bijou', mode_paiement: 'avance', avance_unitaire: 3000, prix_detail: 3500, prix_gros: 20000, qte_min_gros: 10 }
const produits = { robe, sac, bijou }

describe('Avance estimée (affichage)', () => {
  it('à l\u2019unité : pièces × avance par pièce', () => {
    expect(avanceEstimee([{ id: 'robe', mode: 'unite', quantite: 3 }], produits)).toBe(1500)
  })
  it('en lot : plafonnée au prix réel de la pièce (prix_gros / qte_min_gros)', () => {
    // bijou : avance 3000 par pièce, mais en lot la pièce coûte 20000 / 10 = 2000 → plafond 2000
    expect(avanceEstimee([{ id: 'bijou', mode: 'lot', quantite: 1 }], produits)).toBe(10 * 2000)
    // robe : avance 500 < 1800 (18000 / 10) → 500 par pièce, 2 lots = 20 pièces
    expect(avanceEstimee([{ id: 'robe', mode: 'lot', quantite: 2 }], produits)).toBe(20 * 500)
  })
  it('panier mixte : additionne les lignes avec avance, ignore les autres', () => {
    const panier = [
      { id: 'robe', mode: 'unite', quantite: 2 },   // 1000
      { id: 'sac', mode: 'unite', quantite: 5 },    // 0
      { id: 'bijou', mode: 'unite', quantite: 1 },  // 3000
      { id: 'robe', mode: 'lot', quantite: 1 },     // 5000
    ]
    expect(avanceEstimee(panier, produits)).toBe(1000 + 3000 + 5000)
  })
  it('produit sans avance, introuvable ou panier vide : 0', () => {
    expect(avanceEstimee([{ id: 'sac', mode: 'unite', quantite: 4 }], produits)).toBe(0)
    expect(avanceEstimee([{ id: 'inconnu', mode: 'unite', quantite: 1 }], produits)).toBe(0)
    expect(avanceEstimee([], produits)).toBe(0)
    expect(avanceEstimee()).toBe(0)
  })
  it('plafonne aussi à l\u2019unité (avance jamais au-dessus du prix de la pièce)', () => {
    const p = { id: 'x', mode_paiement: 'avance', avance_unitaire: 900, prix_detail: 800 }
    expect(avanceEstimee([{ id: 'x', mode: 'unite', quantite: 2 }], { x: p })).toBe(1600)
  })
  it('arrondit au franc', () => {
    const p = { id: 'x', mode_paiement: 'avance', avance_unitaire: 1000, prix_detail: 2000, prix_gros: 1000, qte_min_gros: 3 }
    // prix de la pièce en lot : 1000 / 3 = 333,33 → 3 pièces × 333,33 = 1000
    expect(avanceEstimee([{ id: 'x', mode: 'lot', quantite: 1 }], { x: p })).toBe(1000)
  })
})

describe('Montants d\u2019une commande avec avance', () => {
  const c = (extra) => ({ statut: 'recue', montant_total: 10000, montant_avance_requis: 3000, montant_avance_recu: 0, montant_a_rembourser: 0, montant_rembourse: 0, ...extra })

  it('reste à payer, avance en attente, reste à la livraison', () => {
    expect(avanceReste(c())).toBe(3000)
    expect(avanceEnAttente(c())).toBe(true)
    expect(resteALaLivraison(c())).toBe(10000)
    const partielle = c({ montant_avance_recu: 1000 })
    expect(avanceReste(partielle)).toBe(2000)
    expect(avanceEnAttente(partielle)).toBe(true)
  })
  it('avance complète : plus d\u2019attente, la livraison n\u2019encaisse que le reste', () => {
    const complete = c({ montant_avance_recu: 3000, statut: 'en_livraison' })
    expect(avanceReste(complete)).toBe(0)
    expect(avanceEnAttente(complete)).toBe(false)
    expect(resteALaLivraison(complete)).toBe(7000)
  })
  it('pas d\u2019avance demandée, ou commande déjà confirmée : pas d\u2019attente', () => {
    expect(avanceEnAttente(c({ montant_avance_requis: 0 }))).toBe(false)
    expect(avanceEnAttente(c({ statut: 'confirmee' }))).toBe(false)
  })
  it('l\u2019avance nette tient compte de ce qui est à rembourser', () => {
    const annulee = c({ statut: 'annulee', montant_avance_recu: 3000, montant_a_rembourser: 2000, montant_rembourse: 500 })
    expect(avanceNette(annulee)).toBe(1000)
    expect(remboursementReste(annulee)).toBe(1500)
    expect(remboursementReste(c())).toBe(0)
  })
})

describe('Réglages et textes', () => {
  it('le numéro WhatsApp du service est renseigné, et wa.me reçoit les chiffres seulement', () => {
    expect(WHATSAPP_SERVICE).toBe('+2693797674')
    expect(WHATSAPP_CHIFFRES).toBe('2693797674')
  })
  it('numéro de paiement absent : la phrase de remplacement', () => {
    expect(NUMEROS_PAIEMENT).toEqual({ huri_money: '', mvola: '' })
    expect(numeroPaiement('mvola')).toBe(PHRASE_NUMERO_A_COMMUNIQUER)
    expect(PHRASE_NUMERO_A_COMMUNIQUER).toBe('numéro communiqué par notre équipe sur WhatsApp')
  })
  it('moyens de paiement', () => {
    expect(MOYENS_PAIEMENT).toEqual({ especes: 'Espèces', huri_money: 'Huri Money', mvola: 'MVola' })
  })
  it('message WhatsApp de l\u2019avance', () => {
    expect(messageAvanceWhatsApp(3000, 'CMD-0012', (n) => String(n))).toBe(
      "Bonjour, je souhaite payer l'avance de 3000 KMF pour la commande CMD-0012")
  })
  it.each([
    ['AVANCE_INCOMPLETE', /avance n.est pas encore complète : enregistre-la avant de confirmer/],
    ['AVANCE_TROP_ELEVEE', /dépasse l.avance restant due/],
    ['AVANCE_HORS_DELAI', /avance s.enregistre avant la confirmation/],
    ['PAS_D_AVANCE', /ne demande pas d.avance/],
    ['REFERENCE_OBLIGATOIRE', /référence de la transaction mobile money/],
    ['MOYEN_INVALIDE', /Choisis un moyen de paiement/],
    ['AVANCE_DEJA_PAYEE', /avance a déjà été payée : contacte-nous sur WhatsApp pour annuler/],
    ['RIEN_A_REMBOURSER', /rien à rembourser/],
    ['REMBOURSEMENT_TROP_ELEVE', /dépasse ce qui reste à rembourser/],
  ])('traduit le code %s', (code, motif) => {
    expect(messageErreurCommande({ message: code })).toMatch(motif)
  })
})
