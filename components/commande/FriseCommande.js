/* ─────────── components/commande/FriseCommande.js ───────────
   La frise verticale "où en est ma commande". Utilisée par la page de suivi
   (client) et réutilisable dans l'admin.

   Props :
     statut        → statut actuel de la commande
     etapesDatees  → { recue: '2026-09-25T…', confirmee: '…', … } (date de chaque étape)
*/

import { ETAPES, indexEtape, formatDate } from '@/lib/commandes'

const C = {
  ink: '#1D4E63', inkDeep: '#143A4B', inkSoft: '#6E8A97',
  line: '#E4DED2', leaf: '#3E9268', clay: '#C2574A', gold: '#E8A020',
}

export default function FriseCommande({ statut, etapesDatees = {} }) {
  const actuelle = indexEtape(statut, etapesDatees)
  const interrompue = statut === 'annulee' || statut === 'echec_livraison'

  return (
    <ol className="fr-liste" aria-label="Étapes de la commande">
      <style href="frise-commande" precedence="default">{css}</style>
      {ETAPES.map((etape, i) => {
        const faite = i < actuelle || (i === actuelle && statut === 'livree')
        const enCours = i === actuelle && statut !== 'livree'
        const etat = faite ? 'faite' : enCours ? (interrompue ? 'bloquee' : 'en-cours') : 'a-venir'
        return (
          <li key={etape.id} className={`fr-etape fr-${etat}`} aria-current={enCours ? 'step' : undefined}>
            <span className="fr-pastille" aria-hidden="true">
              {faite ? '✓' : etat === 'bloquee' ? '!' : ''}
            </span>
            <div className="fr-texte">
              <b>{etape.titre}</b>
              {etapesDatees[etape.id] && <span className="fr-date">{formatDate(etapesDatees[etape.id], true)}</span>}
              {enCours && !interrompue && <p>{etape.detail}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

const css = `
  .fr-liste { list-style: none; margin: 0; padding: 0; }
  .fr-etape { position: relative; display: flex; gap: 14px; padding-bottom: 22px; }
  .fr-etape:last-child { padding-bottom: 0; }

  /* Le trait qui relie les pastilles */
  .fr-etape:not(:last-child)::before {
    content: ''; position: absolute; left: 13px; top: 28px; bottom: 2px; width: 2px; background: ${C.line};
  }
  .fr-faite:not(:last-child)::before { background: ${C.leaf}; }

  .fr-pastille {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; z-index: 1;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800; color: #fff;
    background: #fff; border: 2px solid ${C.line};
  }
  .fr-faite .fr-pastille { background: ${C.leaf}; border-color: ${C.leaf}; }
  .fr-en-cours .fr-pastille { border-color: ${C.gold}; box-shadow: 0 0 0 4px rgba(232,160,32,0.18); background: ${C.gold}; }
  .fr-bloquee .fr-pastille { background: ${C.clay}; border-color: ${C.clay}; }

  .fr-texte { padding-top: 3px; min-width: 0; }
  .fr-texte b { display: block; font-size: 14.5px; color: ${C.inkDeep}; }
  .fr-a-venir .fr-texte b { color: #A9B4B9; font-weight: 600; }
  .fr-date { display: block; font-size: 12px; color: ${C.inkSoft}; margin-top: 2px; }
  .fr-texte p { margin: 6px 0 0; font-size: 13px; color: ${C.inkDeep}; line-height: 1.45; }

  @media (prefers-reduced-motion: no-preference) {
    .fr-en-cours .fr-pastille { animation: fr-pouls 2.4s ease-in-out infinite; }
    @keyframes fr-pouls {
      0%, 100% { box-shadow: 0 0 0 4px rgba(232,160,32,0.18); }
      50% { box-shadow: 0 0 0 8px rgba(232,160,32,0.06); }
    }
  }
`