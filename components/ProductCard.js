'use client'

/* ─────────── components/ProductCard.js ───────────
   Carte produit pour les GRILLES : catalogue, et plus tard
   favoris, "tu aimeras aussi", résultats de recherche…

   Elle gère elle-même l'ajout au panier (et le petit "Ajouté").
   Le cœur favori n'apparaît que si la page fournit onToggleFavori
   (pas utilisé pour l'instant : les favoris ne sont enregistrés nulle part).

   Utilisation :
     <ProductCard produit={p} />
     <ProductCard produit={p} estFavori={true} onToggleFavori={() => …} />
*/

import { useState } from 'react'
import ProduitImage from '@/components/ProduitImage'
import { ajouterAuPanier } from '@/lib/cart'
import { Heart, Check, ShoppingCart } from 'lucide-react'
import Icone from '@/components/ui/Icone'
import { formatKMF, prixPieceEnLot } from '@/lib/produit'

import { C } from '@/lib/theme'
export default function ProductCard({ produit: p, estFavori = false, onToggleFavori, titreFavori }) {
  const [ajoute, setAjoute] = useState(false)
  const pieceLot = prixPieceEnLot(p)

  const ajouter = () => {
    ajouterAuPanier(p.id, 'unite', 1)
    setAjoute(true)
    setTimeout(() => setAjoute(false), 1200)
  }

  return (
    <article className="pc-card">
      {/* href + precedence : React n'insère ce style qu'UNE fois,
          même s'il y a 50 cartes sur la page */}
      <style href="product-card" precedence="default">{css}</style>

      {/* Le lien image est retiré du parcours clavier (tabIndex -1) :
          le lien sur le nom mène au même endroit, inutile de l'avoir deux fois */}
      <a href={`/produits/${p.id}`} className="pc-img" tabIndex={-1} aria-hidden="true">
        <ProduitImage produit={p} emojiSize={56} />
        {p.prix_gros && <span className="pc-badge">Prix de gros</span>}
      </a>

      {onToggleFavori && (
        <button
          onClick={onToggleFavori}
          className="pc-fav"
          aria-pressed={estFavori}
          aria-label={estFavori ? `Retirer ${p.nom} des favoris` : `Ajouter ${p.nom} aux favoris`}
          title={titreFavori}
        >
          <Icone icone={Heart} taille={20} fill={estFavori ? C.clay : 'none'} color={estFavori ? C.clay : C.inkDeep} />
        </button>
      )}

      <div className="pc-body">
        <a href={`/produits/${p.id}`} className="pc-name-link">
          <h3 className="pc-name">{p.nom}</h3>
        </a>
        {p.origine && <div className="pc-origin">Origine : {p.origine}</div>}

        <div className="pc-price-row">
          <span className="pc-price">{formatKMF(p.prix_detail)}</span>
          <span className="pc-currency">KMF</span>
        </div>

        {p.mode_paiement === 'avance' && Number(p.avance_unitaire) > 0 && (
          <p className="pc-avance">Avance de {formatKMF(p.avance_unitaire)} KMF par pièce à la commande</p>
        )}

        {/* Prix de gros : juste un lien discret vers la fiche (décision du projet) */}
        {pieceLot && (
          <a href={`/produits/${p.id}`} className="pc-gros">
            Dès {p.qte_min_gros} pièces : {formatKMF(pieceLot)} KMF la pièce
          </a>
        )}

        <div className="pc-add-wrap">
          <button onClick={ajouter} className={`pc-add ${ajoute ? 'pc-add-done' : ''}`}>
            {ajoute ? <><Icone icone={Check} taille={18} /> Ajouté</> : <><Icone icone={ShoppingCart} taille={18} /> Ajouter au panier</>}
          </button>
        </div>
      </div>
    </article>
  )
}

/* ─────────── CSS (préfixe pc- pour ne pas se mélanger avec les pages) ─────────── */
const css = `
  .pc-card {
    background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden;
    display: flex; flex-direction: column; position: relative;
  }
  .pc-img {
    width: 100%; aspect-ratio: 1; background: ${C.sand}; position: relative; overflow: hidden;
    display: block; text-decoration: none;
  }
  .pc-badge {
    position: absolute; top: 8px; left: 8px; background: ${C.white}; color: ${C.ink};
    font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 6px;
  }
  .pc-fav {
    position: absolute; top: 4px; right: 4px; width: 44px; height: 44px; border-radius: 8px;
    border: none; cursor: pointer; background: transparent; z-index: 2;
    display: flex; align-items: center; justify-content: center;
  }
  .pc-fav:hover { background: rgba(255,255,255,0.7); }

  .pc-body { padding: 12px; display: flex; flex-direction: column; flex: 1; }
  .pc-name-link { text-decoration: none; }
  .pc-name-link:hover .pc-name { text-decoration: underline; }
  .pc-name {
    font-size: 15px; font-weight: 600; color: ${C.inkDeep}; margin: 0 0 4px; line-height: 1.35;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 40px;
  }
  .pc-origin { font-size: 13px; color: ${C.inkSoft}; margin-bottom: 8px; }

  .pc-price-row { display: flex; align-items: baseline; gap: 4px; }
  .pc-price { font-size: 20px; font-weight: 800; color: ${C.clay}; }
  .pc-currency { font-size: 13px; font-weight: 600; color: ${C.inkSoft}; }
  .pc-avance { font-size: 13px; color: ${C.inkSoft}; margin: 4px 0 0; line-height: 1.4; }

  .pc-gros {
    display: inline-flex; align-items: center; min-height: 44px; margin-top: 4px; font-size: 14px; font-weight: 600;
    color: ${C.ink}; text-decoration: underline; align-self: flex-start;
  }

  /* margin-top: auto → le bouton reste collé en bas, toutes les cartes sont alignées */
  .pc-add-wrap { margin-top: auto; padding-top: 12px; }
  .pc-add {
    width: 100%; min-height: 44px; border: 1.5px solid ${C.ink}; border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    background: ${C.white}; color: ${C.ink}; font-size: 14px; font-weight: 700; font-family: inherit;
  }
  .pc-add:hover { background: ${C.sand}; }
  .pc-add-done, .pc-add-done:hover { background: ${C.leaf}; border-color: ${C.leaf}; color: ${C.white}; }
`
