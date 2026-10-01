/* ─────────── lib/produit.js ───────────
   Petites fonctions et listes partagées sur les produits.
   Un seul endroit à modifier pour tout le site (catalogue, fiche, admin…).
*/

/* Listes utilisées par l'admin (formulaire + filtres) */
export const CATEGORIES = ['Vêtements', 'Chaussures', 'Beauté', 'Accessoires', 'Maison', 'Tech']
export const ORIGINES = ['Chine', 'Sénégal', 'Niger', 'Émirats', 'France', 'Autre']

/* Emoji de secours, affiché quand un produit n'a pas encore de photo */
export const EMOJI_CAT = {
  'Vêtements': '👕', 'Chaussures': '👟', 'Beauté': '💄',
  'Accessoires': '👜', 'Maison': '🏠', 'Tech': '📱',
}
export const emojiPour = (categorie) => EMOJI_CAT[categorie] || '📦'

/* Origine avec son drapeau : "Chine" → "🇨🇳 Chine" */
export const FLAG_ORIGINE = {
  'Chine': '🇨🇳', 'Sénégal': '🇸🇳', 'Niger': '🇳🇪',
  'Émirats': '🇦🇪', 'France': '🇫🇷',
}
export const flagPour = (origine) =>
  FLAG_ORIGINE[origine] ? `${FLAG_ORIGINE[origine]} ${origine}` : origine

/* 18000 → "18 000" */
export const formatKMF = (n) => Number(n || 0).toLocaleString('fr-FR')

/* Adresse de la photo principale (la 1re de la liste), ou null */
export const photoPrincipale = (produit) =>
  produit?.images && produit.images.length > 0 ? produit.images[0] : null

/* En base, prix_gros = prix TOTAL du lot.
   Cette fonction donne le prix d'UNE pièce quand on achète le lot.
   Ex : lot de 10 à 18 000 KMF → 1 800 KMF la pièce */
export const prixPieceEnLot = (produit) =>
  produit?.prix_gros && produit?.qte_min_gros
    ? Math.round(produit.prix_gros / produit.qte_min_gros)
    : null

/* Texte "neutre" pour les recherches : sans accents, en minuscules.
   "Boubou Brodé" et "boubou brode" deviennent identiques → la recherche
   trouve le produit même si on tape sans accent. */
export const normaliserTexte = (texte) =>
  (texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()