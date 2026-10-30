'use client'

/* ─────────── components/admin/Commandes.js ───────────
   Onglet "Commandes" de l'admin.

   Liste  → filtres par priorité : À confirmer / En cours / À surveiller / Terminées
   Détail → tout sur une commande + les actions possibles À CETTE ÉTAPE :
            appeler, écrire sur WhatsApp, confirmer (après appel), retirer un produit,
            réactiver un produit, annuler. Toutes passent par les guichets SQL.
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { RefreshCw, ArrowLeft, Check, Phone, MessageCircle, TriangleAlert } from 'lucide-react'
import ProduitImage from '@/components/ProduitImage'
import Icone from '@/components/ui/Icone'
import Badge from '@/components/ui/Badge'
import BlocPaiements from '@/components/commande/BlocPaiements'
import { avanceReste, avanceEnAttente, remboursementReste } from '@/lib/avance'
import { ChargementListe } from '@/components/ui/Squelette'
import { formatKMF, normaliserTexte } from '@/lib/produit'
import {
  STATUTS_COMMANDE, referenceCommande, formatDate, labelIle, lienSuivi,
  lienWhatsApp, messageWhatsAppClient, messageErreurCommande,
} from '@/lib/commandes'

import { C } from '@/lib/theme'
const FILTRES = [
  { id: 'a_confirmer', label: 'À confirmer', test: (c) => c.statut === 'recue' },
  { id: 'en_cours', label: 'En cours', test: (c) => ['confirmee', 'en_achat', 'expediee', 'arrivee', 'en_livraison'].includes(c.statut) },
  { id: 'a_surveiller', label: 'À surveiller', test: (c) => aSurveiller(c) },
  { id: 'terminees', label: 'Terminées', test: (c) => ['livree', 'annulee'].includes(c.statut) },
]

/* Une commande "à surveiller" = quelque chose bloque et demande une décision */
function aSurveiller(c) {
  if (c.statut === 'echec_livraison') return true
  if (c.statut === 'annulee' && remboursementReste(c) > 0) return true // un remboursement est à faire
  if (['livree', 'annulee'].includes(c.statut)) return false
  return (c.lignes || []).some((l) => l.etat === 'indisponible' ||
    (l.quantite_recue != null && l.etat !== 'retiree' && l.quantite_recue < l.quantite))
}

const MOTIFS_ANNULATION = ['Client injoignable', 'Le client a annulé par téléphone', 'Produit indisponible', 'Refus à la livraison']

