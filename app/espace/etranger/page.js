'use client'

/* ─────────── app/espace/etranger/page.js ───────────
   Espace du collaborateur à l'étranger (Chine, Sénégal, Niger…).

   Ce qu'il fait ici :
   1. voir ce qu'il y a À ACHETER (commandes confirmées, regroupées par produit)
   2. préparer un envoi (brouillon) avec ces lignes : transporteur, prix d'achat
      (les quantités des lignes de commande sont fixées par la commande)
   3. le marquer comme "parti" → il devient verrouillé et visible aux Comores
   4. suivre ses envois : en route, puis reçus (avec les écarts signalés)

   Il ne crée PAS de produits : il choisit dans le catalogue de l'admin.
   Toutes les écritures passent par les fonctions SQL (règles vérifiées dans la base).
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import CadreEspace from '@/components/espace/CadreEspace'
import CarteEnvoi from '@/components/espace/CarteEnvoi'
import DetailEnvoi from '@/components/espace/DetailEnvoi'
import AAcheter from '@/components/espace/AAcheter'
import ProduitImage from '@/components/ProduitImage'
import {
  PAYS_ENVOI, TRANSPORTEURS_SUGGERES, referenceEnvoi, totalPieces,
  messageErreur, erreurNecessiteRechargement, formatDateCourte,
} from '@/lib/envois'
import { referenceCommande } from '@/lib/commandes'
import { formatKMF, normaliserTexte } from '@/lib/produit'

const C = {
  ink: '#1D4E63', inkDeep: '#143A4B', inkSoft: '#6E8A97',
  sand: '#F4F1EA', line: '#E4DED2',
  gold: '#E8A020', goldDeep: '#C6851A',
  leaf: '#3E9268', clay: '#C2574A',
}

export default function PageEtranger() {
  return (
    <CadreEspace rolesAutorises={['collab_etranger']} titre="Achats & envois">
      <EspaceEtranger />
    </CadreEspace>
  )
}

/* ═══════════════════════ LISTE DES ENVOIS ═══════════════════════ */
function EspaceEtranger() {
  const supabase = createClient()

  const [envois, setEnvois] = useState([])
  const [produits, setProduits] = useState([])
  const [lignesAchat, setLignesAchat] = useState([]) // lignes de commande à acheter
  const [chargement, setChargement] = useState(true)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'err', texte }
  const [onglet, setOnglet] = useState('acheter') // acheter | brouillon | en_route | recus
  const [vue, setVue] = useState({ type: 'liste' }) // liste | edition | detail

  const charger = async () => {
    setChargement(true)
    const [resEnvois, resProduits, resAchats] = await Promise.all([
      supabase.rpc('envois_etranger'),
      supabase.from('produits').select('id, nom, categorie, images, actif, prix_achat').order('nom'),
      supabase.rpc('lignes_a_acheter'),
    ])
    const erreurChargement = resEnvois.error || resProduits.error || resAchats.error
    if (erreurChargement) setMessage({ type: 'err', texte: messageErreur(erreurChargement) })
    setEnvois(resEnvois.data || [])
    setProduits(resProduits.data || [])
    setLignesAchat(resAchats.data || [])
    setChargement(false)
  }

  useEffect(() => { charger() }, [])

  /* Appelé quand on quitte l'éditeur */
  const fermerEditeur = ({ texte, type = 'ok', ongletCible } = {}) => {
    setVue({ type: 'liste' })
    setMessage(texte ? { type, texte } : null)
    if (ongletCible) setOnglet(ongletCible)
    charger()
  }

  const produitParId = Object.fromEntries(produits.map((p) => [p.id, p]))

  /* Les lignes d'un envoi, complétées avec le nom et la photo du produit */
  const lignesDe = (envoi) =>
    (envoi.envoi_items || []).map((i) => ({
      ...i,
      nom: produitParId[i.produit_id]?.nom || 'Produit supprimé',
      categorie: produitParId[i.produit_id]?.categorie,
      images: produitParId[i.produit_id]?.images,
    }))

  if (vue.type === 'edition') {
    return (
      <EditeurEnvoi
        envoi={vue.envoi}
        ajouts={vue.ajouts || []}
        produits={produits}
        onFermer={fermerEditeur}
        onRecharger={charger}
      />
    )
  }
  if (vue.type === 'detail') {
    return (
      <DetailEnvoi
        envoi={vue.envoi}
        lignes={lignesDe(vue.envoi)}
        afficherPrix
        onRetour={() => setVue({ type: 'liste' })}
      />
    )
  }

  const nbAchats = lignesAchat.filter((l) => l.etat !== 'indisponible').length
  const brouillons = envois.filter((e) => e.statut === 'brouillon')
  const groupes = {
    brouillon: envois.filter((e) => e.statut === 'brouillon'),
    en_route: envois.filter((e) => e.statut === 'en_route'),
    recus: envois.filter((e) => e.statut === 'recu' || e.statut === 'recu_avec_ecarts'),
  }
  const liste = groupes[onglet] || []

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Mes envois</h1>
          <p className="page-sub">Prépare tes colis et suis leur arrivée aux Comores</p>
        </div>
        <button onClick={() => { setMessage(null); setVue({ type: 'edition', envoi: null, ajouts: [] }) }} className="btn-primary">
          + Nouvel envoi
        </button>
      </div>

      {message && <p role={message.type === 'err' ? 'alert' : 'status'} className={message.type}>{message.texte}</p>}

      <style href="onglets-etranger" precedence="default">{`
        .segment { overflow-x: auto; }
        .et-alerte { font-size: 13px; font-weight: 700; color: ${C.clay}; background: #FBF0EE; border: 1px solid #F0D9D5; border-radius: 10px; padding: 9px 12px; margin: 0 0 6px; }
      `}</style>
      <div className="segment" role="group" aria-label="Filtrer les envois">
        {[
          { id: 'acheter', label: 'À acheter', nb: nbAchats },
          { id: 'brouillon', label: 'Brouillons', nb: groupes.brouillon.length },
          { id: 'en_route', label: 'En route', nb: groupes.en_route.length },
          { id: 'recus', label: 'Reçus', nb: groupes.recus.length },
        ].map((o) => (
          <button key={o.id} onClick={() => setOnglet(o.id)} aria-pressed={onglet === o.id}
            className={`seg ${onglet === o.id ? 'seg-on' : ''}`}>
            {o.label}<span className="seg-nb">{o.nb}</span>
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="state">Chargement…</div>
      ) : onglet === 'acheter' ? (
        <AAcheter
          lignes={lignesAchat}
          brouillons={brouillons}
          onPreparer={(lignes, brouillon) => { setMessage(null); setVue({ type: 'edition', envoi: brouillon, ajouts: lignes }) }}
          onRecharger={charger}
          onMessage={setMessage}
        />
      ) : liste.length === 0 ? (
        <div className="vide">
          <div className="vide-emoji">{onglet === 'brouillon' ? '📝' : onglet === 'en_route' ? '🚚' : '📦'}</div>
          {onglet === 'brouillon' && 'Aucun brouillon. Clique sur « + Nouvel envoi » pour préparer un colis.'}
          {onglet === 'en_route' && 'Aucun envoi en route pour le moment.'}
          {onglet === 'recus' && 'Aucun envoi réceptionné pour le moment.'}
        </div>
      ) : (
        liste.map((e) => (
          <div key={e.id}>
            {(e.alertes || []).length > 0 && (
              <p className="et-alerte">
                ⚠️ {e.alertes.length} alerte{e.alertes.length > 1 ? 's' : ''} sur {referenceEnvoi(e)} : ouvre-le pour la lire.
              </p>
            )}
            <CarteEnvoi
              envoi={e}
              nbProduits={(e.envoi_items || []).length}
              nbPieces={totalPieces(e.envoi_items)}
              libelleAction={e.statut === 'brouillon' ? 'Continuer' : 'Voir le détail'}
              onOuvrir={() => {
                setMessage(null)
                setVue(e.statut === 'brouillon' ? { type: 'edition', envoi: e, ajouts: [] } : { type: 'detail', envoi: e })
              }}
            />
          </div>
        ))
      )}
    </section>
  )
}

