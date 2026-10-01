/* ─────────── components/ProduitImage.js ───────────
   Affiche la photo d'un produit, ou l'emoji de sa catégorie
   s'il n'a pas encore de photo.

   Il remplit toujours son parent : c'est le PARENT qui décide de la taille
   (carte du catalogue, fiche produit, panier, détail de commande, admin…).

   Utilisation :
     <ProduitImage produit={p} />                    → photo principale
     <ProduitImage produit={p} src={p.images[2]} />  → une photo précise
     <ProduitImage produit={p} emojiSize={120} />    → emoji plus grand
*/

import { emojiPour, photoPrincipale } from '@/lib/produit'

export default function ProduitImage({ produit, src, alt, emojiSize = 48, eager = false }) {
  const url = src || photoPrincipale(produit)

  if (url) {
    return (
      <img
        src={url}
        alt={alt ?? produit?.nom ?? ''}
        loading={eager ? 'eager' : 'lazy'}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={alt ?? produit?.nom ?? 'Produit'}
      style={{ fontSize: emojiSize, lineHeight: 1 }}
    >
      {emojiPour(produit?.categorie)}
    </span>
  )
}