export default function Commandes({ onChange }) {
  const supabase = createClient()

  const [commandes, setCommandes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [message, setMessage] = useState(null)
  const [filtre, setFiltre] = useState('a_confirmer')
  const [recherche, setRecherche] = useState('')
  const [ouverteId, setOuverteId] = useState(null)

  const charger = async () => {
    setChargement(true)
    const { data, error } = await supabase.rpc('commandes_admin')
    if (error) setMessage({ type: 'err', texte: messageErreurCommande(error) })
    setCommandes(data || [])
    setChargement(false)
  }

  useEffect(() => { charger() }, [])

  /* Toutes les actions passent par ici : appel du guichet, message, rechargement */
  const agir = async (fonction, params, texteSucces) => {
    setMessage(null)
    const { error } = await supabase.rpc(fonction, params)
    if (error) {
      setMessage({ type: 'err', texte: messageErreurCommande(error) })
    } else {
      setMessage({ type: 'ok', texte: texteSucces })
      if (onChange) onChange() // met à jour les compteurs du tableau de bord
    }
    await charger()
    return !error
  }

  const ouverte = commandes.find((c) => c.id === ouverteId)
  if (ouverte) {
    return (
      <DetailCommande
        commande={ouverte}
        message={message}
        onRetour={() => { setOuverteId(null); setMessage(null) }}
        agir={agir}
      />
    )
  }

  /* ── Liste ── */
  const compteurs = Object.fromEntries(FILTRES.map((f) => [f.id, commandes.filter(f.test).length]))
  const q = normaliserTexte(recherche)
  const liste = commandes
    .filter(FILTRES.find((f) => f.id === filtre).test)
    .filter((c) => !q || normaliserTexte(
      `${referenceCommande(c.numero)} ${c.numero} ${c.client?.nom} ${c.client?.telephone}`
    ).includes(q))

  return (
    <section aria-labelledby="titre-commandes">
      <style href="admin-commandes" precedence="default">{css}</style>

      <div className="page-head">
        <div>
          <h1 id="titre-commandes" className="page-title">Commandes</h1>
          <p className="page-sub">Confirme les nouvelles commandes par téléphone, puis suis-les jusqu&apos;à la livraison.</p>
        </div>
        <button onClick={charger} className="btn-secondary"><Icone icone={RefreshCw} taille={18} /> Actualiser</button>
      </div>

      {message && <p role={message.type === 'err' ? 'alert' : 'status'} className={message.type === 'err' ? 'err' : 'ac-ok'}>{message.texte}</p>}

      <div className="ac-filtres" role="group" aria-label="Filtrer les commandes">
        {FILTRES.map((f) => (
          <button key={f.id} onClick={() => setFiltre(f.id)} aria-pressed={filtre === f.id}
            className={`ac-filtre ${filtre === f.id ? 'ac-filtre-on' : ''} ${f.id === 'a_surveiller' && compteurs[f.id] > 0 ? 'ac-filtre-alerte' : ''}`}>
            {f.label} <span>{compteurs[f.id]}</span>
          </button>
        ))}
      </div>

      <input type="search" className="input ac-recherche" placeholder="Rechercher : numéro, nom ou téléphone…"
        aria-label="Rechercher une commande" value={recherche} onChange={(e) => setRecherche(e.target.value)} />

      {chargement ? (
        <ChargementListe nb={3} hauteur={88} />
      ) : liste.length === 0 ? (
        <div className="ac-vide">
          {recherche ? 'Aucune commande ne correspond à ta recherche.'
            : filtre === 'a_confirmer' ? 'Aucune commande à confirmer.'
            : filtre === 'a_surveiller' ? 'Rien ne bloque.'
            : 'Aucune commande ici pour le moment.'}
        </div>
      ) : (
        <ul className="ac-liste">
          {liste.map((c) => {
            const s = STATUTS_COMMANDE[c.statut] || { label: c.statut, ton: 'gris' }
            return (
              <li key={c.id}>
                <button onClick={() => { setOuverteId(c.id); setMessage(null) }} className="ac-ligne">
                  <span className="ac-ligne-haut">
                    <b>{referenceCommande(c.numero)}</b>
                    <Badge ton={s.ton}>{s.label}</Badge>
                    {avanceEnAttente(c) && <Badge ton="or">Avance en attente</Badge>}
                    {c.statut === 'annulee' && remboursementReste(c) > 0 && <Badge ton="rouge">À rembourser</Badge>}
                    {aSurveiller(c) && <Badge ton="rouge">À surveiller</Badge>}
                  </span>
                  <span className="ac-ligne-client">
                    {c.client?.nom || 'Client'} · {c.client?.telephone}
                    {!c.client?.compte && <em> · sans compte</em>}
                  </span>
                  <span className="ac-ligne-bas">
                    <span>{labelIle(c.ile)} · {formatDate(c.created_at, true)}</span>
                    <b>{formatKMF(c.montant_total)} KMF</b>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ═══════════════════════ DÉTAIL D'UNE COMMANDE ═══════════════════════ */
function DetailCommande({ commande: c, message, onRetour, agir }) {
  const [clientJoint, setClientJoint] = useState(false)
  const [noteConfirmation, setNoteConfirmation] = useState('')
  const [annulationOuverte, setAnnulationOuverte] = useState(false)
  const [motifAnnulation, setMotifAnnulation] = useState('')
  const [retraitPour, setRetraitPour] = useState(null) // id de la ligne qu'on retire
  const [motifRetrait, setMotifRetrait] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [copie, setCopie] = useState(false)

  const s = STATUTS_COMMANDE[c.statut] || { label: c.statut, ton: 'gris' }
  const terminee = ['livree', 'annulee'].includes(c.statut)
  const lignesActives = (c.lignes || []).filter((l) => l.etat !== 'retiree')
  const avanceManquante = c.statut === 'recue' && avanceReste(c) > 0 // pas de confirmation sans l'avance complète

  const lancer = async (fonction, params, succes) => {
    setOccupe(true)
    const ok = await agir(fonction, params, succes)
    setOccupe(false)
    return ok
  }

  const confirmer = async () => {
    const ok = await lancer('confirmer_commande',
      { p_commande: c.id, p_client_joint: clientJoint, p_note: noteConfirmation || null },
      `${referenceCommande(c.numero)} confirmée. Elle apparaît maintenant dans la liste d'achat du collaborateur.`)
    if (ok) { setClientJoint(false); setNoteConfirmation('') }
  }

  const annuler = async () => {
    const ok = await lancer('annuler_commande_admin', { p_commande: c.id, p_motif: motifAnnulation },
      `${referenceCommande(c.numero)} annulée. Ce qui avait déjà été acheté passe dans le stock.`)
    if (ok) { setAnnulationOuverte(false); setMotifAnnulation('') }
  }

  const retirer = async (ligne) => {
    const ok = await lancer('retirer_ligne_commande', { p_item: ligne.id, p_motif: motifRetrait },
      `« ${ligne.nom} » retiré. Le total de la commande a été mis à jour.`)
    if (ok) { setRetraitPour(null); setMotifRetrait('') }
  }

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(lienSuivi(c.code_suivi))
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch { window.prompt('Lien de suivi :', lienSuivi(c.code_suivi)) }
  }

  return (
    <section aria-labelledby="titre-detail-cmd" className="ac-detail">
      <style href="admin-commandes" precedence="default">{css}</style>

      <button onClick={onRetour} className="btn-secondary ac-retour"><Icone icone={ArrowLeft} taille={18} /> Toutes les commandes</button>

      <div className="ac-detail-tete">
        <h1 id="titre-detail-cmd" className="page-title">{referenceCommande(c.numero)}</h1>
        <Badge ton={s.ton}>{s.label}</Badge>
        <span className="ac-date">Passée le {formatDate(c.created_at, true)}</span>
      </div>

      {message && <p role={message.type === 'err' ? 'alert' : 'status'} className={message.type === 'err' ? 'err' : 'ac-ok'}>{message.texte}</p>}

      <div className="ac-grille">
        <div>
          {/* ── Action principale selon l'étape ── */}
          {c.statut === 'recue' && (
            <div className="ac-carte ac-carte-action">
              <h2>Confirmer la commande</h2>
              <p className="ac-texte">
                Appelle le client pour vérifier sa commande et son adresse. Rien n&apos;est acheté avant la confirmation.
              </p>
              <div className="ac-contact">
                <a href={`tel:${c.client?.telephone}`} className="ac-btn-appel"><Icone icone={Phone} taille={18} /> Appeler {c.client?.telephone}</a>
                <a href={lienWhatsApp(c.client?.telephone, messageWhatsAppClient(c))} target="_blank" rel="noopener noreferrer" className="ac-btn-wa"><Icone icone={MessageCircle} taille={18} /> WhatsApp</a>
              </div>
              <label className="ac-case">
                <input type="checkbox" checked={clientJoint} onChange={(e) => setClientJoint(e.target.checked)} />
                <span>J&apos;ai joint le client : il confirme sa commande</span>
              </label>
              <input className="input" placeholder="Note (facultatif) : ex. livrer après 17 h" value={noteConfirmation}
                onChange={(e) => setNoteConfirmation(e.target.value)} aria-label="Note de confirmation" />
              {avanceManquante && (
                <p className="err" role="status">
                  Confirmation impossible : l&apos;avance n&apos;est pas complète (reste {formatKMF(avanceReste(c))} KMF).
                  Enregistre-la dans le bloc « Avance » ci-dessous.
                </p>
              )}
              <button onClick={confirmer} disabled={!clientJoint || occupe || avanceManquante} className="btn-primary ac-btn-large">
                {occupe ? 'Patiente…' : 'Confirmer la commande'}
              </button>
            </div>
          )}

          <BlocPaiements commande={c} executer={lancer} occupe={occupe} />

          {/* ── Client ── */}
          <div className="ac-carte">
            <h2>Client</h2>
            <dl className="ac-infos">
              <div><dt>Nom</dt><dd>{c.client?.nom || '—'}</dd></div>
              <div><dt>Téléphone</dt><dd>{c.client?.telephone}</dd></div>
              {c.client?.email && <div><dt>E-mail</dt><dd>{c.client.email}</dd></div>}
              <div><dt>Compte</dt><dd>{c.client?.compte ? `@${c.client.compte}` : 'Commande sans compte'}</dd></div>
              <div className="ac-infos-large"><dt>Livraison</dt><dd>{labelIle(c.ile)} — {c.adresse_livraison}</dd></div>
            </dl>
            {c.statut !== 'recue' && (
              <div className="ac-contact">
                <a href={`tel:${c.client?.telephone}`} className="ac-btn-appel"><Icone icone={Phone} taille={18} /> Appeler</a>
                <a href={lienWhatsApp(c.client?.telephone, messageWhatsAppClient(c))} target="_blank" rel="noopener noreferrer" className="ac-btn-wa"><Icone icone={MessageCircle} taille={18} /> WhatsApp</a>
              </div>
            )}
            <button onClick={copierLien} className="ac-lien-suivi">{copie ? <><Icone icone={Check} taille={16} /> Lien de suivi copié</> : 'Copier le lien de suivi du client'}</button>
          </div>

          {/* ── Contenu ── */}
          <div className="ac-carte">
            <h2>Contenu</h2>
            <ul className="ac-lignes">
              {(c.lignes || []).map((l) => {
                const manque = l.quantite_recue != null && l.etat !== 'retiree' && l.quantite_recue < l.quantite
                return (
                  <li key={l.id} className={`ac-ligne-produit ac-etat-${l.etat}`}>
                    <div className="ac-ligne-produit-haut">
                      <span className="ac-thumb"><ProduitImage produit={l} emojiSize={18} /></span>
                      <span className="ac-ligne-produit-info">
                        <b>{l.nom}</b>
                        <span>{l.quantite} × {formatKMF(l.prix_unitaire)} KMF{l.taille ? ` · ${l.taille}` : ''}{l.couleur ? ` · ${l.couleur}` : ''}</span>
                        {l.envoi_numero && (
                          <span className="ac-envoi">
                            Envoi ENV-{String(l.envoi_numero).padStart(4, '0')} · {l.envoi_statut === 'brouillon' ? 'en préparation' : l.envoi_statut === 'en_route' ? 'en route' : 'reçu'}
                            {l.quantite_recue != null && ` · ${l.quantite_recue}/${l.quantite} reçu${l.quantite_recue > 1 ? 's' : ''}`}
                          </span>
                        )}
                      </span>
                      <b className="ac-ligne-total">{formatKMF(l.quantite * l.prix_unitaire)}</b>
                    </div>

                    {l.etat === 'retiree' && <p className="ac-ligne-note">Retiré : {l.note_etat}</p>}
                    {manque && <p className="ac-ligne-alerte"><Icone icone={TriangleAlert} taille={18} /> Il en manque {l.quantite - l.quantite_recue} à l&apos;arrivée. Préviens le client et ajuste l&apos;encaissement.</p>}

                    {l.etat === 'indisponible' && (
                      <div className="ac-ligne-alerte">
                        <p><Icone icone={TriangleAlert} taille={18} /> Indisponible chez le fournisseur{l.note_etat ? ` : ${l.note_etat}` : ''}. Appelle le client : on retire le produit, ou on attend ?</p>
                        <div className="ac-ligne-boutons">
                          <button onClick={() => { setRetraitPour(l.id); setMotifRetrait('Indisponible, client d\u2019accord pour le retirer') }} className="ac-mini">Retirer de la commande</button>
                          <button onClick={() => lancer('reactiver_ligne_commande', { p_item: l.id }, `« ${l.nom} » est de nouveau à acheter.`)} disabled={occupe} className="ac-mini">Il est de nouveau disponible</button>
                        </div>
                      </div>
                    )}

                    {l.etat !== 'retiree' && !terminee && retraitPour !== l.id && l.etat !== 'indisponible' && lignesActives.length > 1 && l.envoi_statut !== 'en_route' && (
                      <button onClick={() => { setRetraitPour(l.id); setMotifRetrait('') }} className="ac-lien-discret">Retirer ce produit</button>
                    )}

                    {retraitPour === l.id && (
                      <div className="ac-form-inline">
                        <input className="input" value={motifRetrait} onChange={(e) => setMotifRetrait(e.target.value)}
                          placeholder="Raison (obligatoire)" aria-label={`Raison du retrait de ${l.nom}`} autoFocus />
                        <div className="ac-ligne-boutons">
                          <button onClick={() => retirer(l)} disabled={!motifRetrait.trim() || occupe} className="ac-mini ac-mini-danger">Confirmer le retrait</button>
                          <button onClick={() => setRetraitPour(null)} className="ac-mini">Annuler</button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <dl className="ac-totaux">
              {Number(c.montant_livraison) > 0 && <div><dt>Livraison</dt><dd>{formatKMF(c.montant_livraison)} KMF</dd></div>}
              <div className="ac-total"><dt>Total</dt><dd>{formatKMF(c.montant_total)} KMF</dd></div>
              {c.montant_encaisse != null && (
                <div className={Number(c.montant_encaisse) !== Number(c.montant_total) ? 'ac-ecart' : ''}>
                  <dt>Encaissé le {formatDate(c.encaisse_le)}</dt><dd>{formatKMF(c.montant_encaisse)} KMF</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        <div>
          {/* ── Historique ── */}
          <div className="ac-carte">
            <h2>Historique</h2>
            <ol className="ac-histo">
              {(c.suivi || []).slice().reverse().map((h, i) => (
                <li key={i}>
                  <b>{STATUTS_COMMANDE[h.statut]?.label || h.statut}</b>
                  <span>{formatDate(h.created_at, true)}{h.par ? ` · ${h.par}` : ''}</span>
                  {h.note && <p>{h.note}</p>}
                </li>
              ))}
            </ol>
          </div>

          {/* ── Annulation (toujours en dernier : action destructive) ── */}
          {!terminee && (
            <div className="ac-carte ac-carte-danger">
              {!annulationOuverte ? (
                <button onClick={() => setAnnulationOuverte(true)} className="ac-btn-annuler">Annuler cette commande</button>
              ) : (
                <>
                  <h2>Annuler la commande</h2>
                  <p className="ac-texte">Ce qui a déjà été acheté pour ce client passera dans le stock. Le client sera prévenu par toi (WhatsApp).</p>
                  <div className="ac-motifs">
                    {MOTIFS_ANNULATION.map((m) => (
                      <button key={m} onClick={() => setMotifAnnulation(m)} aria-pressed={motifAnnulation === m}
                        className={`ac-motif ${motifAnnulation === m ? 'ac-motif-on' : ''}`}>{m}</button>
                    ))}
                  </div>
                  <input className="input" value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)}
                    placeholder="Ou écris la raison" aria-label="Raison de l'annulation" />
                  <div className="ac-ligne-boutons">
                    <button onClick={annuler} disabled={!motifAnnulation.trim() || occupe} className="ac-mini ac-mini-danger">Confirmer l&apos;annulation</button>
                    <button onClick={() => setAnnulationOuverte(false)} className="ac-mini">Garder la commande</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* ─────────── CSS (préfixe ac-) ─────────── */
const css = `
  .ac-ok { font-size: 15px; color: #2c6e4d; background: #e6f3ec; border: 1px solid #cde5d8; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; font-weight: 600; }

  .ac-filtres { display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; padding-bottom: 4px; }
  .ac-filtre {
    border: 1.5px solid ${C.line}; background: ${C.white}; cursor: pointer; font-family: inherit; white-space: nowrap;
    font-size: 15px; font-weight: 700; color: ${C.inkDeep}; min-height: 44px; padding: 0 16px; border-radius: 8px;
  }
  .ac-filtre span { font-size: 14px; margin-left: 4px; color: ${C.inkSoft}; }
  .ac-filtre-on { border-color: ${C.ink}; background: ${C.ink}; color: ${C.white}; }
  .ac-filtre-on span { color: rgba(255,255,255,0.85); }
  .ac-filtre-alerte:not(.ac-filtre-on) span { color: ${C.clay}; font-weight: 800; }
  .ac-recherche { margin-bottom: 16px; }

  .ac-vide { text-align: center; padding: 32px 16px; color: ${C.inkSoft}; font-size: 15px; background: ${C.white}; border: 1px dashed ${C.line}; border-radius: 12px; }

  .ac-liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .ac-ligne {
    width: 100%; text-align: left; font-family: inherit; color: ${C.inkDeep}; cursor: pointer;
    display: flex; flex-direction: column; gap: 8px; background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px;
  }
  .ac-ligne:hover { border-color: ${C.inkSoft}; }
  .ac-ligne-haut { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ac-ligne-haut b { font-size: 16px; }
  .ac-ligne-client { font-size: 15px; }
  .ac-ligne-client em { color: ${C.inkSoft}; font-style: normal; }
  .ac-ligne-bas { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; color: ${C.inkSoft}; }
  .ac-ligne-bas b { color: ${C.inkDeep}; font-size: 16px; }

  /* ── Détail ── */
  .ac-retour { margin-bottom: 14px; }
  .ac-detail-tete { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .ac-date { font-size: 14px; color: ${C.inkSoft}; }
  .ac-grille { display: grid; grid-template-columns: 1fr; gap: 0 16px; }

  .ac-carte { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .ac-carte h2 { font-size: 18px; font-weight: 800; margin: 0 0 12px; }
  .ac-carte-action { border: 2px solid ${C.ink}; }
  .ac-carte-action .input { margin: 12px 0; background: ${C.white}; }
  .ac-carte-danger { border-color: #e9c9c4; }
  .ac-texte { font-size: 15px; color: ${C.inkSoft}; line-height: 1.5; margin: 0 0 12px; }

  .ac-contact { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 12px; }
  .ac-btn-appel, .ac-btn-wa {
    display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border-radius: 8px;
    font-size: 15px; font-weight: 700; text-decoration: none;
  }
  .ac-btn-appel { background: ${C.ink}; color: ${C.white}; }
  .ac-btn-wa { background: ${C.white}; color: ${C.inkDeep}; border: 1.5px solid ${C.line}; }
  .ac-btn-wa:hover { border-color: ${C.inkSoft}; }
  .ac-case { display: flex; align-items: center; gap: 12px; min-height: 44px; font-size: 15px; font-weight: 700; cursor: pointer; }
  .ac-case input { width: 22px; height: 22px; cursor: pointer; accent-color: ${C.ink}; }
  .ac-btn-large { width: 100%; min-height: 52px; }

  .ac-infos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; margin: 0 0 14px; }
  .ac-infos dt { font-size: 14px; color: ${C.inkSoft}; font-weight: 600; }
  .ac-infos dd { margin: 2px 0 0; font-size: 15px; font-weight: 700; word-break: break-word; }
  .ac-infos-large { grid-column: 1 / -1; }
  .ac-lien-suivi { background: none; border: none; padding: 0 4px; min-height: 44px; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 700; color: ${C.ink}; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px; }

  .ac-lignes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .ac-ligne-produit { border-radius: 12px; }
  .ac-etat-retiree { opacity: 0.55; }
  .ac-etat-retiree .ac-ligne-produit-info b { text-decoration: line-through; }
  .ac-ligne-produit-haut { display: flex; gap: 12px; align-items: center; }
  .ac-thumb { width: 48px; height: 48px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: ${C.sand}; display: flex; align-items: center; justify-content: center; }
  .ac-ligne-produit-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ac-ligne-produit-info b { font-size: 15px; overflow-wrap: anywhere; }
  .ac-ligne-produit-info span { font-size: 14px; color: ${C.inkSoft}; }
  .ac-envoi { color: ${C.ink} !important; font-weight: 600; }
  .ac-ligne-total { font-size: 15px; white-space: nowrap; }
  .ac-ligne-note { font-size: 14px; color: ${C.inkSoft}; margin: 8px 0 0 60px; }
  .ac-ligne-alerte { font-size: 15px; color: ${C.inkDeep}; background: #fbf0ee; border: 1px solid #efd4cf; border-radius: 8px; padding: 12px; margin: 8px 0 0; }
  .ac-ligne-alerte p { margin: 0 0 8px; line-height: 1.45; }
  .ac-ligne-alerte svg { vertical-align: -4px; color: ${C.clay}; }
  .ac-ligne-boutons { display: flex; gap: 8px; flex-wrap: wrap; }
  .ac-mini {
    border: 1.5px solid ${C.line}; background: ${C.white}; cursor: pointer; font-family: inherit;
    font-size: 15px; font-weight: 700; color: ${C.inkDeep}; padding: 0 16px; border-radius: 8px; min-height: 44px;
  }
  .ac-mini:hover:not(:disabled) { border-color: ${C.inkSoft}; }
  .ac-mini:disabled { opacity: 0.5; cursor: not-allowed; }
  .ac-mini-danger { border-color: #e9c9c4; color: ${C.clay}; }
  .ac-lien-discret { background: none; border: none; padding: 0 0 0 60px; min-height: 44px; cursor: pointer; font-family: inherit; font-size: 14px; color: ${C.inkSoft}; text-decoration: underline; }
  .ac-form-inline { margin: 8px 0 0; display: flex; flex-direction: column; gap: 8px; }

  .ac-totaux { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid ${C.line}; display: flex; flex-direction: column; gap: 6px; }
  .ac-totaux div { display: flex; justify-content: space-between; gap: 12px; font-size: 15px; }
  .ac-totaux dt { color: ${C.inkSoft}; }
  .ac-totaux dd { margin: 0; font-weight: 700; }
  .ac-total dd { font-size: 18px; font-weight: 800; }
  .ac-ecart dd { color: ${C.clay}; }

  .ac-histo { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .ac-histo li { border-left: 3px solid ${C.line}; padding-left: 12px; }
  .ac-histo li:first-child { border-left-color: ${C.ink}; }
  .ac-histo b { display: block; font-size: 15px; }
  .ac-histo span { font-size: 14px; color: ${C.inkSoft}; }
  .ac-histo p { font-size: 15px; margin: 4px 0 0; line-height: 1.45; }

  .ac-btn-annuler { width: 100%; min-height: 48px; border: 1.5px solid #e9c9c4; background: ${C.white}; color: ${C.clay}; border-radius: 8px; font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
  .ac-btn-annuler:hover { background: #fbf0ee; }
  .ac-motifs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .ac-motif { border: 1.5px solid ${C.line}; background: ${C.white}; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 600; min-height: 44px; padding: 0 16px; border-radius: 8px; color: ${C.inkDeep}; }
  .ac-motif-on { border-color: ${C.clay}; background: #fbf0ee; color: ${C.clay}; }
  .ac-carte-danger .input { margin-bottom: 10px; }

  @media (min-width: 900px) {
    .ac-liste { grid-template-columns: 1fr 1fr; }
    .ac-grille { grid-template-columns: 1.4fr 1fr; align-items: start; }
  }
`