/* ═══════════════════════ ÉDITEUR D'ENVOI ═══════════════════════ */

/* Transforme un envoi de la base en valeurs de formulaire */
function etatInitial(envoi) {
  return {
    infos: {
      pays_origine: envoi?.pays_origine || '',
      fournisseur: envoi?.fournisseur || '',
      transporteur: envoi?.transporteur || '',
      numero_suivi: envoi?.numero_suivi || '',
      date_depart: envoi?.date_depart || '',
      date_arrivee_estimee: envoi?.date_arrivee_estimee || '',
      note: envoi?.note || '',
    },
    lignes: (envoi?.envoi_items || []).map((i) => ({
      produit_id: i.produit_id,
      quantite_envoyee: String(i.quantite_envoyee),
      prix_achat_unitaire: i.prix_achat_unitaire == null ? '' : String(i.prix_achat_unitaire),
      // Ligne venant d'une commande : produit et quantité imposés par la commande
      commande_item_id: i.commande_item_id || null,
      commande_numero: i.commande_numero || null,
      taille: i.taille || null,
      couleur: i.couleur || null,
    })),
  }
}

/* Une ligne "à acheter" devient une ligne d'envoi */
const ligneDepuisCommande = (l) => ({
  produit_id: l.produit_id,
  quantite_envoyee: String(l.quantite),
  prix_achat_unitaire: l.prix_achat == null ? '' : String(l.prix_achat),
  commande_item_id: l.id,
  commande_numero: l.commande_numero,
  taille: l.taille || null,
  couleur: l.couleur || null,
})

