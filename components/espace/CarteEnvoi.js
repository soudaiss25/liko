/* ─────────── components/espace/CarteEnvoi.js ───────────
   Carte résumé d'un envoi, cliquable. Utilisée par l'espace étranger
   ET l'espace Comores (et plus tard l'admin).

   Utilisation :
     <CarteEnvoi envoi={e} nbProduits={3} nbPieces={40} onOuvrir={() => …} libelleAction="Réceptionner" />
*/

import { STATUTS_ENVOI, referenceEnvoi, formatDateCourte, estEnRetard } from '@/lib/envois'

import { C } from '@/lib/theme'
export default function CarteEnvoi({ envoi, nbProduits, nbPieces, onOuvrir, libelleAction = 'Voir' }) {
  const statut = STATUTS_ENVOI[envoi.statut] || STATUTS_ENVOI.brouillon
  const retard = estEnRetard(envoi)

  // La ligne de dates change selon l'étape de l'envoi
  let dates = ''
  if (envoi.statut === 'brouillon') dates = `Créé le ${formatDateCourte(envoi.created_at)}`
  else if (envoi.statut === 'en_route') dates = `Parti le ${formatDateCourte(envoi.date_depart)} · arrivée prévue ${formatDateCourte(envoi.date_arrivee_estimee)}`
  else dates = `Reçu le ${formatDateCourte(envoi.recu_le)}`

  return (
    <button onClick={onOuvrir} className={`ce-carte ${retard ? 'ce-retard' : ''}`}>
      <style href="carte-envoi" precedence="default">{css}</style>

      <span className="ce-haut">
        <b className="ce-ref">{referenceEnvoi(envoi)}</b>
        <span className={`badge badge-${statut.ton}`}>{statut.label}</span>
        {retard && <span className="badge badge-rouge">En retard</span>}
      </span>

      <span className="ce-ligne">
        Origine : {envoi.pays_origine}
        {envoi.transporteur && ` · ${envoi.transporteur}`}
        {envoi.numero_suivi && ` · n° ${envoi.numero_suivi}`}
      </span>
      <span className="ce-ligne ce-fort">
        {nbProduits} produit{nbProduits > 1 ? 's' : ''} · {nbPieces} pièce{nbPieces > 1 ? 's' : ''}
      </span>
      <span className="ce-ligne ce-doux">{dates}</span>

      <span className="ce-action" aria-hidden="true">{libelleAction} ›</span>
    </button>
  )
}

const css = `
  .ce-carte {
    display: flex; flex-direction: column; align-items: flex-start; gap: 5px; width: 100%;
    background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 14px 16px;
    margin-bottom: 10px; cursor: pointer; text-align: left; font-family: inherit; color: ${C.inkDeep};
    position: relative;
  }
  .ce-carte:hover { border-color: ${C.inkSoft}; }
  .ce-retard { border-left: 4px solid ${C.clay}; }
  .ce-haut { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px; }
  .ce-ref { font-size: 15px; font-weight: 800; letter-spacing: 0.3px; }
  .ce-ligne { font-size: 14px; color: ${C.inkDeep}; }
  .ce-fort { font-weight: 700; }
  .ce-doux { color: ${C.inkSoft}; font-size: 13px; }
  .ce-action {
    align-self: flex-end; margin-top: 4px; font-size: 14px; font-weight: 800; color: ${C.ink};
  }
`