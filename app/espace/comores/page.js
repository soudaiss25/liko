'use client'

/* ─────────── app/espace/comores/page.js ───────────
   Espace du collaborateur aux Comores.

   Ce qu'il fait ici :
   1. suivre les COMMANDES des clients (relancer l'achat, livrer, encaisser, annuler)
   2. voir les colis en route, les plus urgents en premier
   3. RÉCEPTIONNER un envoi : compter ce qui est vraiment arrivé,
      justifier chaque écart → le stock local se met à jour
   4. consulter le stock disponible aux Comores

   Il ne voit jamais les prix d'achat : la base ne les lui envoie pas.
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import CadreEspace from '@/components/espace/CadreEspace'
import CarteEnvoi from '@/components/espace/CarteEnvoi'
import DetailEnvoi from '@/components/espace/DetailEnvoi'
import { CommandesListe, DetailCommande } from '@/components/espace/CommandesComores'
import { Truck, Package, Warehouse, TriangleAlert, StickyNote, RefreshCw, ArrowLeft, Search } from 'lucide-react'
import ProduitImage from '@/components/ProduitImage'
import Icone from '@/components/ui/Icone'
import EtatVide from '@/components/ui/EtatVide'
import { ChargementListe } from '@/components/ui/Squelette'
import {
  MOTIFS_ECART, referenceEnvoi, formatDateCourte, estEnRetard, totalPieces,
  dateLocale, messageErreur, erreurNecessiteRechargement,
} from '@/lib/envois'
import { normaliserTexte } from '@/lib/produit'
import { referenceCommande, messageErreurCommande } from '@/lib/commandes'

import { C } from '@/lib/theme'
export default function PageComores() {
  return (
    <CadreEspace rolesAutorises={['collab_comores']} titre="Espace Comores">
      <EspaceComores />
    </CadreEspace>
  )
}

/* ═══════════════════════ ÉCRAN PRINCIPAL ═══════════════════════ */
function EspaceComores() {
  const supabase = createClient()

  const [commandes, setCommandes] = useState([])
  const [envois, setEnvois] = useState([])
  const [stock, setStock] = useState([])
  const [chargement, setChargement] = useState(true)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'err', texte }
  const [onglet, setOnglet] = useState('commandes') // commandes | arrivages | recus | stock
  const [vue, setVue] = useState({ type: 'liste' }) // liste | reception | detail | commande
  const [rechercheStock, setRechercheStock] = useState('')

  const charger = async () => {
    setChargement(true)
    const [resEnvois, resStock, resCommandes] = await Promise.all([
      supabase.rpc('envois_comores'),
      supabase.rpc('stock_comores_liste'),
      supabase.rpc('commandes_comores'),
    ])
    if (resCommandes.error) {
      setMessage({ type: 'err', texte: messageErreurCommande(resCommandes.error) })
    } else if (resEnvois.error || resStock.error) {
      setMessage({ type: 'err', texte: messageErreur(resEnvois.error || resStock.error) })
    }
    setCommandes(resCommandes.data || [])
    setEnvois(resEnvois.data || [])
    setStock(resStock.data || [])
    setChargement(false)
  }

  useEffect(() => { charger() }, [])

  const fermer = ({ texte, type = 'ok', ongletCible } = {}) => {
    setVue({ type: 'liste' })
    setMessage(texte ? { type, texte } : null)
    if (ongletCible) setOnglet(ongletCible)
    charger()
  }

  if (vue.type === 'commande') {
    const commande = commandes.find((c) => c.id === vue.id)
    if (!commande) {
      return (
        <section>
          <p role="alert" className="err">Cette commande n&apos;est plus dans la liste. Actualise la page.</p>
          <button onClick={() => fermer()} className="btn-primary"><Icone icone={ArrowLeft} taille={18} /> Retour aux commandes</button>
        </section>
      )
    }
    return (
      <DetailCommande
        commande={commande}
        onRetour={() => setVue({ type: 'liste' })}
        onTermine={(texte) => fermer({ texte })}
        onErreurRecharger={charger}
      />
    )
  }
  if (vue.type === 'reception') return <Reception envoi={vue.envoi} onFermer={fermer} />
  if (vue.type === 'detail') {
    return <DetailEnvoi envoi={vue.envoi} lignes={vue.envoi.lignes} onRetour={() => setVue({ type: 'liste' })} />
  }

  /* Arrivages : les envois en retard d'abord, puis par date d'arrivée prévue */
  const arrivages = envois
    .filter((e) => e.statut === 'en_route')
    .sort((a, b) => {
      const retardA = estEnRetard(a) ? 0 : 1
      const retardB = estEnRetard(b) ? 0 : 1
      if (retardA !== retardB) return retardA - retardB
      const dA = a.date_arrivee_estimee ? dateLocale(a.date_arrivee_estimee).getTime() : Infinity
      const dB = b.date_arrivee_estimee ? dateLocale(b.date_arrivee_estimee).getTime() : Infinity
      return dA - dB
    })
  const recus = envois.filter((e) => e.statut === 'recu' || e.statut === 'recu_avec_ecarts')

  const stockFiltre = stock.filter((p) => normaliserTexte(p.nom).includes(normaliserTexte(rechercheStock)))
  const totalStock = stock.reduce((s, p) => s + p.stock_comores, 0)
  const horsLigne = stock.filter((p) => !p.actif).length

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Commandes & stock</h1>
          <p className="page-sub">Suis les commandes, réceptionne les colis, garde le stock à jour</p>
        </div>
        <button onClick={() => { setMessage(null); charger() }} className="btn-secondary"><Icone icone={RefreshCw} taille={18} /> Actualiser</button>
      </div>

      {message && <p role={message.type === 'err' ? 'alert' : 'status'} className={message.type}>{message.texte}</p>}

      <style href="onglets-comores" precedence="default">{`.segment { overflow-x: auto; }`}</style>
      <div className="segment" role="group" aria-label="Sections">
        {[
          { id: 'commandes', label: 'Commandes', nb: commandes.filter((c) => ['arrivee', 'echec_livraison', 'en_livraison'].includes(c.statut)).length },
          { id: 'arrivages', label: 'Colis', nb: arrivages.length },
          { id: 'recus', label: 'Reçus', nb: recus.length },
          { id: 'stock', label: 'Stock', nb: stock.length },
        ].map((o) => (
          <button key={o.id} onClick={() => setOnglet(o.id)} aria-pressed={onglet === o.id}
            className={`seg ${onglet === o.id ? 'seg-on' : ''}`}>
            {o.label}<span className="seg-nb">{o.nb}</span>
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="state"><ChargementListe nb={3} hauteur={96} /></div>
      ) : onglet === 'commandes' ? (
        <CommandesListe commandes={commandes} onOuvrir={(id) => { setMessage(null); setVue({ type: 'commande', id }) }} />
      ) : onglet === 'arrivages' ? (
        arrivages.length === 0 ? (
          <EtatVide icone={Truck} texte="Aucun colis en route pour le moment." />
        ) : (
          arrivages.map((e) => (
            <CarteEnvoi
              key={e.id}
              envoi={e}
              nbProduits={e.lignes.length}
              nbPieces={totalPieces(e.lignes)}
              libelleAction="Réceptionner"
              onOuvrir={() => { setMessage(null); setVue({ type: 'reception', envoi: e }) }}
            />
          ))
        )
      ) : onglet === 'recus' ? (
        recus.length === 0 ? (
          <EtatVide icone={Package} texte="Aucun envoi réceptionné pour le moment." />
        ) : (
          recus.map((e) => (
            <CarteEnvoi
              key={e.id}
              envoi={e}
              nbProduits={e.lignes.length}
              nbPieces={totalPieces(e.lignes, 'quantite_recue')}
              libelleAction="Voir le détail"
              onOuvrir={() => { setMessage(null); setVue({ type: 'detail', envoi: e }) }}
            />
          ))
        )
      ) : (
        /* ── Stock ── */
        <>
          <style href="stock-comores" precedence="default">{cssStock}</style>
          {stock.length === 0 ? (
            <EtatVide icone={Warehouse} texte="Le stock est vide. Il se remplit à chaque réception." />
          ) : (
            <>
              <p className="st-resume">
                <b>{totalStock}</b> pièce{totalStock > 1 ? 's' : ''} en stock · {stock.length} produit{stock.length > 1 ? 's' : ''}
              </p>
              {horsLigne > 0 && (
                <p className="st-alerte">
                  <Icone icone={TriangleAlert} taille={18} /> {horsLigne} produit{horsLigne > 1 ? 's sont' : ' est'} en stock mais pas en ligne sur le site.
                  Préviens l'admin : ce stock ne peut pas se vendre.
                </p>
              )}
              <input
                type="search"
                className="input st-recherche"
                placeholder="Chercher dans le stock"
                aria-label="Chercher dans le stock"
                value={rechercheStock}
                onChange={(e) => setRechercheStock(e.target.value)}
              />
              <ul className="st-liste">
                {stockFiltre.map((p) => (
                  <li key={p.id} className="st-ligne">
                    <span className="st-thumb"><ProduitImage produit={p} emojiSize={20} /></span>
                    <span className="st-info">
                      <b>{p.nom}</b>
                      <span>
                        {p.categorie}
                        {!p.actif && <em> · pas en ligne</em>}
                      </span>
                    </span>
                    <span className="st-qte"><b>{p.stock_comores}</b><span>en stock</span></span>
                  </li>
                ))}
              </ul>
              {stockFiltre.length === 0 && <EtatVide icone={Search} texte="Aucun produit ne correspond." />}
            </>
          )}
        </>
      )}
    </section>
  )
}

