'use client'

/* ─────────── components/admin/ListeProduits.js ───────────
   Liste des produits de l'admin, avec recherche, filtres et tri.

   Les filtres sont gardés par la PAGE (props filtres / setFiltres) et pas ici :
   comme ça, le tableau de bord peut ouvrir cette liste déjà filtrée
   (ex : bouton "Voir" sur "3 produits sans photo").
*/

import ProduitImage from '@/components/ProduitImage'
import { CATEGORIES, formatKMF, prixPieceEnLot, normaliserTexte } from '@/lib/produit'

const C = {
  ink: '#1D4E63', inkDeep: '#143A4B', inkSoft: '#6E8A97',
  sand: '#F4F1EA', line: '#E4DED2',
  gold: '#E8A020', goldDeep: '#C6851A',
  leaf: '#3E9268', clay: '#C2574A',
}

/* Valeurs "rien de filtré". Exportée pour que la page puisse s'en servir. */
export const FILTRES_VIDES = {
  texte: '',
  categorie: 'Toutes',
  statut: 'tous',        // 'tous' | 'en_ligne' | 'masques'
  sansPhoto: false,
  avecLot: false,
  jamaisVendu: false,
  tri: 'recents',        // voir TRIS ci-dessous
}

const TRIS = [
  { id: 'recents', label: 'Plus récents' },
  { id: 'vendus', label: 'Plus vendus' },
  { id: 'prix_asc', label: 'Prix croissant' },
  { id: 'prix_desc', label: 'Prix décroissant' },
  { id: 'nom', label: 'Nom (A → Z)' },
]

