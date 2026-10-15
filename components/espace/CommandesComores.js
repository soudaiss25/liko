'use client'

/* ─────────── components/espace/CommandesComores.js ───────────
   Onglet "Commandes" de l'espace Comores : le collaborateur suit les commandes
   des clients, du moment où elles arrivent jusqu'à la livraison.

   - CommandesListe  : filtres, recherche, cartes
   - DetailCommande  : client, relance, livraison, encaissement, annulation

   Toutes les règles (qui peut annuler, relancer…) sont revérifiées par la base :
   ici on n'affiche que les boutons qui ont du sens.
*/

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { ClipboardList, Bell, Phone, MessageCircle, Bike, TriangleAlert, ArrowLeft } from 'lucide-react'
import ProduitImage from '@/components/ProduitImage'
import Icone from '@/components/ui/Icone'
import EtatVide from '@/components/ui/EtatVide'
import { formatKMF, normaliserTexte } from '@/lib/produit'
import { dateLocale, formatDateCourte, referenceEnvoi } from '@/lib/envois'
import {
  STATUTS_COMMANDE, referenceCommande, labelIle, lienWhatsApp, messageWhatsAppClient,
  messageErreurCommande, texteDepuis,
} from '@/lib/commandes'

import { C } from '@/lib/theme'
const FILTRES = [
  { id: 'a_livrer', label: 'À livrer', statuts: ['arrivee', 'echec_livraison', 'en_livraison'] },
  { id: 'en_cours', label: 'En cours', statuts: ['recue', 'confirmee', 'en_achat', 'expediee'] },
  { id: 'terminees', label: 'Terminées', statuts: ['livree', 'annulee'] },
]

const MOTIFS_ECHEC = [
  { id: 'absent', label: 'Client absent' },
  { id: 'injoignable', label: 'Injoignable' },
  { id: 'refus', label: 'Refus du colis' },
  { id: 'adresse_introuvable', label: 'Adresse introuvable' },
  { id: 'autre', label: 'Autre' },
]

const MOTIFS_ANNULATION = [
  'Le client a changé d’avis',
  'Délai trop long pour le client',
  'Le client a trouvé moins cher',
  'Commande en double',
]

const AUTRE = '__autre__'
const MS_24H = 86400000

const lignesActives = (c) => (c.lignes || []).filter((l) => l.etat !== 'retiree')
const relanceRecente = (c) => !!c.relance_le && Date.now() - new Date(c.relance_le).getTime() < MS_24H

/* Une ligne de situation, selon le statut. Renvoie { texte, retard } */
function situation(c) {
  const depuis = texteDepuis(c.confirmee_le)
  switch (c.statut) {
    case 'recue':
      return { texte: 'Nouvelle : en attente de confirmation par l’admin' }
    case 'confirmee':
      return { texte: `En attente d’achat · confirmée ${depuis}` }
    case 'en_achat':
      return { texte: `Achat en cours à l’étranger · confirmée ${depuis}` }
    case 'expediee': {
      const enRoute = (c.lignes || []).find((l) => l.envoi_statut === 'en_route' && l.envoi_arrivee_prevue)
      if (!enRoute) return { texte: 'En route' }
      const aujourdhui = new Date()
      aujourdhui.setHours(0, 0, 0, 0)
      const retard = dateLocale(enRoute.envoi_arrivee_prevue) < aujourdhui
      return { texte: `En route · arrivée prévue le ${formatDateCourte(enRoute.envoi_arrivee_prevue)}`, retard }
    }
    case 'arrivee':
      return { texte: 'Arrivée : à livrer' }
    case 'en_livraison':
      return { texte: 'En cours de livraison' }
    case 'echec_livraison':
      return { texte: `Livraison ratée${c.derniere_note ? ` · ${c.derniere_note}` : ''}` }
    case 'livree':
      return { texte: `Livrée · encaissé ${formatKMF(c.montant_encaisse)} KMF` }
    case 'annulee':
      return { texte: `Annulée${c.motif_annulation ? ` · ${c.motif_annulation}` : ''}` }
    default:
      return { texte: '' }
  }
}

