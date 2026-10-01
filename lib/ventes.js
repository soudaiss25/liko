/* ─────────── lib/ventes.js ───────────
   Calcule les statistiques de vente à partir de deux tables :
     - commandes       → une ligne par commande (statut, île, montant_total, date)
     - commande_items  → une ligne par produit commandé (quantite, prix_unitaire)

   Le principe : on filtre les commandes (période + pas annulées),
   puis on additionne les lignes qui appartiennent à ces commandes.
*/

export const STATUT_A_TRAITER = 'recue'   // commande pas encore confirmée
export const STATUT_ANNULEE = 'annulee'   // exclue de tous les calculs

/* Période :
   depuis = date de début (incluse), ou null = pas de limite
   jusqua = date de fin (incluse),   ou null = jusqu'à maintenant */
export function calculerVentes({ commandes = [], items = [], produits = [], depuis = null, jusqua = null }) {
  // 1. Commandes de la période, sans les annulées
  const commandesPeriode = commandes.filter((c) => {
    const date = new Date(c.created_at)
    if (depuis && date < depuis) return false
    if (jusqua && date > jusqua) return false
    return true
  })
  const valides = commandesPeriode.filter((c) => c.statut !== STATUT_ANNULEE)
  const idsValides = new Set(valides.map((c) => c.id))

  // 2. Prix d'achat de chaque produit (pour la marge)
  const prixAchat = {}
  for (const p of produits) {
    if (p.prix_achat) prixAchat[p.id] = Number(p.prix_achat)
  }

  // 3. On parcourt les lignes vendues
  //    parProduit = { [produit_id]: { pieces: 12, ca: 36000 } }
  const parProduit = {}
  let marge = 0
  let margePartielle = false // true si un produit vendu n'a pas de prix d'achat

  for (const it of items) {
    if (!idsValides.has(it.commande_id) || !it.produit_id) continue

    const quantite = Number(it.quantite) || 0
    const prixVente = Number(it.prix_unitaire) || 0

    const ligne = parProduit[it.produit_id] || { pieces: 0, ca: 0 }
    ligne.pieces += quantite
    ligne.ca += quantite * prixVente
    parProduit[it.produit_id] = ligne

    if (prixAchat[it.produit_id] !== undefined) {
      marge += quantite * (prixVente - prixAchat[it.produit_id])
    } else {
      margePartielle = true
    }
  }

  // 4. Totaux
  const ca = valides.reduce((somme, c) => somme + (Number(c.montant_total) || 0), 0)
  const nbCommandes = valides.length
  const panierMoyen = nbCommandes > 0 ? Math.round(ca / nbCommandes) : 0

  return { commandesPeriode, valides, parProduit, ca, nbCommandes, panierMoyen, marge, margePartielle }
}