'use client'

/* ─────────── components/commande/BlocPaiements.js ───────────
   L'argent d'une commande avec avance, vu par l'admin ET par les Comores :
   - bloc "Avance" : demandée / reçue / reste, formulaire "Enregistrer une avance"
   - bloc "Remboursement à faire" (commande annulée) + formulaire
   - historique des mouvements (paiements_commande)

   Les règles (montants, délais, droits) sont vérifiées par la base : ici on prépare la saisie
   et on traduit les erreurs.

   Props :
     commande  → la commande (montant_avance_requis, montant_avance_recu, montant_a_rembourser,
                 montant_rembourse, statut, numero, id)
     executer  → async (fonction, params, texteSucces) : appelle la base, affiche le message et
                 recharge ; peut renvoyer true/false
     occupe    → true pendant un appel (désactive les boutons)
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { MOYENS_PAIEMENT, referenceCommande, formatDate, messageErreurCommande } from '@/lib/commandes'
import { avanceNette, avanceReste, remboursementReste } from '@/lib/avance'
import { formatKMF } from '@/lib/produit'
import { C } from '@/lib/theme'

export default function BlocPaiements({ commande: c, executer, occupe }) {
  const supabase = createClient()
  const ref = referenceCommande(c.numero)

  const reste = avanceReste(c)
  const aRendre = remboursementReste(c)
  const peutRecevoirAvance = c.statut === 'recue' && Number(c.montant_avance_requis) > 0 && reste > 0
  const peutRembourser = c.statut === 'annulee' && aRendre > 0

  const [historique, setHistorique] = useState([])
  useEffect(() => {
    let actif = true
    supabase.rpc('paiements_commande', { p_commande: c.id }).then(({ data }) => {
      if (actif) setHistorique(Array.isArray(data) ? data : [])
    })
    return () => { actif = false }
  }, [c.id, c.montant_avance_recu, c.montant_rembourse])

  // Rien à montrer : pas d'avance demandée, pas de remboursement, pas d'historique
  if (!(Number(c.montant_avance_requis) > 0) && !(Number(c.montant_a_rembourser) > 0) && historique.length === 0) return null

  return (
    <div className="bp-carte">
      <style href="bloc-paiements" precedence="default">{css}</style>

      {Number(c.montant_avance_requis) > 0 && (
        <>
          <h2 className="bp-titre">Avance</h2>
          <dl className="bp-chiffres">
            <div><dt>Demandée</dt><dd>{formatKMF(c.montant_avance_requis)} KMF</dd></div>
            <div><dt>Reçue</dt><dd>{formatKMF(avanceNette(c))} KMF</dd></div>
            <div className={reste > 0 ? 'bp-reste' : ''}><dt>Reste</dt><dd>{formatKMF(reste)} KMF</dd></div>
          </dl>
        </>
      )}

      {peutRecevoirAvance && (
        <FormulaireMouvement
          key={`avance-${c.id}-${reste}`}
          cle={`avance-${c.id}-${reste}`}
          titre="Enregistrer une avance"
          bouton="Enregistrer l'avance"
          maximum={reste}
          erreurTrop="AVANCE_TROP_ELEVEE"
          occupe={occupe}
          onValider={({ montant, moyen, reference }) =>
            executer('enregistrer_avance',
              { p_commande: c.id, p_montant: montant, p_moyen: moyen, p_reference: reference || null },
              `${ref} : avance de ${formatKMF(montant)} KMF enregistrée.`)}
        />
      )}

      {peutRembourser && (
        <div className="bp-remb">
          <h2 className="bp-titre">Remboursement à faire : {formatKMF(aRendre)} KMF</h2>
          <p className="bp-texte">Le client a annulé avant que ces produits soient achetés : son avance lui est rendue.</p>
          <FormulaireMouvement
            key={`remb-${c.id}-${aRendre}`}
            cle={`remb-${c.id}-${aRendre}`}
            titre="Enregistrer un remboursement"
            bouton="Enregistrer le remboursement"
            maximum={aRendre}
            erreurTrop="REMBOURSEMENT_TROP_ELEVE"
            occupe={occupe}
            onValider={({ montant, moyen, reference }) =>
              executer('enregistrer_remboursement',
                { p_commande: c.id, p_montant: montant, p_moyen: moyen, p_reference: reference || null },
                `${ref} : remboursement de ${formatKMF(montant)} KMF enregistré.`)}
          />
        </div>
      )}

      {c.statut === 'annulee' && Number(c.montant_rembourse) > 0 && !peutRembourser && (
        <p className="bp-texte">Remboursé : {formatKMF(c.montant_rembourse)} KMF.</p>
      )}

      {historique.length > 0 && (
        <>
          <h3 className="bp-sous-titre">Historique</h3>
          <ul className="bp-histo">
            {historique.map((h, i) => (
              <li key={i}>
                <b>{h.type === 'remboursement' ? 'Remboursement' : 'Avance'} : {formatKMF(h.montant)} KMF</b>
                <span>
                  {MOYENS_PAIEMENT[h.methode] || h.methode}
                  {h.reference ? ` · réf. ${h.reference}` : ''}
                  {' · '}{formatDate(h.created_at, true)}
                  {h.par ? ` · ${h.par}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* Formulaire commun : montant (pré-rempli avec le maximum), moyen, référence */
