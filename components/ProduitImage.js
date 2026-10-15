/* ─────────── components/ProduitImage.js ───────────
   Affiche la photo d'un produit, ou une icône discrète de sa catégorie
   s'il n'a pas encore de photo.

   Il remplit toujours son parent : c'est le PARENT qui décide de la taille
   (carte du catalogue, fiche produit, panier, détail de commande, admin…).

   Utilisation :
     <ProduitImage produit={p} />                    → photo principale
     <ProduitImage produit={p} src={p.images[2]} />  → une photo précise
     <ProduitImage produit={p} emojiSize={120} />    → icône plus grande (la taille sert de repère)
*/

import { Shirt, Footprints, Sparkles, ShoppingBag, House, Smartphone, Package } from 'lucide-react'
import Icone from '@/components/ui/Icone'
import { photoPrincipale } from '@/lib/produit'
import { C } from '@/lib/theme'

const ICONE_CATEGORIE = {
  'Vêtements': Shirt,
  'Chaussures': Footprints,
  'Beauté': Sparkles,
  'Accessoires': ShoppingBag,
  'Maison': House,
  'Tech': Smartphone,
}

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

  const taille = Math.min(56, Math.max(18, Math.round(emojiSize * 0.55)))
  return (
    <span
      role="img"
      aria-label={alt ?? produit?.nom ?? 'Produit sans photo'}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, opacity: 0.6 }}
    >
      <Icone icone={ICONE_CATEGORIE[produit?.categorie] || Package} taille={taille} />
    </span>
  )
}