/* Où en est CHAQUE ligne de la commande */
function avancement(l) {
  if (l.etat === 'retiree') return { texte: 'Retiré de la commande', ton: 'gris' }
  if (l.etat === 'indisponible') return { texte: 'Indisponible chez le fournisseur', ton: 'rouge' }
  if (!l.envoi_numero) return { texte: 'Pas encore acheté', ton: 'gris' }
  const ref = referenceEnvoi({ numero: l.envoi_numero })
  if (l.envoi_statut === 'brouillon') return { texte: `En préparation dans ${ref}`, ton: 'gris' }
  if (l.envoi_statut === 'en_route') {
    const prevu = l.envoi_arrivee_prevue ? `, prévu le ${formatDateCourte(l.envoi_arrivee_prevue)}` : ''
    return { texte: `En route (${ref}${prevu})`, ton: 'or' }
  }
  const recu = Number(l.quantite_recue) || 0
  const incomplet = recu < Number(l.quantite)
  return { texte: `Reçu : ${recu}/${l.quantite}${incomplet ? ' (incomplet)' : ''}`, ton: incomplet ? 'rouge' : 'vert' }
}

/* ═══════════════════════ LISTE ═══════════════════════ */
export function CommandesListe({ commandes, onOuvrir }) {
  const [filtre, setFiltre] = useState(null)
  const [recherche, setRecherche] = useState('')

  const parFiltre = Object.fromEntries(
    FILTRES.map((f) => [f.id, commandes.filter((c) => f.statuts.includes(c.statut))])
  )
  // Par défaut : "À livrer" s'il y en a, sinon "En cours"
  const actif = filtre || (parFiltre.a_livrer.length > 0 ? 'a_livrer' : 'en_cours')

  const q = normaliserTexte(recherche)
  const chiffres = q.replace(/\D/g, '')
  const trouve = (c) => {
    if (!q) return true
    const tel = c.client?.telephone || ''
    const texte = normaliserTexte(`${referenceCommande(c.numero)} ${c.numero} ${c.client?.nom || ''} ${tel}`)
    return texte.includes(q) || (chiffres.length > 0 && tel.replace(/\D/g, '').includes(chiffres))
  }

  const date = (c) => new Date(c.created_at).getTime()
  const liste = parFiltre[actif]
    .filter(trouve)
    .sort((a, b) => (actif === 'terminees' ? date(b) - date(a) : date(a) - date(b)))

  return (
    <>
      <style href="commandes-comores" precedence="default">{css}</style>

      <div className="segment" role="group" aria-label="Filtrer les commandes">
        {FILTRES.map((f) => (
          <button key={f.id} onClick={() => setFiltre(f.id)} aria-pressed={actif === f.id}
            className={`seg ${actif === f.id ? 'seg-on' : ''}`}>
            {f.label}<span className="seg-nb">{parFiltre[f.id].length}</span>
          </button>
        ))}
      </div>

      <input
        type="search"
        className="input cc-recherche"
        placeholder="N° de commande, nom ou téléphone"
        aria-label="Chercher une commande"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />

      {liste.length === 0 ? (
        <EtatVide icone={ClipboardList} texte={recherche ? 'Aucune commande ne correspond.' : 'Aucune commande dans cette liste.'} />
      ) : (
        liste.map((c) => <CarteCommande key={c.id} commande={c} onOuvrir={() => onOuvrir(c.id)} />)
      )}
    </>
  )
}

function CarteCommande({ commande: c, onOuvrir }) {
  const statut = STATUTS_COMMANDE[c.statut] || { label: c.statut, ton: 'gris' }
  const sit = situation(c)
  const noms = lignesActives(c).map((l) => l.nom)
  const apercu = noms.slice(0, 2).join(', ') + (noms.length > 2 ? ` +${noms.length - 2}` : '')
  const relancee = c.relance_le && ['confirmee', 'en_achat'].includes(c.statut)

  return (
    <button onClick={onOuvrir} className="cc-carte">
      <span className="cc-haut">
        <b className="cc-ref">{referenceCommande(c.numero)}</b>
        <span className={`badge badge-${statut.ton}`}>{statut.label}</span>
        {relancee && <span className="badge badge-or"><Icone icone={Bell} taille={16} /> Relancée</span>}
      </span>
      <span className="cc-ligne cc-fort">
        {c.client?.nom} · {c.client?.telephone} · {labelIle(c.ile)}
      </span>
      <span className="cc-ligne">
        {sit.texte}
        {sit.retard && <b className="cc-retard"> (en retard)</b>}
      </span>
      <span className="cc-bas">
        <span className="cc-apercu">{apercu}</span>
        <b>{formatKMF(c.montant_total)} KMF</b>
      </span>
    </button>
  )
}

