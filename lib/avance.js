/* ─────────── lib/avance.js ───────────
   Paiement avec avance : calculs d'AFFICHAGE uniquement.
   La base recalcule TOUJOURS l'avance réelle (passer_commande) : ces fonctions servent à
   montrer au client, avant qu'il valide, ce qu'il devra payer maintenant.
*/

import { MOYENS_PAIEMENT } from '@/lib/commandes'
import { NUMEROS_PAIEMENT } from '@/lib/config'

/* Avance estimée d'un panier.
   lignesPanier = [{ id, mode: 'unite' | 'lot', quantite }]   produits = { [id]: produit }
   Par pièce : min(avance_unitaire, prix payé pour cette pièce).
   Unité : pièces = quantité, prix de la pièce = prix_detail.
   Lot   : pièces = quantité × qte_min_gros, prix de la pièce = prix_gros / qte_min_gros.
   Produit sans avance (ou introuvable, ou lot indisponible) : 0. */
export function avanceEstimee(lignesPanier = [], produits = {}) {
  let total = 0
  for (const ligne of lignesPanier) {
    const p = produits[ligne.id]
    if (!p || p.mode_paiement !== 'avance' || !(Number(p.avance_unitaire) > 0)) continue

    let pieces
    let prixPiece
    if (ligne.mode === 'lot') {
      if (!p.prix_gros || !(Number(p.qte_min_gros) >= 2)) continue
      pieces = ligne.quantite * p.qte_min_gros
      prixPiece = p.prix_gros / p.qte_min_gros
    } else {
      pieces = ligne.quantite
      prixPiece = p.prix_detail
    }
    total += pieces * Math.min(Number(p.avance_unitaire), prixPiece)
  }
  return Math.round(total)
}

/* Avance encore détenue (reçue moins ce qui est à rembourser) */
export const avanceNette = (c) =>
  (Number(c?.montant_avance_recu) || 0) - (Number(c?.montant_a_rembourser) || 0)

/* Ce qu'il reste à payer pour que l'avance soit complète (jamais négatif) */
export const avanceReste = (c) =>
  Math.max((Number(c?.montant_avance_requis) || 0) - avanceNette(c), 0)

/* "Avance en attente" : commande reçue, avance demandée mais pas complète */
export const avanceEnAttente = (c) =>
  c?.statut === 'recue' && (Number(c?.montant_avance_requis) || 0) > 0 && avanceReste(c) > 0

/* Reste à encaisser à la livraison (même calcul que la base) */
export const resteALaLivraison = (c) =>
  Math.max((Number(c?.montant_total) || 0) - avanceNette(c), 0)

/* Remboursement encore à faire (annulée, avance à rendre pas encore rendue) */
export const remboursementReste = (c) =>
  Math.max((Number(c?.montant_a_rembourser) || 0) - (Number(c?.montant_rembourse) || 0), 0)

/* Numéro à afficher pour un moyen de paiement mobile, ou la phrase de remplacement */
export const PHRASE_NUMERO_A_COMMUNIQUER = 'numéro communiqué par notre équipe sur WhatsApp'
export const numeroPaiement = (moyen) => NUMEROS_PAIEMENT[moyen] || PHRASE_NUMERO_A_COMMUNIQUER

/* Les façons de payer l'avance, pour l'affichage client */
export const MOYENS_AVANCE_CLIENT = [
  { id: 'especes', libelle: MOYENS_PAIEMENT.especes, detail: 'auprès de notre équipe aux Comores' },
  { id: 'huri_money', libelle: MOYENS_PAIEMENT.huri_money, detail: null },
  { id: 'mvola', libelle: MOYENS_PAIEMENT.mvola, detail: null },
]

/* Message WhatsApp du client qui veut payer son avance */
export const messageAvanceWhatsApp = (montant, reference, formatMontant) =>
  `Bonjour, je souhaite payer l'avance de ${formatMontant(montant)} KMF pour la commande ${reference}`
