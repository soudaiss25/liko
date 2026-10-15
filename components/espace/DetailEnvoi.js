/* ─────────── components/espace/DetailEnvoi.js ───────────
   Fiche détaillée d'un envoi, en lecture seule.
   Partagée par l'espace étranger (avec les prix) et l'espace Comores (sans les prix).

   lignes = [{ id, nom, categorie, images, quantite_envoyee, quantite_recue,
               motif_ecart, note_ecart, prix_achat_unitaire? }]
*/

import ProduitImage from '@/components/ProduitImage'
import {
  STATUTS_ENVOI, referenceEnvoi, formatDateCourte, estEnRetard,
  labelMotif, totalPieces,
} from '@/lib/envois'
import { flagPour, formatKMF } from '@/lib/produit'

import { C } from '@/lib/theme'
export default function DetailEnvoi({ envoi, lignes, afficherPrix = false, onRetour }) {
  const statut = STATUTS_ENVOI[envoi.statut] || STATUTS_ENVOI.brouillon
  const recu = envoi.statut === 'recu' || envoi.statut === 'recu_avec_ecarts'
  const retard = estEnRetard(envoi)

  const envoye = totalPieces(lignes, 'quantite_envoyee')
  const arrive = totalPieces(lignes, 'quantite_recue')
  const coutTotal = lignes.reduce(
    (s, l) => s + (Number(l.quantite_envoyee) || 0) * (Number(l.prix_achat_unitaire) || 0), 0
  )

  const infos = [
    ['Pays de départ', flagPour(envoi.pays_origine)],
    ['Fournisseur', envoi.fournisseur],
    ['Transporteur', envoi.transporteur],
    ['N° de suivi', envoi.numero_suivi],
    ['Départ', formatDateCourte(envoi.date_depart)],
    ['Arrivée prévue', formatDateCourte(envoi.date_arrivee_estimee)],
    recu && ['Reçu le', formatDateCourte(envoi.recu_le)],
  ].filter((i) => i && i[1])

  return (
    <section aria-labelledby="titre-detail">
      <style href="detail-envoi" precedence="default">{css}</style>

      <button onClick={onRetour} className="btn-secondary de-retour">← Retour</button>

      <div className="de-head">
        <h1 id="titre-detail" className="page-title">{referenceEnvoi(envoi)}</h1>
        <span className={`badge badge-${statut.ton}`}>{statut.label}</span>
        {retard && <span className="badge badge-rouge">En retard</span>}
      </div>

      <div className="carte">
        <dl className="de-infos">
          {infos.map(([label, valeur]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{valeur}</dd>
            </div>
          ))}
        </dl>
        {envoi.note && <p className="de-note">📝 {envoi.note}</p>}
      </div>

      <div className="carte">
        <h2 className="carte-titre">Contenu</h2>
        <ul className="de-lignes">
          {lignes.map((l) => {
            const ecart = recu && l.quantite_recue !== l.quantite_envoyee
            return (
              <li key={l.id} className={`de-ligne ${ecart ? 'de-ligne-ecart' : ''}`}>
                <div className="de-thumb"><ProduitImage produit={l} emojiSize={20} /></div>
                <div className="de-info">
                  <b>{l.nom}</b>
                  {afficherPrix && l.prix_achat_unitaire != null && (
                    <span>{formatKMF(l.prix_achat_unitaire)} KMF / pièce</span>
                  )}
                  {ecart && (
                    <span className="de-ecart">
                      {labelMotif(l.motif_ecart)}{l.note_ecart ? ` — ${l.note_ecart}` : ''}
                    </span>
                  )}
                </div>
                <div className="de-qte">
                  {recu ? (
                    <>
                      <b className={ecart ? 'de-rouge' : 'de-vert'}>{l.quantite_recue}</b>
                      <span>/ {l.quantite_envoyee} envoyés</span>
                    </>
                  ) : (
                    <>
                      <b>{l.quantite_envoyee}</b>
                      <span>pièces</span>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="de-total">
          {recu ? (
            <span>{arrive} pièce{arrive > 1 ? 's' : ''} reçue{arrive > 1 ? 's' : ''} sur {envoye} envoyée{envoye > 1 ? 's' : ''}</span>
          ) : (
            <span>{envoye} pièce{envoye > 1 ? 's' : ''} au total</span>
          )}
          {afficherPrix && coutTotal > 0 && <b>{formatKMF(coutTotal)} KMF d'achat</b>}
        </div>
      </div>

      {envoi.statut === 'en_route' && (
        <p className="de-attente">⏳ En attente de réception aux Comores.</p>
      )}
    </section>
  )
}

const css = `
  .de-retour { margin-bottom: 14px; }
  .de-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }

  .de-infos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 0; }
  .de-infos dt { font-size: 11.5px; color: ${C.inkSoft}; font-weight: 600; }
  .de-infos dd { margin: 2px 0 0; font-size: 14px; font-weight: 700; color: ${C.inkDeep}; word-break: break-word; }
  .de-note { font-size: 13px; color: ${C.inkSoft}; background: ${C.sand}; border-radius: 10px; padding: 10px 12px; margin: 14px 0 0; }

  .de-lignes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .de-ligne { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 10px; }
  .de-ligne-ecart { background: #FBF0EE; }
  .de-thumb {
    width: 46px; height: 46px; border-radius: 9px; overflow: hidden; flex-shrink: 0;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }
  .de-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .de-info b { font-size: 14px; }
  .de-info span { font-size: 12px; color: ${C.inkSoft}; }
  .de-info .de-ecart { color: ${C.clay}; font-weight: 700; }
  .de-qte { text-align: right; display: flex; flex-direction: column; flex-shrink: 0; }
  .de-qte b { font-size: 17px; font-weight: 800; }
  .de-qte span { font-size: 11.5px; color: ${C.inkSoft}; }
  .de-vert { color: ${C.leaf}; }
  .de-rouge { color: ${C.clay}; }

  .de-total {
    display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;
    border-top: 1px solid ${C.line}; margin-top: 14px; padding-top: 12px;
    font-size: 13.5px; color: ${C.inkSoft};
  }
  .de-total b { color: ${C.inkDeep}; }
  .de-attente { text-align: center; font-size: 13.5px; color: ${C.inkSoft}; }
`