function FormulaireMouvement({ cle, titre, bouton, maximum, erreurTrop, occupe, onValider }) {
  const [montant, setMontant] = useState(String(maximum))
  const [moyen, setMoyen] = useState('especes')
  const [reference, setReference] = useState('')
  const [erreur, setErreur] = useState('')

  const valider = async () => {
    const valeur = Number(montant)
    if (!Number.isInteger(valeur) || valeur <= 0) { setErreur(messageErreurCommande({ message: 'MONTANT_INVALIDE' })); return }
    if (valeur > maximum) { setErreur(messageErreurCommande({ message: erreurTrop })); return }
    if (!moyen) { setErreur(messageErreurCommande({ message: 'MOYEN_INVALIDE' })); return }
    if (moyen !== 'especes' && !reference.trim()) { setErreur(messageErreurCommande({ message: 'REFERENCE_OBLIGATOIRE' })); return }
    setErreur('')
    await onValider({ montant: valeur, moyen, reference: reference.trim() })
  }

  return (
    <div className="bp-form">
      <h3 className="bp-sous-titre">{titre}</h3>
      <div className="bp-ligne">
        <div className="bp-champ">
          <label className="label" htmlFor={`${cle}-montant`}>Montant (KMF)</label>
          <input id={`${cle}-montant`} className="input" inputMode="numeric" value={montant}
            onChange={(e) => setMontant(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="bp-champ">
          <label className="label" htmlFor={`${cle}-moyen`}>Moyen de paiement</label>
          <select id={`${cle}-moyen`} className="input" value={moyen} onChange={(e) => setMoyen(e.target.value)}>
            {Object.entries(MOYENS_PAIEMENT).map(([id, libelle]) => <option key={id} value={id}>{libelle}</option>)}
          </select>
        </div>
      </div>
      <div className="bp-champ">
        <label className="label" htmlFor={`${cle}-ref`}>
          Référence de la transaction {moyen === 'especes'
            ? <span className="optional">(inutile en espèces)</span>
            : <span className="optional">(obligatoire)</span>}
        </label>
        <input id={`${cle}-ref`} className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      {erreur && <p role="alert" className="err">{erreur}</p>}
      <button onClick={valider} disabled={occupe} className="btn-primary">{bouton}</button>
    </div>
  )
}

const css = `
  .bp-carte { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .bp-titre { font-size: 18px; font-weight: 800; margin: 0 0 12px; color: ${C.inkDeep}; }
  .bp-sous-titre { font-size: 16px; font-weight: 800; margin: 16px 0 8px; color: ${C.inkDeep}; }
  .bp-texte { font-size: 15px; color: ${C.inkSoft}; line-height: 1.5; margin: 0 0 8px; }
  .bp-chiffres { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 0; }
  .bp-chiffres dt { font-size: 14px; color: ${C.inkSoft}; font-weight: 600; }
  .bp-chiffres dd { margin: 2px 0 0; font-size: 16px; font-weight: 800; color: ${C.inkDeep}; }
  .bp-reste dd { color: ${C.clay}; }
  .bp-form { border-top: 1px solid ${C.line}; margin-top: 16px; padding-top: 4px; }
  .bp-remb { border-top: 1px solid ${C.line}; margin-top: 16px; padding-top: 16px; }
  .bp-remb .bp-form { border-top: none; margin-top: 0; }
  .bp-ligne { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .bp-champ { margin-bottom: 12px; min-width: 0; }
  .bp-histo { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .bp-histo li { display: flex; flex-direction: column; gap: 2px; border-left: 3px solid ${C.line}; padding-left: 12px; }
  .bp-histo b { font-size: 15px; }
  .bp-histo span { font-size: 14px; color: ${C.inkSoft}; }
  @media (max-width: 560px) { .bp-ligne { grid-template-columns: 1fr; } }
`
