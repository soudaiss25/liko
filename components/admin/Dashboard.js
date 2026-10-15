'use client'

/* ─────────── components/admin/Dashboard.js ───────────
   Tableau de bord de l'admin. Il ne charge rien lui-même :
   la page admin lui donne produits, commandes et items,
   et lui se contente de CALCULER et d'AFFICHER.

   Zoning (de haut en bas) :
   1. Choix de la période (7 j / 30 j / tout / personnalisée)
   2. 4 chiffres clés
   3. "À faire" : les actions concrètes, avec un bouton qui ouvre la liste filtrée
   4. Top 5 des produits les plus vendus  +  ventes par île
*/

import { useState } from 'react'
import ProduitImage from '@/components/ProduitImage'
import { calculerVentes, STATUT_A_TRAITER } from '@/lib/ventes'
import { formatKMF, normaliserTexte } from '@/lib/produit'

import { C } from '@/lib/theme'
const UN_JOUR = 24 * 60 * 60 * 1000

const PERIODES = [
  { id: '7', label: '7 jours', jours: 7 },
  { id: '30', label: '30 jours', jours: 30 },
  { id: 'tout', label: 'Depuis le début', jours: null },
  { id: 'perso', label: 'Personnalisée', jours: null },
]

const ILES = [
  { valeur: 'Grande Comore', label: 'Grande Comore' },
  { valeur: 'Anjouan', label: 'Anjouan' },
  { valeur: 'Moheli', label: 'Mohéli' },
]

/* ─────────── Outils dates ───────────
   Un <input type="date"> travaille avec du texte "2026-09-23".
   Ces 3 fonctions font la traduction texte ⇄ vraie date. */

// Date → "2026-09-23" (en heure locale, pas en heure de Londres)
function versTexteDate(date) {
  const a = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const j = String(date.getDate()).padStart(2, '0')
  return `${a}-${m}-${j}`
}

// "2026-09-23" → Date à 00:00:00 (ou à 23:59:59 si finDeJournee)
function depuisTexteDate(texte, finDeJournee = false) {
  if (!texte) return null
  const [a, m, j] = texte.split('-').map(Number)
  return finDeJournee ? new Date(a, m - 1, j, 23, 59, 59, 999) : new Date(a, m - 1, j)
}

