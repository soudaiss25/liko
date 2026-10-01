/* ─────────── lib/cart.js ───────────
   Panier stocké en localStorage (côté invité).
   Une ligne de panier = { id: produitId, mode: 'unite' | 'lot', quantite }
   - mode 'unite'  → quantite = nombre de pièces
   - mode 'lot'    → quantite = nombre de lots (voir produit.qte_min_gros)

   On garde ça simple : pas de gestion taille/couleur pour l'instant
   (à ajouter plus tard si besoin, même logique).
*/

const CART_KEY = 'salut_panier'

function lireBrut() {
  if (typeof window === 'undefined') return []
  try {
    const data = window.localStorage.getItem(CART_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function ecrireBrut(lignes) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CART_KEY, JSON.stringify(lignes))
  // Permet à d'autres composants montés sur la même page de réagir tout de suite
  window.dispatchEvent(new Event('panier-modifie'))
}

export function getPanier() {
  return lireBrut()
}

export function getPanierCount() {
  return lireBrut().reduce((total, ligne) => total + ligne.quantite, 0)
}

export function ajouterAuPanier(produitId, mode = 'unite', quantite = 1) {
  const lignes = lireBrut()
  const existante = lignes.find((l) => l.id === produitId && l.mode === mode)

  if (existante) {
    existante.quantite += quantite
  } else {
    lignes.push({ id: produitId, mode, quantite })
  }

  ecrireBrut(lignes)
}

export function modifierQuantite(produitId, mode, quantite) {
  let lignes = lireBrut()
  if (quantite <= 0) {
    lignes = lignes.filter((l) => !(l.id === produitId && l.mode === mode))
  } else {
    lignes = lignes.map((l) =>
      l.id === produitId && l.mode === mode ? { ...l, quantite } : l
    )
  }
  ecrireBrut(lignes)
}

export function retirerDuPanier(produitId, mode) {
  const lignes = lireBrut().filter((l) => !(l.id === produitId && l.mode === mode))
  ecrireBrut(lignes)
}

export function viderPanier() {
  ecrireBrut([])
}