/* ═══════════════════════ RÉCEPTION D'UN ENVOI ═══════════════════════ */
function Reception({ envoi, onFermer }) {
  const supabase = createClient()

  /* Par défaut, "reçu" = "envoyé" : si tout est conforme,
     il suffit de vérifier et de confirmer (un seul clic). */
  const saisieParDefaut = () =>
    Object.fromEntries(envoi.lignes.map((l) => [
      l.id, { quantite_recue: String(l.quantite_envoyee), motif_ecart: '', note_ecart: '' },
    ]))

  const [saisie, setSaisie] = useState(saisieParDefaut)
  const [erreur, setErreur] = useState('')
  const [tenteEnvoi, setTenteEnvoi] = useState(false) // pour n'afficher les erreurs de ligne qu'après un 1er essai
  const [occupe, setOccupe] = useState(false)

  /* Quand la quantité change, on devine le motif le plus probable :
     plus que prévu → "surplus". Moins que prévu → on laisse choisir. */
  const changerQuantite = (ligne, valeur) => {
    const propre = valeur.replace(/\D/g, '')
    const actuel = saisie[ligne.id]
    let motif = actuel.motif_ecart
    const q = parseInt(propre, 10)
    if (!Number.isNaN(q)) {
      if (q > ligne.quantite_envoyee && !motif) motif = 'surplus'
      if (q < ligne.quantite_envoyee && motif === 'surplus') motif = ''
      if (q === ligne.quantite_envoyee) motif = ''
    }
    setSaisie({ ...saisie, [ligne.id]: { ...actuel, quantite_recue: propre, motif_ecart: motif } })
  }

  const changer = (id, cle, valeur) => setSaisie({ ...saisie, [id]: { ...saisie[id], [cle]: valeur } })

  /* ── Analyse de chaque ligne ── */
  const analyse = envoi.lignes.map((l) => {
    const s = saisie[l.id]
    const valide = /^\d+$/.test(s.quantite_recue)
    const q = valide ? parseInt(s.quantite_recue, 10) : null
    const ecart = valide && q !== l.quantite_envoyee
    let probleme = ''
    if (!valide) probleme = 'Indique la quantité reçue (0 si rien n\u2019est arrivé).'
    else if (ecart && !s.motif_ecart) probleme = 'Choisis la raison de l\u2019écart.'
    return { ligne: l, saisie: s, q, ecart, probleme }
  })

  const nbEcarts = analyse.filter((a) => a.ecart).length
  const nbProblemes = analyse.filter((a) => a.probleme).length
  const envoye = totalPieces(envoi.lignes)
  const recu = analyse.reduce((s, a) => s + (a.q || 0), 0)

  const confirmer = async () => {
    setTenteEnvoi(true)
    if (nbProblemes > 0) {
      setErreur(`${nbProblemes} ligne${nbProblemes > 1 ? 's' : ''} à compléter (en rouge ci-dessous).`)
      return
    }

    const ok = window.confirm(
      `Confirmer la réception de ${referenceEnvoi(envoi)} ?\n\n` +
      `${recu} pièce(s) reçue(s) sur ${envoye}` + (nbEcarts > 0 ? `, ${nbEcarts} écart(s) signalé(s)` : ', tout est conforme') +
      '.\n\nLe stock sera mis à jour et la réception ne pourra plus être modifiée.'
    )
    if (!ok) return

    setOccupe(true)
    setErreur('')
    const { data, error } = await supabase.rpc('receptionner_envoi', {
      p_envoi_id: envoi.id,
      p_lignes: analyse.map((a) => ({
        item_id: a.ligne.id,
        quantite_recue: a.q,
        motif_ecart: a.ecart ? a.saisie.motif_ecart : null,
        note_ecart: a.ecart ? a.saisie.note_ecart : null,
      })),
    })
    setOccupe(false)

    if (error) {
      if (erreurNecessiteRechargement(error)) onFermer({ type: 'err', texte: messageErreur(error), ongletCible: 'recus' })
      else setErreur(messageErreur(error))
      return
    }

    onFermer({
      texte: data === 'recu_avec_ecarts'
        ? `${referenceEnvoi(envoi)} réceptionné avec ${nbEcarts} écart(s). Le stock est à jour.`
        : `${referenceEnvoi(envoi)} réceptionné, tout est conforme. Le stock est à jour.`,
      ongletCible: 'recus',
    })
  }

  const retour = () => {
    const modifie = JSON.stringify(saisie) !== JSON.stringify(saisieParDefaut())
    if (modifie && !window.confirm('Quitter sans confirmer ? Ton comptage sera perdu.')) return
    onFermer()
  }

  return (
    <section aria-labelledby="titre-reception">
      <style href="reception" precedence="default">{cssReception}</style>

      <button onClick={retour} className="btn-secondary rc-retour"><Icone icone={ArrowLeft} taille={18} /> Retour</button>

      <div className="page-head">
        <div>
          <h1 id="titre-reception" className="page-title">Réceptionner {referenceEnvoi(envoi)}</h1>
          <p className="page-sub">
            Origine : {envoi.pays_origine}
            {envoi.transporteur && ` · ${envoi.transporteur}`}
            {envoi.numero_suivi && ` · n° ${envoi.numero_suivi}`}
            {` · parti le ${formatDateCourte(envoi.date_depart)}`}
          </p>
        </div>
      </div>

      {envoi.note && <p className="rc-note"><Icone icone={StickyNote} taille={18} /> Note de l'expéditeur : {envoi.note}</p>}

      <p className="rc-consigne">
        Compte chaque produit. Les quantités sont pré-remplies avec ce qui a été envoyé :
        <b> corrige seulement ce qui ne correspond pas.</b>
      </p>

      <ul className="rc-lignes">
        {analyse.map(({ ligne, saisie: s, ecart, probleme }) => (
          <li key={ligne.id} className={`rc-ligne ${ecart ? 'rc-ecart' : ''} ${tenteEnvoi && probleme ? 'rc-probleme' : ''}`}>
            <div className="rc-haut">
              <span className="rc-thumb"><ProduitImage produit={ligne} emojiSize={20} /></span>
              <span className="rc-nom">
                <b>{ligne.nom}</b>
                <span>Envoyé : {ligne.quantite_envoyee}</span>
              </span>
              <label className="rc-recu">
                <span>Reçu</span>
                <input
                  inputMode="numeric"
                  value={s.quantite_recue}
                  onChange={(e) => changerQuantite(ligne, e.target.value)}
                  aria-label={`Quantité reçue de ${ligne.nom}`}
                />
              </label>
            </div>

            {ligne.commande_numero && (
              <p className="rc-pour"><Icone icone={Package} taille={18} /> Pour {referenceCommande(ligne.commande_numero)} : à mettre de côté pour ce client</p>
            )}

            {/* La raison n'apparaît que s'il y a un écart */}
            {ecart && (
              <div className="rc-motif">
                <select
                  className="input"
                  value={s.motif_ecart}
                  onChange={(e) => changer(ligne.id, 'motif_ecart', e.target.value)}
                  aria-label={`Raison de l'écart pour ${ligne.nom}`}
                >
                  <option value="">Raison de l'écart…</option>
                  {MOTIFS_ECART.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <input
                  className="input"
                  value={s.note_ecart}
                  placeholder="Détail (facultatif) : ex. carton ouvert"
                  onChange={(e) => changer(ligne.id, 'note_ecart', e.target.value)}
                  aria-label={`Détail de l'écart pour ${ligne.nom}`}
                />
              </div>
            )}

            {tenteEnvoi && probleme && <p className="rc-erreur-ligne">{probleme}</p>}
          </li>
        ))}
      </ul>

      {/* Résumé toujours visible avant de confirmer */}
      <div className={`rc-resume ${nbEcarts > 0 ? 'rc-resume-ecart' : ''}`}>
        <span><b>{recu}</b> pièce{recu > 1 ? 's' : ''} reçue{recu > 1 ? 's' : ''} sur {envoye}</span>
        <span>{nbEcarts === 0 ? '✓ Tout est conforme' : `${nbEcarts} écart${nbEcarts > 1 ? 's' : ''}`}</span>
      </div>

      {erreur && <p role="alert" className="err">{erreur}</p>}

      <div className="rc-actions">
        <button onClick={confirmer} disabled={occupe} className="btn-primary btn-large">
          {occupe ? 'Enregistrement…' : '✓ Confirmer la réception'}
        </button>
        <button onClick={() => { setSaisie(saisieParDefaut()); setTenteEnvoi(false); setErreur('') }}
          disabled={occupe} className="btn-secondary btn-large">
          Tout remettre comme envoyé
        </button>
      </div>
    </section>
  )
}

/* ─────────── CSS ─────────── */
const cssReception = `
  .rc-retour { margin-bottom: 14px; }
  .rc-note { font-size: 14px; background: ${C.bgGrey}; border: 1px solid ${C.line}; color: #7A5C1E; border-radius: 8px; padding: 10px 12px; margin: 0 0 12px; }
  .rc-consigne { font-size: 14px; color: ${C.inkSoft}; line-height: 1.5; margin: 0 0 14px; }
  .rc-consigne b { color: ${C.inkDeep}; }

  .rc-lignes { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .rc-ligne { background: #fff; border: 1.5px solid ${C.line}; border-radius: 12px; padding: 12px; }
  .rc-ecart { border-color: ${C.ink}; }
  .rc-probleme { border-color: ${C.clay}; background: #FBF0EE; }

  .rc-haut { display: flex; align-items: center; gap: 12px; }
  .rc-thumb {
    width: 48px; height: 48px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }
  .rc-nom { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .rc-nom b { font-size: 14px; }
  .rc-nom span { font-size: 13px; color: ${C.inkSoft}; }

  .rc-recu { display: flex; flex-direction: column; align-items: center; gap: 3px; flex-shrink: 0; }
  .rc-recu span { font-size: 13px; font-weight: 700; color: ${C.inkSoft}; }
  .rc-recu input {
    width: 72px; height: 48px; text-align: center; border-radius: 8px;
    border: 1.5px solid ${C.line}; background: ${C.sand}; outline: none;
    font-size: 18px; font-weight: 800; font-family: inherit; color: ${C.inkDeep};
  }
  .rc-recu input:focus { border-color: ${C.ink}; background: #fff; }

  .rc-pour { font-size: 13px; font-weight: 700; color: ${C.ink}; background: ${C.bgGrey}; border-radius: 8px; padding: 8px 10px; margin: 10px 0 0; }
  .rc-motif { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px; }
  .rc-erreur-ligne { font-size: 13px; color: ${C.clay}; font-weight: 700; margin: 8px 0 0; }

  .rc-resume {
    display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;
    background: #E8F5EE; color: ${C.leaf}; border-radius: 12px; padding: 12px 14px;
    font-size: 14px; font-weight: 700; margin-bottom: 14px;
  }
  .rc-resume-ecart { background: #fbf0d9; color: #8a5a0b; }
  .rc-resume b { font-size: 16px; }

  .rc-actions { display: flex; flex-direction: column; gap: 10px; }

  @media (min-width: 640px) {
    .rc-motif { grid-template-columns: 220px 1fr; }
  }
`

const cssStock = `
  .st-resume { font-size: 14px; color: ${C.inkSoft}; margin: 0 0 10px; }
  .st-resume b { color: ${C.inkDeep}; font-size: 16px; }
  .st-alerte {
    font-size: 14px; color: #7A5C1E; background: ${C.bgGrey}; border: 1px solid ${C.line};
    border-radius: 8px; padding: 10px 12px; margin: 0 0 12px; line-height: 1.45;
  }
  .st-recherche { margin-bottom: 12px; }
  .st-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .st-ligne {
    display: flex; align-items: center; gap: 12px;
    background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 10px 12px;
  }
  .st-thumb {
    width: 44px; height: 44px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }
  .st-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .st-info b { font-size: 14px; }
  .st-info span { font-size: 13px; color: ${C.inkSoft}; }
  .st-info em { color: ${C.clay}; font-style: normal; font-weight: 700; }
  .st-qte { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
  .st-qte b { font-size: 20px; font-weight: 800; color: ${C.leaf}; }
  .st-qte span { font-size: 13px; color: ${C.inkSoft}; }
`