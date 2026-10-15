'use client'

/* ─────────── components/espace/AAcheter.js ───────────
   Onglet "À acheter" de l'espace étranger.

   Les commandes confirmées par l'admin arrivent ici, regroupées par PRODUIT :
   "20 robes à acheter" plutôt que 7 petites lignes. Le collaborateur coche
   ce qu'il achète, puis prépare un envoi avec ces lignes.

   Une ligne peut être signalée "indisponible" : l'admin décide alors quoi faire
   avec le client (la ligne sort de la liste).
*/

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import ProduitImage from '@/components/ProduitImage'
import { regrouperParProduit } from '@/lib/achats'
import { referenceEnvoi, messageErreur } from '@/lib/envois'
import { referenceCommande, texteDepuis, labelIle } from '@/lib/commandes'
import { formatKMF } from '@/lib/produit'

const C = {
  ink: '#1D4E63', inkDeep: '#143A4B', inkSoft: '#6E8A97',
  sand: '#F4F1EA', line: '#E4DED2',
  gold: '#E8A020', goldDeep: '#C6851A',
  leaf: '#3E9268', clay: '#C2574A',
}

export default function AAcheter({ lignes, brouillons, onPreparer, onRecharger, onMessage }) {
  const supabase = createClient()

  const [selection, setSelection] = useState(() => new Set()) // ids de lignes de commande cochées
  const [destination, setDestination] = useState('')          // '' = nouvel envoi, sinon id d'un brouillon
  const [indispo, setIndispo] = useState(null)                // { id, note } : ligne dont on signale l'indisponibilité
  const [occupe, setOccupe] = useState(false)

  const actives = lignes.filter((l) => l.etat !== 'indisponible')
  const indisponibles = lignes.filter((l) => l.etat === 'indisponible')
  const groupes = regrouperParProduit(actives)

  // On ne garde cochées que les lignes qui existent encore (après un rechargement)
  const cochees = actives.filter((l) => selection.has(l.id))
  const nbPieces = cochees.reduce((s, l) => s + (Number(l.quantite) || 0), 0)

  const basculer = (id) => {
    const suite = new Set(selection)
    if (suite.has(id)) suite.delete(id)
    else suite.add(id)
    setSelection(suite)
  }

  const basculerGroupe = (groupe) => {
    const suite = new Set(selection)
    const toutCoche = groupe.lignes.every((l) => suite.has(l.id))
    groupe.lignes.forEach((l) => (toutCoche ? suite.delete(l.id) : suite.add(l.id)))
    setSelection(suite)
  }

  const signaler = async () => {
    const ligne = actives.find((l) => l.id === indispo.id)
    const nom = ligne?.nom || 'ce produit'
    const ok = window.confirm(
      `Signaler « ${nom} » comme indisponible ?\n\nL’admin sera prévenu pour décider avec le client.`
    )
    if (!ok) return

    setOccupe(true)
    const { error } = await supabase.rpc('signaler_indisponible', {
      p_item: indispo.id,
      p_note: indispo.note.trim() || null,
    })
    setOccupe(false)

    if (error) onMessage({ type: 'err', texte: messageErreur(error) })
    else onMessage({ type: 'ok', texte: `« ${nom} » signalé indisponible. L’admin va décider.` })
    setIndispo(null)
    onRecharger()
  }

  if (lignes.length === 0) {
    return (
      <div className="vide">
        <div className="vide-emoji">🛍️</div>
        Rien à acheter pour le moment. Les commandes confirmées apparaîtront ici.
      </div>
    )
  }

  return (
    <>
      <style href="a-acheter" precedence="default">{css}</style>

      {groupes.length === 0 && (
        <div className="vide"><div className="vide-emoji">🛍️</div>Rien à acheter pour le moment.</div>
      )}

      {groupes.map((g) => {
        const nbCommandes = new Set(g.lignes.map((l) => l.commande_numero)).size
        const toutCoche = g.lignes.every((l) => selection.has(l.id))
        return (
          <div key={g.produit_id} className={`carte aa-groupe ${g.relancee ? 'aa-relance' : ''}`}>
            <div className="aa-tete">
              <span className="aa-thumb"><ProduitImage produit={g} emojiSize={22} /></span>
              <div className="aa-titre">
                <b>{g.nom}</b>
                <span>× {g.total} pièce{g.total > 1 ? 's' : ''} · {nbCommandes} commande{nbCommandes > 1 ? 's' : ''}</span>
                {g.prix_achat != null && <span>Prix d&apos;achat habituel : {formatKMF(g.prix_achat)} KMF</span>}
                {g.relancee && <span className="badge badge-or aa-badge">🔔 Relancé par les Comores</span>}
              </div>
              <label className="aa-tout">
                <input type="checkbox" checked={toutCoche} onChange={() => basculerGroupe(g)} />
                Tout
              </label>
            </div>

            <ul className="aa-lignes">
              {g.lignes.map((l) => (
                <li key={l.id} className="aa-ligne">
                  <label className="aa-case">
                    <input type="checkbox" checked={selection.has(l.id)} onChange={() => basculer(l.id)}
                      aria-label={`Choisir ${referenceCommande(l.commande_numero)}`} />
                    <span className="aa-detail">
                      <b>{referenceCommande(l.commande_numero)} · {l.quantite} pce{l.quantite > 1 ? 's' : ''}</b>
                      {(l.taille || l.couleur) && <span>{[l.taille, l.couleur].filter(Boolean).join(' · ')}</span>}
                      <span>{labelIle(l.ile)} · confirmée {texteDepuis(l.confirmee_le)}</span>
                      {l.relance_le && l.relance_note && <span className="aa-note">🔔 {l.relance_note}</span>}
                    </span>
                  </label>

                  {indispo?.id === l.id ? (
                    <div className="aa-indispo">
                      <input className="input" value={indispo.note} placeholder="Précision (facultatif)"
                        aria-label="Précision sur l'indisponibilité"
                        onChange={(e) => setIndispo({ id: l.id, note: e.target.value })} />
                      <div className="aa-boutons">
                        <button onClick={signaler} disabled={occupe} className="btn-danger">Confirmer : indisponible</button>
                        <button onClick={() => setIndispo(null)} disabled={occupe} className="btn-secondary">Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIndispo({ id: l.id, note: '' })} className="aa-lien">Indisponible ?</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {indisponibles.length > 0 && (
        <div className="carte">
          <h2 className="carte-titre">Signalés indisponibles</h2>
          <p className="aa-aide">En attente de la décision de l&apos;admin.</p>
          <ul className="aa-lignes">
            {indisponibles.map((l) => (
              <li key={l.id} className="aa-ligne aa-ligne-indispo">
                <b>{l.nom}</b> · {referenceCommande(l.commande_numero)} · {l.quantite} pce{l.quantite > 1 ? 's' : ''}
                {l.note_etat && <span className="aa-note"> — {l.note_etat}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cochees.length > 0 && (
        <div className="aa-barre">
          <span className="aa-barre-nb">
            {cochees.length} ligne{cochees.length > 1 ? 's' : ''} · {nbPieces} pièce{nbPieces > 1 ? 's' : ''}
          </span>
          <select className="input aa-select" value={destination} aria-label="Où ajouter ces lignes ?"
            onChange={(e) => setDestination(e.target.value)}>
            <option value="">Dans un nouvel envoi</option>
            {brouillons.map((b) => (
              <option key={b.id} value={b.id}>Ajouter à {referenceEnvoi(b)}</option>
            ))}
          </select>
          <button className="btn-primary"
            onClick={() => onPreparer(cochees, brouillons.find((b) => b.id === destination) || null)}>
            Préparer l&apos;envoi →
          </button>
        </div>
      )}
    </>
  )
}

const css = `
  .aa-groupe { padding: 14px; }
  .aa-relance { border: 2px solid ${C.gold}; }
  .aa-tete { display: flex; align-items: flex-start; gap: 12px; }
  .aa-thumb {
    width: 52px; height: 52px; border-radius: 10px; overflow: hidden; flex-shrink: 0;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }
  .aa-titre { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .aa-titre b { font-size: 15px; }
  .aa-titre span { font-size: 12.5px; color: ${C.inkSoft}; }
  .aa-titre .aa-badge { align-self: flex-start; color: ${C.goldDeep}; }
  .aa-tout { display: flex; align-items: center; gap: 6px; min-height: 44px; font-size: 13px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
  .aa-tout input, .aa-case input { width: 22px; height: 22px; accent-color: ${C.ink}; flex-shrink: 0; }

  .aa-lignes { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .aa-ligne { background: ${C.sand}; border-radius: 12px; padding: 4px 12px 8px; }
  .aa-ligne-indispo { padding: 10px 12px; font-size: 13.5px; }
  .aa-case { display: flex; align-items: flex-start; gap: 12px; min-height: 44px; padding: 8px 0; cursor: pointer; }
  .aa-detail { display: flex; flex-direction: column; gap: 2px; }
  .aa-detail b { font-size: 14px; }
  .aa-detail span { font-size: 12.5px; color: ${C.inkSoft}; }
  .aa-note { color: ${C.goldDeep}; font-weight: 600; }
  .aa-aide { font-size: 12.5px; color: ${C.inkSoft}; margin: -6px 0 10px; }

  .aa-lien {
    background: none; border: none; cursor: pointer; font-family: inherit; min-height: 44px;
    padding: 0 2px; font-size: 13px; font-weight: 700; color: ${C.clay}; text-decoration: underline;
  }
  .aa-indispo { display: flex; flex-direction: column; gap: 8px; padding-top: 6px; }
  .aa-boutons { display: flex; gap: 8px; flex-wrap: wrap; }

  .aa-barre {
    position: sticky; bottom: 12px; z-index: 20; margin-top: 14px;
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: ${C.inkDeep}; color: #fff; border-radius: 14px; padding: 12px 14px;
    box-shadow: 0 8px 24px rgba(20,58,75,0.3);
  }
  .aa-barre-nb { font-size: 14px; font-weight: 800; flex: 1 1 100%; }
  .aa-select { flex: 1; min-width: 160px; height: 46px; }
  .aa-barre .btn-primary { background: ${C.gold}; color: ${C.inkDeep}; }
  .aa-barre .btn-primary:hover { background: ${C.goldDeep}; }
`