export default function ListeProduits({
  produits, ventesParProduit, filtres, setFiltres,
  onAjouter, onModifier, onToggleActif, onSupprimer,
}) {
  /* Petit raccourci : changer UN filtre en gardant les autres */
  const changer = (cle, valeur) => setFiltres({ ...filtres, [cle]: valeur })

  const piecesVendues = (p) => ventesParProduit[p.id]?.pieces || 0

  /* ── 1. Filtrer ── */
  const recherche = normaliserTexte(filtres.texte)

  const filtres_ok = (p, ignorerStatut = false) => {
    if (recherche && !normaliserTexte(`${p.nom} ${p.description || ''}`).includes(recherche)) return false
    if (filtres.categorie !== 'Toutes' && p.categorie !== filtres.categorie) return false
    if (!ignorerStatut && filtres.statut === 'en_ligne' && !p.actif) return false
    if (!ignorerStatut && filtres.statut === 'masques' && p.actif) return false
    if (filtres.sansPhoto && p.images && p.images.length > 0) return false
    if (filtres.avecLot && !p.prix_gros) return false
    if (filtres.jamaisVendu && piecesVendues(p) > 0) return false
    return true
  }

  const resultats = produits.filter((p) => filtres_ok(p))

  /* ── 2. Trier ── (on copie avec [...] pour ne pas modifier la liste d'origine) */
  const tries = [...resultats].sort((a, b) => {
    switch (filtres.tri) {
      case 'vendus': return piecesVendues(b) - piecesVendues(a)
      case 'prix_asc': return Number(a.prix_detail) - Number(b.prix_detail)
      case 'prix_desc': return Number(b.prix_detail) - Number(a.prix_detail)
      case 'nom': return (a.nom || '').localeCompare(b.nom || '', 'fr')
      default: return new Date(b.created_at) - new Date(a.created_at)
    }
  })

  /* Compteurs affichés sur les boutons de statut (avec les autres filtres appliqués) */
  const baseStatut = produits.filter((p) => filtres_ok(p, true))
  const compteurs = {
    tous: baseStatut.length,
    en_ligne: baseStatut.filter((p) => p.actif).length,
    masques: baseStatut.filter((p) => !p.actif).length,
  }

  const filtresActifs = JSON.stringify({ ...filtres, tri: 'recents' }) !== JSON.stringify(FILTRES_VIDES)

  return (
    <section aria-labelledby="titre-produits">
      <style href="admin-liste" precedence="default">{css}</style>

      <div className="page-head">
        <div>
          <h1 id="titre-produits" className="page-title">Produits</h1>
          <p className="page-sub">{produits.length} produit{produits.length > 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={onAjouter} className="btn-primary">+ Ajouter un produit</button>
      </div>

      {/* ════════ FILTRES ════════ */}
      <div className="lf-box">
        {/* Recherche */}
        <div className="lf-search">
          <span className="lf-search-icone" aria-hidden="true">🔍</span>
          <input
            type="search"
            className="input lf-search-input"
            placeholder="Rechercher un produit…"
            aria-label="Rechercher un produit"
            value={filtres.texte}
            onChange={(e) => changer('texte', e.target.value)}
          />
        </div>

        <div className="lf-ligne">
          {/* Statut : 3 choix exclusifs → boutons segmentés */}
          <div className="lf-segment" role="group" aria-label="Statut">
            {[
              { id: 'tous', label: 'Tous' },
              { id: 'en_ligne', label: 'En ligne' },
              { id: 'masques', label: 'Masqués' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => changer('statut', s.id)}
                aria-pressed={filtres.statut === s.id}
                className={`lf-seg ${filtres.statut === s.id ? 'lf-seg-on' : ''}`}
              >
                {s.label} <span className="lf-seg-nb">{compteurs[s.id]}</span>
              </button>
            ))}
          </div>

          <select
            className="input lf-select"
            aria-label="Catégorie"
            value={filtres.categorie}
            onChange={(e) => changer('categorie', e.target.value)}
          >
            <option value="Toutes">Toutes les catégories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            className="input lf-select"
            aria-label="Trier par"
            value={filtres.tri}
            onChange={(e) => changer('tri', e.target.value)}
          >
            {TRIS.map((t) => <option key={t.id} value={t.id}>Tri : {t.label}</option>)}
          </select>
        </div>

        {/* Filtres oui/non → petites puces qu'on allume/éteint */}
        <div className="lf-chips">
          {[
            { cle: 'sansPhoto', label: '📷 Sans photo' },
            { cle: 'avecLot', label: '📦 Vendu par lot' },
            { cle: 'jamaisVendu', label: '💤 Jamais vendu' },
          ].map((c) => (
            <button
              key={c.cle}
              onClick={() => changer(c.cle, !filtres[c.cle])}
              aria-pressed={filtres[c.cle]}
              className={`lf-chip ${filtres[c.cle] ? 'lf-chip-on' : ''}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Résumé des résultats */}
      <div className="lf-resume" aria-live="polite">
        <span>
          {tries.length} produit{tries.length > 1 ? 's' : ''}
          {filtresActifs && ` sur ${produits.length}`}
        </span>
        {filtresActifs && (
          <button onClick={() => setFiltres(FILTRES_VIDES)} className="lf-reset">
            Effacer les filtres
          </button>
        )}
      </div>

      {/* ════════ LISTE ════════ */}
      {produits.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">📦</div>
          <div className="empty-title">Aucun produit pour l'instant</div>
          <button onClick={onAjouter} className="btn-primary" style={{ marginTop: '16px' }}>
            + Ajouter ton premier produit
          </button>
        </div>
      ) : tries.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">🔍</div>
          <div className="empty-title">Aucun produit ne correspond à ces filtres</div>
          <button onClick={() => setFiltres(FILTRES_VIDES)} className="btn-secondary" style={{ marginTop: '16px' }}>
            Effacer les filtres
          </button>
        </div>
      ) : (
        <div className="liste">
          {tries.map((p) => {
            const vendus = piecesVendues(p)
            return (
              <div key={p.id} className={`ligne-produit ${!p.actif ? 'ligne-inactive' : ''}`}>
                <div className="lp-thumb">
                  <ProduitImage produit={p} emojiSize={24} />
                </div>

                <div className="lp-main">
                  <div className="lp-nom">{p.nom}</div>
                  <div className="lp-meta">
                    {p.categorie} · {p.origine}
                    {p.prix_gros && <span className="lp-gros"> · Lot de {p.qte_min_gros}</span>}
                  </div>
                  <div className="lp-tags">
                    <span className={vendus > 0 ? 'lp-vendus' : 'lp-zero'}>
                      {vendus > 0 ? `${vendus} vendu${vendus > 1 ? 's' : ''}` : 'Jamais vendu'}
                    </span>
                    {(!p.images || p.images.length === 0) && <span className="lp-sans-photo">Sans photo</span>}
                  </div>
                </div>

                <div className="lp-prix">
                  <b>{formatKMF(p.prix_detail)} KMF</b>
                  {p.prix_gros && (
                    <span className="lp-prix-gros">en lot : {formatKMF(prixPieceEnLot(p))} KMF/pièce</span>
                  )}
                </div>

                <button onClick={() => onToggleActif(p)} className={`lp-statut ${p.actif ? 'statut-on' : 'statut-off'}`}
                  aria-label={p.actif ? `${p.nom} est en ligne, cliquer pour masquer` : `${p.nom} est masqué, cliquer pour mettre en ligne`}>
                  {p.actif ? '● En ligne' : '○ Masqué'}
                </button>

                <div className="lp-actions">
                  <button onClick={() => onModifier(p)} className="lp-btn">✏️ Modifier</button>
                  <button onClick={() => onSupprimer(p)} className="lp-btn lp-btn-danger" aria-label={`Supprimer ${p.nom}`}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ─────────── CSS (préfixes lf- pour les filtres, lp- pour les lignes) ─────────── */
const css = `
  /* ── Filtres ── */
  .lf-box {
    background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 14px;
    display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;
  }
  .lf-search { position: relative; }
  .lf-search-icone { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 14px; }
  .lf-search-input { padding-left: 38px; }

  .lf-ligne { display: flex; flex-wrap: wrap; gap: 10px; }
  .lf-select { flex: 1 1 180px; width: auto; }

  .lf-segment {
    display: flex; background: ${C.sand}; border-radius: 10px; padding: 3px; gap: 2px;
    flex: 1 1 100%;
  }
  .lf-seg {
    flex: 1; border: none; background: none; cursor: pointer; font-family: inherit;
    font-size: 13px; font-weight: 600; color: ${C.inkSoft};
    padding: 9px 8px; border-radius: 8px; white-space: nowrap;
  }
  .lf-seg-on { background: #fff; color: ${C.inkDeep}; box-shadow: 0 1px 3px rgba(20,58,75,0.12); }
  .lf-seg-nb { font-size: 11.5px; color: ${C.inkSoft}; font-weight: 700; margin-left: 2px; }

  .lf-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .lf-chip {
    border: 1.5px solid ${C.line}; background: #fff; cursor: pointer; font-family: inherit;
    font-size: 12.5px; font-weight: 600; color: ${C.inkDeep};
    padding: 8px 12px; border-radius: 20px;
  }
  .lf-chip-on { border-color: ${C.ink}; background: #E7EFF2; color: ${C.ink}; }

  .lf-resume {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    font-size: 13px; color: ${C.inkSoft}; margin: 0 2px 10px;
  }
  .lf-reset {
    background: none; border: none; cursor: pointer; font-family: inherit;
    font-size: 13px; font-weight: 700; color: ${C.clay}; padding: 6px 0;
  }

  /* ── Liste ── */
  .empty { text-align: center; padding: 50px 20px; }
  .empty-emoji { font-size: 44px; margin-bottom: 10px; }
  .empty-title { font-size: 15px; font-weight: 700; color: ${C.inkSoft}; }

  .liste { display: flex; flex-direction: column; gap: 10px; }
  .ligne-produit {
    background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 12px 16px 12px 12px;
    display: grid; grid-template-columns: 56px 1fr auto auto auto; gap: 14px; align-items: center;
  }
  .ligne-inactive { opacity: 0.55; }

  .lp-thumb {
    width: 56px; height: 56px; border-radius: 10px; overflow: hidden;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }
  .lp-main { min-width: 0; }
  .lp-nom { font-size: 14.5px; font-weight: 700; color: ${C.inkDeep}; }
  .lp-meta { font-size: 12px; color: ${C.inkSoft}; margin-top: 3px; }
  .lp-gros { color: ${C.goldDeep}; font-weight: 600; }
  .lp-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; font-size: 11.5px; font-weight: 600; }
  .lp-vendus { color: ${C.leaf}; }
  .lp-zero { color: ${C.inkSoft}; }
  .lp-sans-photo { color: ${C.clay}; }

  .lp-prix { text-align: right; white-space: nowrap; }
  .lp-prix b { font-size: 14px; color: ${C.inkDeep}; }
  .lp-prix-gros { display: block; font-size: 11px; color: ${C.inkSoft}; margin-top: 2px; }

  .lp-statut {
    border: none; cursor: pointer; padding: 7px 12px; border-radius: 20px;
    font-size: 11.5px; font-weight: 700; font-family: inherit; white-space: nowrap;
  }
  .statut-on { background: #E8F5EE; color: ${C.leaf}; }
  .statut-off { background: #F2F3F5; color: ${C.inkSoft}; }

  .lp-actions { display: flex; gap: 6px; }
  .lp-btn {
    background: ${C.sand}; border: none; cursor: pointer; padding: 8px 12px;
    border-radius: 8px; font-size: 12.5px; font-weight: 600; color: ${C.inkDeep}; font-family: inherit;
    white-space: nowrap;
  }
  .lp-btn-danger { color: ${C.clay}; }
  .lp-btn-danger:hover { background: #FDECEB; }

  @media (min-width: 800px) {
    .lf-segment { flex: 0 0 auto; }
  }

  @media (max-width: 700px) {
    .ligne-produit { grid-template-columns: 56px 1fr; }
    .lp-prix, .lp-statut, .lp-actions { grid-column: 1 / -1; }
    .lp-prix { text-align: left; }
    .lp-statut { justify-self: start; }
    .lp-actions { justify-content: flex-start; }
  }
`