function EditeurEnvoi({ envoi, ajouts = [], produits, onFermer, onRecharger }) {
  const supabase = createClient()

  const [depart] = useState(() => etatInitial(envoi)) // photo de l'état de départ
  const [infos, setInfos] = useState(depart.infos)
  // Lignes déjà dans le brouillon + celles qu'on vient de cocher dans "À acheter"
  const [lignes, setLignes] = useState(() => {
    const dejaLa = new Set(depart.lignes.map((l) => l.commande_item_id).filter(Boolean))
    return [...depart.lignes, ...ajouts.filter((a) => !dejaLa.has(a.id)).map(ligneDepuisCommande)]
  })
  const [alertes, setAlertes] = useState(envoi?.alertes || [])
  // On garde l'id après le 1er enregistrement : cliquer 2 fois sur
  // "Enregistrer" ne crée donc jamais 2 envois.
  const [idEnvoi, setIdEnvoi] = useState(envoi?.id || null)
  const [recherche, setRecherche] = useState('')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [ajoutHorsCommandeOuvert, setAjoutHorsCommandeOuvert] = useState(false)

  const modifie = JSON.stringify({ infos, lignes }) !== JSON.stringify(depart)
  const produitParId = Object.fromEntries(produits.map((p) => [p.id, p]))

  const changerInfo = (cle, valeur) => setInfos({ ...infos, [cle]: valeur })

  /* ── Recherche de produits à ajouter ── */
  const dejaAjoutes = new Set(lignes.map((l) => l.produit_id))
  const resultats = recherche.trim()
    ? produits
        .filter((p) => !dejaAjoutes.has(p.id) && normaliserTexte(p.nom).includes(normaliserTexte(recherche)))
        .slice(0, 8)
    : []
  const rechercheDejaDansEnvoi = recherche.trim() && resultats.length === 0 &&
    produits.some((p) => dejaAjoutes.has(p.id) && normaliserTexte(p.nom).includes(normaliserTexte(recherche)))

  const ajouterProduit = (p) => {
    setLignes([...lignes, {
      produit_id: p.id,
      quantite_envoyee: '1',
      // On pré-remplit avec le prix d'achat du catalogue (modifiable)
      prix_achat_unitaire: p.prix_achat == null ? '' : String(p.prix_achat),
    }])
    setRecherche('')
  }

  const changerLigne = (index, cle, valeur) =>
    setLignes(lignes.map((l, i) => (i === index ? { ...l, [cle]: valeur } : l)))

  const ajusterQuantite = (index, delta) => {
    const actuelle = parseInt(lignes[index].quantite_envoyee, 10) || 0
    changerLigne(index, 'quantite_envoyee', String(Math.max(1, actuelle + delta)))
  }

  const retirerLigne = (index) => setLignes(lignes.filter((_, i) => i !== index))

  /* ── Totaux ── */
  const nbPieces = lignes.reduce((s, l) => s + (parseInt(l.quantite_envoyee, 10) || 0), 0)
  const coutTotal = lignes.reduce(
    (s, l) => s + (parseInt(l.quantite_envoyee, 10) || 0) * (Number(l.prix_achat_unitaire) || 0), 0
  )

  /* ── Vérifications AVANT d'appeler la base (réponse immédiate à l'écran).
     La base revérifie tout de son côté : c'est elle qui a le dernier mot. ── */
  const verifier = (pourDepart) => {
    if (!infos.pays_origine) return 'Choisis le pays d\u2019où part l\u2019envoi.'
    if (infos.date_depart && infos.date_arrivee_estimee && infos.date_arrivee_estimee < infos.date_depart) {
      return 'La date d\u2019arrivée prévue est avant la date de départ.'
    }
    for (const l of lignes) {
      const nom = produitParId[l.produit_id]?.nom || 'un produit'
      if (!/^\d+$/.test(l.quantite_envoyee) || parseInt(l.quantite_envoyee, 10) < 1) {
        return `Quantité invalide pour « ${nom} » : mets un nombre entier, au moins 1.`
      }
      if (l.prix_achat_unitaire !== '' && !(Number(l.prix_achat_unitaire) >= 0)) {
        return `Prix d\u2019achat invalide pour « ${nom} ».`
      }
    }
    if (pourDepart) {
      if (lignes.length === 0) return 'Ajoute au moins un produit avant de marquer l\u2019envoi comme parti.'
      if (!infos.transporteur.trim()) return 'Indique le transporteur avant de marquer l\u2019envoi comme parti.'
    }
    return ''
  }

  /* ── Enregistrement dans la base ── */
  const sauver = async () => {
    const { data, error } = await supabase.rpc('sauver_brouillon_envoi', {
      p_envoi_id: idEnvoi,
      p_infos: infos,
      p_lignes: lignes.map((l) => ({
        produit_id: l.produit_id,
        quantite_envoyee: parseInt(l.quantite_envoyee, 10),
        prix_achat_unitaire: l.prix_achat_unitaire === '' ? null : Number(l.prix_achat_unitaire),
        // Pour une ligne de commande, la base impose le produit et la quantité
        ...(l.commande_item_id ? { commande_item_id: l.commande_item_id } : {}),
      })),
    })
    if (data) setIdEnvoi(data)
    return { id: data, error }
  }

  const gererErreur = (error) => {
    if (erreurNecessiteRechargement(error)) {
      onFermer({ type: 'err', texte: messageErreur(error), ongletCible: 'acheter' })
    } else {
      setErreur(messageErreur(error))
    }
  }

  const enregistrerBrouillon = async () => {
    const probleme = verifier(false)
    if (probleme) { setErreur(probleme); return }

    setOccupe(true)
    setErreur('')
    const { error } = await sauver()
    setOccupe(false)

    if (error) { gererErreur(error); return }
    onFermer({ texte: 'Brouillon enregistré.', ongletCible: 'brouillon' })
  }

  const marquerParti = async () => {
    const probleme = verifier(true)
    if (probleme) { setErreur(probleme); return }

    const ok = window.confirm(
      `Marquer cet envoi comme parti ?\n\n${lignes.length} produit(s), ${nbPieces} pièce(s).\n` +
      'Après ça, son contenu ne pourra plus être modifié.'
    )
    if (!ok) return

    setOccupe(true)
    setErreur('')

    // 1. on enregistre d'abord la dernière version…
    const { id, error } = await sauver()
    if (error) { setOccupe(false); gererErreur(error); return }

    // 2. …puis on le fait partir
    const res = await supabase.rpc('envoyer_envoi', { p_envoi_id: id })
    setOccupe(false)

    if (res.error) {
      // Le brouillon est quand même enregistré : on peut corriger et réessayer
      gererErreur(res.error)
      return
    }
    onFermer({ texte: 'Envoi marqué comme parti. L\u2019équipe Comores le voit maintenant dans ses arrivages.', ongletCible: 'en_route' })
  }

  const supprimerBrouillon = async () => {
    if (!window.confirm('Supprimer ce brouillon ? Les commandes qu\u2019il contient retourneront dans « À acheter ».')) return
    if (!idEnvoi) { onFermer(); return }

    setOccupe(true)
    const { error } = await supabase.rpc('supprimer_brouillon_envoi', { p_envoi_id: idEnvoi })
    setOccupe(false)

    if (error) { gererErreur(error); return }
    onFermer({ texte: 'Brouillon supprimé.', ongletCible: 'brouillon' })
  }

  const effacerAlertes = async () => {
    setOccupe(true)
    const { error } = await supabase.rpc('effacer_alertes_envoi', { p_envoi_id: idEnvoi })
    setOccupe(false)
    if (error) { setErreur(messageErreur(error)); return }
    setAlertes([])
    onRecharger()
  }

  const retour = () => {
    if (modifie && !window.confirm('Quitter sans enregistrer ? Tes modifications seront perdues.')) return
    onFermer()
  }

  return (
    <section aria-labelledby="titre-editeur">
      <style href="editeur-envoi" precedence="default">{css}</style>

      <button onClick={retour} className="btn-secondary ed-retour">← Retour</button>

      <div className="page-head">
        <div>
          <h1 id="titre-editeur" className="page-title">
            {envoi ? `Brouillon ${referenceEnvoi(envoi)}` : 'Nouvel envoi'}
          </h1>
          <p className="page-sub">Tu peux enregistrer et revenir plus tard, tant que l'envoi n'est pas parti.</p>
        </div>
      </div>

      {alertes.length > 0 && (
        <div className="ed-alertes" role="alert">
          <b>⚠️ À lire</b>
          <ul>
            {alertes.map((a, i) => (
              <li key={i}>{a.date && <small>{formatDateCourte(a.date)} · </small>}{a.message}</li>
            ))}
          </ul>
          <button onClick={effacerAlertes} disabled={occupe} className="btn-danger">J&apos;ai compris</button>
        </div>
      )}

      {/* ── 1. Informations du colis ── */}
      <div className="carte">
        <h2 className="carte-titre">1. Le colis</h2>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="pays">Pays de départ</label>
            <select id="pays" className="input" value={infos.pays_origine}
              onChange={(e) => changerInfo('pays_origine', e.target.value)}>
              <option value="">Choisir…</option>
              {PAYS_ENVOI.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="fournisseur">Fournisseur <span className="hint">— facultatif</span></label>
            <input id="fournisseur" className="input" value={infos.fournisseur}
              onChange={(e) => changerInfo('fournisseur', e.target.value)} placeholder="Usine, marché, boutique…" />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="transporteur">Transporteur <span className="hint">— obligatoire pour partir</span></label>
            <input id="transporteur" className="input" list="liste-transporteurs" value={infos.transporteur}
              onChange={(e) => changerInfo('transporteur', e.target.value)} placeholder="Fret aérien, GP…" />
            <datalist id="liste-transporteurs">
              {TRANSPORTEURS_SUGGERES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="field">
            <label className="label" htmlFor="suivi">N° de suivi <span className="hint">— si disponible</span></label>
            <input id="suivi" className="input" value={infos.numero_suivi}
              onChange={(e) => changerInfo('numero_suivi', e.target.value)} placeholder="Ex : AB123456" />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="depart">Date de départ <span className="hint">— aujourd'hui si vide</span></label>
            <input id="depart" type="date" className="input" value={infos.date_depart}
              onChange={(e) => changerInfo('date_depart', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="arrivee">Arrivée prévue</label>
            <input id="arrivee" type="date" className="input" value={infos.date_arrivee_estimee}
              min={infos.date_depart || undefined}
              onChange={(e) => changerInfo('date_arrivee_estimee', e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label className="label" htmlFor="note">Note pour l'équipe Comores <span className="hint">— facultatif</span></label>
          <textarea id="note" className="input textarea" rows={2} value={infos.note}
            onChange={(e) => changerInfo('note', e.target.value)} placeholder="Ex : 2 cartons, le petit est fragile" />
        </div>
      </div>

      {/* ── 2. Contenu ── */}
      <div className="carte">
        <h2 className="carte-titre">2. Le contenu</h2>
        <p className="ed-aide">Prix d'achat en <b>francs comoriens (KMF)</b>, après conversion.</p>

        <button onClick={() => setAjoutHorsCommandeOuvert(!ajoutHorsCommandeOuvert)} aria-expanded={ajoutHorsCommandeOuvert}
          className="btn-secondary ed-replier">
          {ajoutHorsCommandeOuvert ? '− ' : '+ '}Ajouter un produit hors commande (pour le stock)
        </button>

        {ajoutHorsCommandeOuvert && (
        <div className="ed-recherche">
          <input
            type="search"
            className="input"
            placeholder="🔍 Chercher un produit du catalogue…"
            aria-label="Chercher un produit à ajouter"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          {resultats.length > 0 && (
            <ul className="ed-resultats">
              {resultats.map((p) => (
                <li key={p.id}>
                  <button onClick={() => ajouterProduit(p)} className="ed-resultat">
                    <span className="ed-thumb"><ProduitImage produit={p} emojiSize={18} /></span>
                    <span className="ed-resultat-nom">
                      {p.nom}
                      {!p.actif && <small> · pas encore en ligne</small>}
                    </span>
                    <span className="ed-plus" aria-hidden="true">+</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rechercheDejaDansEnvoi && <p className="ed-info">Ce produit est déjà dans l'envoi : change plutôt sa quantité.</p>}
          {recherche.trim() && resultats.length === 0 && !rechercheDejaDansEnvoi && (
            <p className="ed-info">Aucun produit trouvé. S'il n'existe pas encore, demande à l'admin de le créer.</p>
          )}
        </div>
        )}

        {lignes.length === 0 ? (
          <p className="ed-vide">Aucun produit pour l'instant. Choisis des lignes dans « À acheter », ou ajoute un produit hors commande.</p>
        ) : (
          <ul className="ed-lignes">
            {lignes.map((l, i) => {
              const p = produitParId[l.produit_id]
              return (
                <li key={l.commande_item_id || l.produit_id} className="ed-ligne">
                  <div className="ed-ligne-haut">
                    <span className="ed-thumb"><ProduitImage produit={p || { nom: '?' }} emojiSize={18} /></span>
                    <span className="ed-ligne-nom">
                      <b>{p?.nom || 'Produit supprimé'}</b>
                      {l.commande_item_id && (
                        <small className="ed-pour">
                          Pour {l.commande_numero ? referenceCommande(l.commande_numero) : 'une commande'}
                          {(l.taille || l.couleur) && ` · ${[l.taille, l.couleur].filter(Boolean).join(' · ')}`}
                        </small>
                      )}
                    </span>
                    <button onClick={() => retirerLigne(i)} className="ed-retirer" aria-label={`Retirer ${p?.nom || 'ce produit'}`}>✕</button>
                  </div>
                  <div className="ed-ligne-champs">
                    <div>
                      <span className="ed-mini-label">Quantité</span>
                      {l.commande_item_id ? (
                        <p className="ed-qte-fixe"><b>× {l.quantite_envoyee}</b><small>fixée par la commande</small></p>
                      ) : (
                        <div className="ed-qte">
                          <button onClick={() => ajusterQuantite(i, -1)} aria-label="Retirer 1">−</button>
                          <input
                            inputMode="numeric"
                            value={l.quantite_envoyee}
                            aria-label={`Quantité de ${p?.nom}`}
                            onChange={(e) => changerLigne(i, 'quantite_envoyee', e.target.value.replace(/\D/g, ''))}
                          />
                          <button onClick={() => ajusterQuantite(i, 1)} aria-label="Ajouter 1">+</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="ed-mini-label">Prix d'achat / pièce</span>
                      <input
                        className="input ed-prix"
                        inputMode="decimal"
                        value={l.prix_achat_unitaire}
                        placeholder="KMF"
                        aria-label={`Prix d'achat de ${p?.nom}`}
                        onChange={(e) => changerLigne(i, 'prix_achat_unitaire', e.target.value.replace(/[^\d.]/g, ''))}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {lignes.length > 0 && (
          <div className="ed-total">
            <span>{lignes.length} produit{lignes.length > 1 ? 's' : ''} · {nbPieces} pièce{nbPieces > 1 ? 's' : ''}</span>
            {coutTotal > 0 && <b>{formatKMF(coutTotal)} KMF d'achat</b>}
          </div>
        )}
      </div>

      {erreur && <p role="alert" className="err">{erreur}</p>}

      {/* ── Actions ── */}
      <div className="ed-actions">
        <button onClick={marquerParti} disabled={occupe} className="btn-primary btn-large">
          {occupe ? 'Patiente…' : '🚚 Enregistrer et marquer comme parti'}
        </button>
        <button onClick={enregistrerBrouillon} disabled={occupe} className="btn-secondary btn-large">
          Enregistrer le brouillon
        </button>
        {(envoi || idEnvoi) && (
          <button onClick={supprimerBrouillon} disabled={occupe} className="btn-danger btn-large">
            Supprimer le brouillon
          </button>
        )}
      </div>
    </section>
  )
}

/* ─────────── CSS de l'éditeur (préfixe ed-) ─────────── */
const css = `
  .ed-retour { margin-bottom: 14px; }
  .ed-aide { font-size: 12.5px; color: ${C.inkSoft}; margin: -6px 0 12px; }
  .ed-info { font-size: 12.5px; color: ${C.goldDeep}; margin: 8px 2px 0; font-weight: 600; }
  .ed-vide { font-size: 13.5px; color: ${C.inkSoft}; text-align: center; padding: 18px 0 6px; margin: 0; }

  /* Recherche */
  .ed-recherche { position: relative; margin-bottom: 14px; }
  .ed-resultats {
    list-style: none; margin: 6px 0 0; padding: 4px; background: #fff;
    border: 1px solid ${C.line}; border-radius: 12px; box-shadow: 0 8px 24px rgba(20,58,75,0.12);
  }
  .ed-resultat {
    display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px;
    background: none; border: none; cursor: pointer; font-family: inherit; text-align: left;
    padding: 6px 8px; border-radius: 8px; color: ${C.inkDeep};
  }
  .ed-resultat:hover { background: ${C.sand}; }
  .ed-resultat-nom { flex: 1; font-size: 14px; font-weight: 600; }
  .ed-resultat-nom small { color: ${C.goldDeep}; font-weight: 600; }
  .ed-plus { font-size: 20px; font-weight: 700; color: ${C.ink}; }

  .ed-thumb {
    width: 38px; height: 38px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }

  /* Lignes */
  .ed-lignes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .ed-ligne { background: ${C.sand}; border-radius: 12px; padding: 10px 12px; }
  .ed-ligne-haut { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .ed-ligne-nom { flex: 1; font-size: 14px; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ed-pour { font-size: 12px; font-weight: 700; color: ${C.goldDeep}; }
  .ed-qte-fixe { margin: 0; min-height: 44px; display: flex; flex-direction: column; justify-content: center; }
  .ed-qte-fixe b { font-size: 17px; }
  .ed-qte-fixe small { font-size: 11px; color: ${C.inkSoft}; }
  .ed-replier { width: 100%; margin-bottom: 12px; white-space: normal; text-align: left; justify-content: flex-start; }
  .ed-alertes {
    background: #FBF0EE; border: 1.5px solid ${C.clay}; border-radius: 14px; padding: 14px;
    margin-bottom: 12px; color: ${C.inkDeep}; font-size: 14px;
  }
  .ed-alertes b { color: ${C.clay}; }
  .ed-alertes ul { margin: 8px 0 12px; padding-left: 18px; line-height: 1.5; }
  .ed-retirer {
    width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer;
    background: #fff; color: ${C.clay}; font-size: 13px; flex-shrink: 0;
  }
  .ed-ligne-champs { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: end; }
  .ed-mini-label { display: block; font-size: 11.5px; font-weight: 700; color: ${C.inkSoft}; margin-bottom: 5px; }

  .ed-qte { display: flex; align-items: center; background: #fff; border: 1.5px solid ${C.line}; border-radius: 10px; overflow: hidden; }
  .ed-qte button {
    width: 44px; height: 44px; border: none; background: none; cursor: pointer;
    font-size: 20px; font-weight: 700; color: ${C.inkDeep};
  }
  .ed-qte input {
    width: 54px; height: 44px; border: none; text-align: center; background: none;
    font-size: 16px; font-weight: 800; font-family: inherit; color: ${C.inkDeep}; outline: none;
  }
  .ed-prix { height: 47px; background: #fff; }

  .ed-total {
    display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;
    border-top: 1px solid ${C.line}; margin-top: 14px; padding-top: 12px;
    font-size: 13.5px; color: ${C.inkSoft};
  }
  .ed-total b { color: ${C.inkDeep}; }

  .ed-actions { display: flex; flex-direction: column; gap: 10px; }
`