// "2026-09-23" → "23 sept. 2026"
function texteLisible(texte) {
  const d = depuisTexteDate(texte)
  return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

export default function Dashboard({ produits, commandes, items, onVoirProduits, onActualiser }) {
  const aujourdhui = versTexteDate(new Date())

  const [periode, setPeriode] = useState('30')
  // Par défaut, la période personnalisée = les 30 derniers jours
  const [dateDebut, setDateDebut] = useState(versTexteDate(new Date(Date.now() - 30 * UN_JOUR)))
  const [dateFin, setDateFin] = useState(aujourdhui)

  /* Si on met un début après la fin (ou l'inverse), on corrige tout seul
     au lieu d'afficher une erreur : plus simple pour l'utilisateur. */
  const changerDebut = (valeur) => {
    setDateDebut(valeur)
    if (valeur && dateFin && valeur > dateFin) setDateFin(valeur)
  }
  const changerFin = (valeur) => {
    setDateFin(valeur)
    if (valeur && dateDebut && valeur < dateDebut) setDateDebut(valeur)
  }

  /* Raccourcis de la période personnalisée */
  const ceMois = () => {
    const d = new Date()
    setDateDebut(versTexteDate(new Date(d.getFullYear(), d.getMonth(), 1)))
    setDateFin(aujourdhui)
  }
  const moisDernier = () => {
    const d = new Date()
    setDateDebut(versTexteDate(new Date(d.getFullYear(), d.getMonth() - 1, 1)))
    setDateFin(versTexteDate(new Date(d.getFullYear(), d.getMonth(), 0))) // jour 0 = dernier jour du mois d'avant
  }

  /* ── Période choisie → dates de début et de fin ── */
  let depuis = null
  let jusqua = null
  if (periode === 'perso') {
    depuis = depuisTexteDate(dateDebut)
    jusqua = depuisTexteDate(dateFin, true)
  } else {
    const choix = PERIODES.find((p) => p.id === periode)
    if (choix.jours) depuis = new Date(Date.now() - choix.jours * UN_JOUR)
  }

  /* ── Calculs ── */
  const stats = calculerVentes({ commandes, items, produits, depuis, jusqua })
  const ventesToutTemps = calculerVentes({ commandes, items, produits }).parProduit

  // Top 5 : on trie les produits vendus par nombre de pièces
  const produitParId = Object.fromEntries(produits.map((p) => [p.id, p]))
  const top = Object.entries(stats.parProduit)
    .map(([id, v]) => ({ id, ...v, produit: produitParId[id] }))
    .sort((a, b) => b.pieces - a.pieces)
    .slice(0, 5)
  const maxPieces = top.length > 0 ? top[0].pieces : 1

  // Ventes par île (on compare sans accents : "Mohéli" = "Moheli")
  const parIle = ILES.map((ile) => {
    const cmds = stats.valides.filter((c) => normaliserTexte(c.ile) === normaliserTexte(ile.valeur))
    return {
      ...ile,
      nb: cmds.length,
      ca: cmds.reduce((s, c) => s + (Number(c.montant_total) || 0), 0),
    }
  })
  const maxIle = Math.max(1, ...parIle.map((i) => i.nb))

  // À faire (toujours sur toute la boutique, peu importe la période)
  const aTraiter = commandes.filter((c) => c.statut === STATUT_A_TRAITER).length
  const sansPhoto = produits.filter((p) => p.actif && (!p.images || p.images.length === 0)).length
  const masques = produits.filter((p) => !p.actif).length
  const jamaisVendus = produits.filter((p) => p.actif && !ventesToutTemps[p.id]).length

  const taches = [
    aTraiter > 0 && {
      icone: '🛎️', texte: `${aTraiter} commande${aTraiter > 1 ? 's' : ''} à confirmer`,
      detail: 'Statut « reçue », en attente de ton équipe',
    },
    sansPhoto > 0 && {
      icone: '📷', texte: `${sansPhoto} produit${sansPhoto > 1 ? 's' : ''} en ligne sans photo`,
      detail: 'Un produit sans photo se vend beaucoup moins',
      action: () => onVoirProduits({ sansPhoto: true, statut: 'en_ligne' }),
    },
    jamaisVendus > 0 && {
      icone: '💤', texte: `${jamaisVendus} produit${jamaisVendus > 1 ? 's' : ''} jamais vendu${jamaisVendus > 1 ? 's' : ''}`,
      detail: 'Photo, prix ou description à revoir ?',
      action: () => onVoirProduits({ jamaisVendu: true, statut: 'en_ligne' }),
    },
    masques > 0 && {
      icone: '🙈', texte: `${masques} produit${masques > 1 ? 's' : ''} masqué${masques > 1 ? 's' : ''}`,
      detail: 'Invisibles pour les clients',
      action: () => onVoirProduits({ statut: 'masques' }),
    },
  ].filter(Boolean)

  const aucuneVente = stats.nbCommandes === 0

  // Phrase qui rappelle la période affichée
  const resumePeriode =
    periode === 'perso'
      ? dateDebut === dateFin
        ? `Le ${texteLisible(dateDebut)}`
        : `Du ${texteLisible(dateDebut)} au ${texteLisible(dateFin)}`
      : periode === 'tout'
        ? 'Depuis l\u2019ouverture de la boutique'
        : `Sur les ${periode} derniers jours`

  return (
    <section aria-labelledby="titre-dashboard">
      <style href="admin-dashboard" precedence="default">{css}</style>

      {/* ── En-tête ── */}
      <div className="page-head">
        <div>
          <h1 id="titre-dashboard" className="page-title">Tableau de bord</h1>
          <p className="page-sub">{resumePeriode}</p>
        </div>
        <button onClick={onActualiser} className="btn-secondary">↻ Actualiser</button>
      </div>

      {/* ── Choix de la période ── */}
      <div className="db-periodes" role="group" aria-label="Période">
        {PERIODES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriode(p.id)}
            aria-pressed={periode === p.id}
            className={`db-periode ${periode === p.id ? 'db-periode-on' : ''}`}
          >
            {p.id === 'perso' && <span aria-hidden="true">📅 </span>}
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Dates personnalisées (visibles seulement si "Personnalisée") ── */}
      {periode === 'perso' && (
        <div className="db-perso">
          <div className="db-perso-dates">
            <div className="db-perso-champ">
              <label className="label" htmlFor="date-debut">Du</label>
              <input
                id="date-debut"
                type="date"
                className="input"
                value={dateDebut}
                max={aujourdhui}
                onChange={(e) => changerDebut(e.target.value)}
              />
            </div>
            <div className="db-perso-champ">
              <label className="label" htmlFor="date-fin">Au</label>
              <input
                id="date-fin"
                type="date"
                className="input"
                value={dateFin}
                min={dateDebut}
                max={aujourdhui}
                onChange={(e) => changerFin(e.target.value)}
              />
            </div>
          </div>
          <div className="db-perso-raccourcis">
            <span>Raccourcis :</span>
            <button onClick={ceMois} className="db-raccourci">Ce mois-ci</button>
            <button onClick={moisDernier} className="db-raccourci">Mois dernier</button>
          </div>
        </div>
      )}

      {/* ── 1. Chiffres clés ── */}
      <div className="db-kpis">
        <div className="db-kpi">
          <span className="db-kpi-label">Chiffre d'affaires</span>
          <b className="db-kpi-val">{formatKMF(stats.ca)} <small>KMF</small></b>
          <span className="db-kpi-sub">hors commandes annulées</span>
        </div>
        <div className="db-kpi">
          <span className="db-kpi-label">Commandes</span>
          <b className="db-kpi-val">{stats.nbCommandes}</b>
          <span className={`db-kpi-sub ${aTraiter > 0 ? 'db-kpi-alerte' : ''}`}>
            {aTraiter > 0 ? `${aTraiter} à confirmer` : 'toutes traitées'}
          </span>
        </div>
        <div className="db-kpi">
          <span className="db-kpi-label">Panier moyen</span>
          <b className="db-kpi-val">{formatKMF(stats.panierMoyen)} <small>KMF</small></b>
          <span className="db-kpi-sub">par commande</span>
        </div>
        <div className="db-kpi">
          <span className="db-kpi-label">Marge estimée</span>
          <b className={`db-kpi-val ${stats.marge > 0 ? 'db-kpi-positif' : ''}`}>
            {formatKMF(stats.marge)} <small>KMF</small>
          </b>
          <span className="db-kpi-sub">
            {stats.margePartielle ? 'prix d\u2019achat manquant sur certains produits' : 'vente − prix d\u2019achat'}
          </span>
        </div>
      </div>

      {aucuneVente && (
        <p className="db-info">
          Aucune vente sur cette période. Les chiffres se rempliront dès la prochaine commande.
        </p>
      )}

      {/* ── 2. À faire ── */}
      <div className="db-panel">
        <h2 className="db-panel-title">À faire</h2>
        {taches.length === 0 ? (
          <p className="db-vide">✓ Rien à signaler, tout est en ordre.</p>
        ) : (
          <ul className="db-taches">
            {taches.map((t) => (
              <li key={t.texte} className="db-tache">
                <span className="db-tache-icone" aria-hidden="true">{t.icone}</span>
                <div className="db-tache-texte">
                  <b>{t.texte}</b>
                  <span>{t.detail}</span>
                </div>
                {t.action && (
                  <button onClick={t.action} className="db-tache-btn">Voir</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 3. Top produits + îles ── */}
      <div className="db-duo">
        <div className="db-panel">
          <h2 className="db-panel-title">Les plus vendus</h2>
          {top.length === 0 ? (
            <p className="db-vide">Pas encore de vente sur cette période.</p>
          ) : (
            <ol className="db-top">
              {top.map((t, i) => (
                <li key={t.id} className="db-top-ligne">
                  <span className="db-top-rang">{i + 1}</span>
                  <div className="db-top-thumb">
                    {t.produit ? <ProduitImage produit={t.produit} emojiSize={20} /> : <span aria-hidden="true">🗑</span>}
                  </div>
                  <div className="db-top-info">
                    <div className="db-top-nom">{t.produit ? t.produit.nom : 'Produit supprimé'}</div>
                    <div className="db-barre" aria-hidden="true">
                      <div className="db-barre-remplie" style={{ width: `${(t.pieces / maxPieces) * 100}%` }} />
                    </div>
                  </div>
                  <div className="db-top-chiffres">
                    <b>{t.pieces} pcs</b>
                    <span>{formatKMF(t.ca)} KMF</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="db-panel">
          <h2 className="db-panel-title">Commandes par île</h2>
          <ul className="db-iles">
            {parIle.map((ile) => (
              <li key={ile.valeur} className="db-ile">
                <div className="db-ile-haut">
                  <span>{ile.label}</span>
                  <b>{ile.nb} cmd</b>
                </div>
                <div className="db-barre" aria-hidden="true">
                  <div className="db-barre-remplie db-barre-or" style={{ width: `${(ile.nb / maxIle) * 100}%` }} />
                </div>
                <span className="db-ile-ca">{formatKMF(ile.ca)} KMF</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ─────────── CSS (préfixe db-) ─────────── */
const css = `
  .db-periodes {
    display: inline-flex; background: #fff; border: 1px solid ${C.line}; border-radius: 10px;
    padding: 3px; gap: 2px; margin-bottom: 14px; max-width: 100%; overflow-x: auto;
  }
  .db-periode {
    border: none; background: none; cursor: pointer; font-family: inherit;
    font-size: 13px; font-weight: 600; color: ${C.inkSoft};
    padding: 9px 14px; border-radius: 8px; white-space: nowrap;
  }
  .db-periode-on { background: ${C.ink}; color: #fff; }

  /* Période personnalisée */
  .db-perso {
    background: #fff; border: 1px solid ${C.line}; border-radius: 14px;
    padding: 14px 16px; margin-bottom: 14px;
  }
  .db-perso-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .db-perso-champ .label { margin-bottom: 6px; }
  .db-perso-raccourcis {
    display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
    margin-top: 12px; font-size: 12.5px; color: ${C.inkSoft};
  }
  .db-raccourci {
    border: 1.5px solid ${C.line}; background: #fff; cursor: pointer; font-family: inherit;
    font-size: 12.5px; font-weight: 600; color: ${C.inkDeep};
    padding: 7px 12px; border-radius: 20px;
  }
  .db-raccourci:hover { border-color: ${C.ink}; color: ${C.ink}; }

  /* Chiffres clés : 2 colonnes sur mobile, 4 sur grand écran */
  .db-kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .db-kpi {
    background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 16px;
    display: flex; flex-direction: column; gap: 4px; min-width: 0;
  }
  .db-kpi-label { font-size: 12px; font-weight: 600; color: ${C.inkSoft}; }
  .db-kpi-val { font-size: 22px; font-weight: 800; color: ${C.inkDeep}; line-height: 1.15; }
  .db-kpi-val small { font-size: 12px; font-weight: 600; color: ${C.inkSoft}; }
  .db-kpi-positif { color: ${C.leaf}; }
  .db-kpi-sub { font-size: 11.5px; color: ${C.inkSoft}; line-height: 1.35; }
  .db-kpi-alerte { color: ${C.goldDeep}; font-weight: 700; }

  .db-info {
    font-size: 13px; color: ${C.inkSoft}; background: #fff; border: 1px dashed ${C.line};
    border-radius: 12px; padding: 12px 14px; margin: 0 0 14px;
  }

  .db-panel { background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 18px; margin-bottom: 14px; min-width: 0; }
  .db-panel-title { font-size: 15px; font-weight: 800; color: ${C.inkDeep}; margin: 0 0 14px; }
  .db-vide { font-size: 13.5px; color: ${C.inkSoft}; margin: 0; }

  /* À faire */
  .db-taches { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .db-tache {
    display: flex; align-items: center; gap: 12px;
    background: ${C.sand}; border-radius: 10px; padding: 10px 12px;
  }
  .db-tache-icone { font-size: 20px; }
  .db-tache-texte { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .db-tache-texte b { font-size: 13.5px; color: ${C.inkDeep}; }
  .db-tache-texte span { font-size: 12px; color: ${C.inkSoft}; }
  .db-tache-btn {
    background: ${C.ink}; color: #fff; border: none; cursor: pointer; font-family: inherit;
    font-size: 12.5px; font-weight: 700; padding: 9px 14px; border-radius: 8px; flex-shrink: 0;
  }

  .db-duo { display: grid; grid-template-columns: 1fr; gap: 0 14px; }

  /* Barres de progression (partagées top + îles) */
  .db-barre { height: 6px; background: ${C.sand}; border-radius: 3px; overflow: hidden; margin-top: 6px; }
  .db-barre-remplie { height: 100%; background: ${C.ink}; border-radius: 3px; }
  .db-barre-or { background: ${C.gold}; }

  /* Top produits */
  .db-top { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .db-top-ligne { display: flex; align-items: center; gap: 10px; }
  .db-top-rang { width: 18px; font-size: 13px; font-weight: 800; color: ${C.inkSoft}; text-align: center; flex-shrink: 0; }
  .db-top-ligne:first-child .db-top-rang { color: ${C.goldDeep}; }
  .db-top-thumb {
    width: 42px; height: 42px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }
  .db-top-info { flex: 1; min-width: 0; }
  .db-top-nom { font-size: 13.5px; font-weight: 700; color: ${C.inkDeep}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .db-top-chiffres { text-align: right; display: flex; flex-direction: column; flex-shrink: 0; }
  .db-top-chiffres b { font-size: 13.5px; color: ${C.inkDeep}; }
  .db-top-chiffres span { font-size: 11.5px; color: ${C.inkSoft}; }

  /* Îles */
  .db-iles { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .db-ile-haut { display: flex; justify-content: space-between; font-size: 13.5px; color: ${C.inkDeep}; }
  .db-ile-haut b { font-weight: 800; }
  .db-ile-ca { display: block; font-size: 11.5px; color: ${C.inkSoft}; margin-top: 4px; }

  @media (min-width: 800px) {
    .db-kpis { grid-template-columns: repeat(4, 1fr); }
    .db-duo { grid-template-columns: 3fr 2fr; }
    .db-kpi-val { font-size: 24px; }
    .db-perso { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .db-perso-dates { flex: 0 1 420px; }
    .db-perso-raccourcis { margin-top: 0; }
  }
`