/* ═══════════════════════ DÉTAIL ═══════════════════════ */
export function DetailCommande({ commande: c, onRetour, onTermine, onErreurRecharger }) {
  const supabase = createClient()

  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  const [messageRelance, setMessageRelance] = useState('')
  const [montant, setMontant] = useState(String(c.montant_total ?? 0))
  const [noteMontant, setNoteMontant] = useState('')
  const [ouvertEchec, setOuvertEchec] = useState(false)
  const [motifEchec, setMotifEchec] = useState('')
  const [noteEchec, setNoteEchec] = useState('')
  const [ouvertAnnul, setOuvertAnnul] = useState(false)
  const [motifAnnul, setMotifAnnul] = useState('')
  const [motifLibre, setMotifLibre] = useState('')

  const statut = STATUTS_COMMANDE[c.statut] || { label: c.statut, ton: 'gris' }
  const sit = situation(c)
  const ref = referenceCommande(c.numero)
  const telephone = c.client?.telephone || ''

  /* Un seul endroit pour appeler la base : bouton désactivé pendant l'appel,
     erreur traduite, données rechargées après un succès. */
  const agir = async (fonction, parametres, texteOk, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return
    setOccupe(true)
    setErreur('')
    const { error } = await supabase.rpc(fonction, parametres)
    setOccupe(false)
    if (error) {
      setErreur(messageErreurCommande(error))
      onErreurRecharger() // quelqu'un a peut-être déjà agi : on rafraîchit la fiche
      return
    }
    onTermine(texteOk)
  }

  const relancer = () =>
    agir('relancer_achat', { p_commande: c.id, p_message: messageRelance.trim() || null },
      `${ref} : l’équipe à l’étranger a été relancée.`)

  const demarrer = () =>
    agir('demarrer_livraison', { p_commande: c.id }, `${ref} : livraison démarrée.`)

  /* ── Livrée et encaissée ── */
  const montantNombre = montant.trim() === '' ? null : Number(montant)
  const montantValide = montantNombre !== null && Number.isInteger(montantNombre) && montantNombre >= 0
  const montantDiffere = montantValide && montantNombre !== Number(c.montant_total)
  const noteManquante = montantDiffere && !noteMontant.trim()

  const livrer = () => {
    if (!montantValide) { setErreur(messageErreurCommande({ message: 'MONTANT_INVALIDE' })); return }
    if (noteManquante) { setErreur(messageErreurCommande({ message: 'NOTE_OBLIGATOIRE' })); return }
    agir('marquer_livree',
      { p_commande: c.id, p_montant: montantNombre, p_note: montantDiffere ? noteMontant.trim() : null },
      `${ref} : livrée, ${formatKMF(montantNombre)} KMF encaissés.`,
      `Confirmer la livraison de ${ref} ?\n\n${formatKMF(montantNombre)} KMF encaissés.\nCette action est définitive.`)
  }

  const echec = () => {
    if (!motifEchec) { setErreur('Choisis la raison de l’échec.'); return }
    agir('signaler_echec_livraison',
      { p_commande: c.id, p_motif: motifEchec, p_note: noteEchec.trim() || null },
      `${ref} : échec de livraison enregistré.`,
      `Signaler que la livraison de ${ref} n’a pas pu se faire ?`)
  }

  /* ── Annulation ── */
  const motifFinal = motifAnnul === AUTRE ? motifLibre.trim() : motifAnnul
  const annuler = () => {
    if (!motifFinal) { setErreur(messageErreurCommande({ message: 'MOTIF_OBLIGATOIRE' })); return }
    agir('annuler_commande_comores', { p_commande: c.id, p_motif: motifFinal },
      `${ref} : commande annulée.`,
      `Annuler la commande ${ref} ?\n\nMotif : ${motifFinal}\nCette action est définitive.`)
  }

  const peutRelancer = ['confirmee', 'en_achat'].includes(c.statut)
  const dejaPartie = ['expediee', 'arrivee', 'en_livraison', 'echec_livraison'].includes(c.statut)

  return (
    <section aria-labelledby="titre-commande">
      <style href="commandes-comores" precedence="default">{css}</style>

      <button onClick={onRetour} className="btn-secondary cc-retour"><Icone icone={ArrowLeft} taille={18} /> Retour</button>

      <div className="cc-entete">
        <h1 id="titre-commande" className="page-title">{ref}</h1>
        <span className={`badge badge-${statut.ton}`}>{statut.label}</span>
      </div>
      <p className="cc-situation">
        {sit.texte}
        {sit.retard && <b className="cc-retard"> (en retard)</b>}
      </p>

      {erreur && <p role="alert" className="err">{erreur}</p>}

      {/* ── Client ── */}
      <div className="carte">
        <h2 className="carte-titre">Client</h2>
        <p className="cc-client"><b>{c.client?.nom}</b></p>
        <p className="cc-client">{telephone}</p>
        <p className="cc-client">{labelIle(c.ile)}{c.adresse_livraison ? ` · ${c.adresse_livraison}` : ''}</p>
        <div className="cc-boutons">
          <a href={`tel:${telephone}`} className="btn-secondary"><Icone icone={Phone} taille={18} /> Appeler</a>
          <a href={lienWhatsApp(telephone, messageWhatsAppClient(c))} target="_blank" rel="noopener noreferrer"
            className="btn-secondary"><Icone icone={MessageCircle} taille={18} /> WhatsApp</a>
        </div>
      </div>

      {/* ── Relancer l'achat ── */}
      {peutRelancer && (
        <div className="carte">
          <h2 className="carte-titre">Relancer l&apos;achat</h2>
          {relanceRecente(c) ? (
            <p className="cc-info">Déjà relancée il y a moins de 24 h.</p>
          ) : (
            <>
              <label className="label" htmlFor="msg-relance">Message pour l&apos;étranger <span className="hint">(facultatif)</span></label>
              <input id="msg-relance" className="input" value={messageRelance} maxLength={200}
                placeholder="Ex : le client s'impatiente"
                onChange={(e) => setMessageRelance(e.target.value)} />
              <button onClick={relancer} disabled={occupe} className="btn-secondary cc-bouton">
                <Icone icone={Bell} taille={18} /> Relancer l&apos;étranger
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Livraison ── */}
      {(c.statut === 'arrivee' || c.statut === 'echec_livraison') && (
        <div className="carte">
          <h2 className="carte-titre">Livraison</h2>
          <button onClick={demarrer} disabled={occupe} className="btn-primary btn-large"><Icone icone={Bike} taille={18} /> Partir en livraison</button>
        </div>
      )}

      {c.statut === 'en_livraison' && (
        <div className="carte">
          <h2 className="carte-titre">Livraison en cours</h2>
          <div className="field">
            <label className="label" htmlFor="montant">Montant encaissé (KMF)</label>
            <input id="montant" className="input" inputMode="numeric" value={montant}
              onChange={(e) => setMontant(e.target.value.replace(/\D/g, ''))} />
            <p className="hint">Total de la commande : {formatKMF(c.montant_total)} KMF</p>
          </div>
          {montantDiffere && (
            <div className="field">
              <label className="label" htmlFor="note-montant">Pourquoi ce montant ?</label>
              <input id="note-montant" className="input" value={noteMontant}
                placeholder="Ex : remise accordée, client a payé une partie"
                onChange={(e) => setNoteMontant(e.target.value)} />
            </div>
          )}
          <button onClick={livrer} disabled={occupe} className="btn-primary btn-large">✓ Livrée et encaissée</button>

          {!ouvertEchec ? (
            <button onClick={() => setOuvertEchec(true)} disabled={occupe} className="btn-danger btn-large cc-bouton">
              La livraison n&apos;a pas pu se faire
            </button>
          ) : (
            <div className="cc-sous-bloc">
              <p className="label">Pourquoi ?</p>
              <div className="cc-choix">
                {MOTIFS_ECHEC.map((m) => (
                  <label key={m.id} className="cc-radio">
                    <input type="radio" name="motif-echec" checked={motifEchec === m.id}
                      onChange={() => setMotifEchec(m.id)} />
                    {m.label}
                  </label>
                ))}
              </div>
              <input className="input" value={noteEchec} placeholder="Détail (facultatif)"
                aria-label="Détail de l'échec" onChange={(e) => setNoteEchec(e.target.value)} />
              <div className="cc-boutons">
                <button onClick={echec} disabled={occupe} className="btn-danger">Enregistrer l&apos;échec</button>
                <button onClick={() => setOuvertEchec(false)} disabled={occupe} className="btn-secondary">Fermer</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Contenu ── */}
      <div className="carte">
        <h2 className="carte-titre">Contenu · {formatKMF(c.montant_total)} KMF</h2>
        <ul className="cc-lignes">
          {(c.lignes || []).map((l) => {
            const av = avancement(l)
            return (
              <li key={l.id} className="cc-ligne-produit">
                <span className="cc-thumb"><ProduitImage produit={l} emojiSize={20} /></span>
                <span className="cc-prod">
                  <b>{l.nom}</b>
                  <span>{[l.taille, l.couleur].filter(Boolean).join(' · ')}</span>
                  <span className={`cc-av cc-av-${av.ton}`}>{av.texte}</span>
                </span>
                <span className="cc-qte">× {l.quantite}</span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Annulation ── */}
      {c.peut_annuler ? (
        <div className="carte">
          {!ouvertAnnul ? (
            <button onClick={() => setOuvertAnnul(true)} disabled={occupe} className="btn-danger btn-large">
              Le client veut annuler
            </button>
          ) : (
            <>
              <h2 className="carte-titre">Annuler {ref}</h2>
              <div className="cc-choix">
                {[...MOTIFS_ANNULATION, AUTRE].map((m) => (
                  <label key={m} className="cc-radio">
                    <input type="radio" name="motif-annul" checked={motifAnnul === m} onChange={() => setMotifAnnul(m)} />
                    {m === AUTRE ? 'Autre raison…' : m}
                  </label>
                ))}
              </div>
              {motifAnnul === AUTRE && (
                <input className="input" value={motifLibre} placeholder="Écris la raison"
                  aria-label="Raison de l'annulation" onChange={(e) => setMotifLibre(e.target.value)} />
              )}
              <div className="cc-boutons">
                <button onClick={annuler} disabled={occupe} className="btn-danger">Confirmer l&apos;annulation</button>
                <button onClick={() => setOuvertAnnul(false)} disabled={occupe} className="btn-secondary">Fermer</button>
              </div>
            </>
          )}
        </div>
      ) : dejaPartie ? (
        <p className="cc-info">
          L&apos;annulation n&apos;est plus possible : la commande est déjà partie. En cas de refus,
          utilise « La livraison n&apos;a pas pu se faire ».
        </p>
      ) : null}
    </section>
  )
}

const css = `
  .cc-recherche { margin-bottom: 12px; }
  .badge-bleu { background: #E3EEF3; color: ${C.ink}; }

  .cc-carte {
    display: flex; flex-direction: column; align-items: flex-start; gap: 5px; width: 100%;
    background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 14px 16px;
    margin-bottom: 10px; cursor: pointer; text-align: left; font-family: inherit; color: ${C.inkDeep};
    min-height: 44px;
  }
  .cc-carte:hover { border-color: ${C.inkSoft}; }
  .cc-haut { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px; }
  .cc-ref { font-size: 15px; font-weight: 800; letter-spacing: 0.3px; }
  .cc-ligne { font-size: 14px; }
  .cc-fort { font-weight: 700; }
  .cc-retard { color: ${C.clay}; }
  .cc-bas { display: flex; justify-content: space-between; gap: 10px; width: 100%; margin-top: 4px; font-size: 14px; }
  .cc-apercu { color: ${C.inkSoft}; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .cc-retour { margin-bottom: 14px; }
  .cc-entete { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .cc-situation { font-size: 14px; color: ${C.inkSoft}; margin: 6px 0 14px; }
  .cc-client { margin: 0 0 4px; font-size: 14px; }
  .cc-boutons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
  .cc-bouton { margin-top: 12px; }
  .cc-info {
    font-size: 14px; color: ${C.inkSoft}; background: ${C.sand}; border-radius: 8px;
    padding: 11px 13px; margin: 0 0 12px; line-height: 1.5;
  }
  .cc-sous-bloc { margin-top: 14px; border-top: 1px solid ${C.line}; padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }
  .cc-choix { display: flex; flex-direction: column; gap: 6px; }
  .cc-radio { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 14px; cursor: pointer; }
  .cc-radio input { width: 20px; height: 20px; accent-color: ${C.ink}; }

  .cc-lignes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .cc-ligne-produit { display: flex; align-items: center; gap: 12px; }
  .cc-thumb {
    width: 46px; height: 46px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }
  .cc-prod { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .cc-prod b { font-size: 14px; }
  .cc-prod span { font-size: 13px; color: ${C.inkSoft}; }
  .cc-prod .cc-av-rouge { color: ${C.clay}; font-weight: 700; }
  .cc-prod .cc-av-vert { color: ${C.leaf}; font-weight: 700; }
  .cc-prod .cc-av-or { color: #8a5a0b; font-weight: 700; }
  .cc-qte { font-size: 15px; font-weight: 800; flex-shrink: 0; }
`
