'use client'

/* ─────────── components/ProductCard.js ───────────
   Carte produit pour les GRILLES : catalogue, et plus tard
   favoris, "tu aimeras aussi", résultats de recherche…

   Elle gère elle-même l'ajout au panier (et le petit "✓ Ajouté").
   Le cœur favori n'apparaît que si la page fournit onToggleFavori.

   Utilisation :
     <ProductCard produit={p} />
     <ProductCard produit={p} estFavori={true} onToggleFavori={() => …} />
*/

import { useState } from 'react'
import ProduitImage from '@/components/ProduitImage'
import { ajouterAuPanier } from '@/lib/cart'
import { flagPour, formatKMF, prixPieceEnLot } from '@/lib/produit'

const C = {
  ink: '#1D4E63', inkDeep: '#143A4B', inkSoft: '#6E8A97',
  sand: '#F4F1EA', line: '#E4DED2',
  gold: '#E8A020', goldDeep: '#C6851A',
  leaf: '#3E9268', clay: '#C2574A',
}

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
        {p.prix_gros && <span className="pc-badge">GROS DISPO</span>}
      </a>

      {onToggleFavori && (
        <button
          onClick={onToggleFavori}
          className="pc-fav"
          aria-pressed={estFavori}
          aria-label={estFavori ? `Retirer ${p.nom} des favoris` : `Ajouter ${p.nom} aux favoris`}
          title={titreFavori}
        >
          {estFavori ? '❤️' : '🤍'}
        </button>
      )}

      <div className="pc-body">
        <a href={`/produits/${p.id}`} className="pc-name-link">
          <h3 className="pc-name">{p.nom}</h3>
        </a>
        <div className="pc-origin">{flagPour(p.origine)}</div>

        <div className="pc-price-row">
          <span className="pc-price">{formatKMF(p.prix_detail)}</span>
          <span className="pc-currency">KMF</span>
        </div>

        {/* Prix de gros : juste un lien discret vers la fiche (décision du projet) */}
        {pieceLot && (
          <a href={`/produits/${p.id}`} className="pc-gros">
            Dès {p.qte_min_gros} pcs : {formatKMF(pieceLot)} KMF/pièce →
          </a>
        )}

        <div className="pc-add-wrap">
          <button onClick={ajouter} className={`pc-add ${ajoute ? 'pc-add-done' : ''}`}>
            {ajoute ? '✓ Ajouté' : '🛒 Ajouter au panier'}
          </button>
        </div>
      </div>
    </article>
  )
}

/* ─────────── CSS (préfixe pc- pour ne pas se mélanger avec les pages) ─────────── */
const css = `
  .pc-card {
    background: #fff; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden;
    display: flex; flex-direction: column; position: relative;
    transition: box-shadow .15s, transform .15s;
  }
  .pc-img {
    width: 100%; aspect-ratio: 1; background: ${C.sand}; position: relative; overflow: hidden;
    display: flex; align-items: center; justify-content: center; text-decoration: none;
  }
  .pc-badge {
    position: absolute; top: 8px; left: 8px; background: ${C.leaf}; color: #fff;
    font-size: 9px; font-weight: 800; letter-spacing: 0.5px; padding: 4px 8px; border-radius: 5px;
  }
  .pc-fav {
    position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; border-radius: 50%;
    border: none; cursor: pointer; font-size: 15px; background: rgba(255,255,255,0.95);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08); z-index: 2;
  }

  .pc-body { padding: 12px; display: flex; flex-direction: column; flex: 1; }
  .pc-name-link { text-decoration: none; }
  .pc-name-link:hover .pc-name { color: ${C.ink}; text-decoration: underline; }
  .pc-name {
    font-size: 14px; font-weight: 600; color: ${C.inkDeep}; margin: 0 0 4px; line-height: 1.35;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 38px;
  }
  .pc-origin { font-size: 11px; color: ${C.inkSoft}; margin-bottom: 8px; }

  .pc-price-row { display: flex; align-items: baseline; gap: 4px; }
  .pc-price { font-size: 20px; font-weight: 800; color: ${C.clay}; }
  .pc-currency { font-size: 12px; font-weight: 600; color: ${C.inkSoft}; }

  .pc-gros {
    display: inline-block; margin-top: 6px; font-size: 11.5px; font-weight: 700;
    color: ${C.goldDeep}; text-decoration: none; background: #FFF6E4;
    padding: 5px 9px; border-radius: 6px; align-self: flex-start;
  }

  /* margin-top: auto → le bouton reste collé en bas, toutes les cartes sont alignées */
  .pc-add-wrap { margin-top: auto; padding-top: 12px; }
  .pc-add {
    width: 100%; height: 44px; border: none; border-radius: 8px; cursor: pointer;
    background: ${C.gold}; color: ${C.inkDeep}; font-size: 13px; font-weight: 700; font-family: inherit;
  }
  .pc-add:hover { background: ${C.goldDeep}; }
  .pc-add-done { background: ${C.leaf}; color: #fff; }
  .pc-add-done:hover { background: ${C.leaf}; }

  @media (min-width: 1000px) {
    .pc-card:hover { box-shadow: 0 6px 20px rgba(20,58,75,0.10); transform: translateY(-2px); }
  }
`