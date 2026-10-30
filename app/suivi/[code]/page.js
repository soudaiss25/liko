'use client'

/* ─────────── app/suivi/[code]/page.js ───────────
   Suivi d'une commande par son lien secret — SANS compte.
   Montre : où en est la commande, ce qu'elle contient, où elle sera livrée.
   Ne montre jamais : les notes internes de l'équipe, le téléphone en entier.
*/

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BarreNavMobile from '@/components/BarreNavMobile'
import { ArrowLeft, Check, SearchX } from 'lucide-react'
import Icone from '@/components/ui/Icone'
import EtatVide from '@/components/ui/EtatVide'
import { Squelette } from '@/components/ui/Squelette'
import ProduitImage from '@/components/ProduitImage'
import FriseCommande from '@/components/commande/FriseCommande'
import InstructionsAvance from '@/components/commande/InstructionsAvance'
import { avanceEnAttente, avanceReste, resteALaLivraison, remboursementReste } from '@/lib/avance'
import { formatKMF } from '@/lib/produit'
import {
  ETAPES, STATUTS_COMMANDE, referenceCommande, formatDate, labelIle,
  lienSuivi, lienWhatsApp, memoriserSuivi, messageErreurCommande,
} from '@/lib/commandes'
import { WHATSAPP_SERVICE } from '@/lib/config'

import { C } from '@/lib/theme'
export default function PageSuivi() {
  const { code } = useParams()
  const supabase = createClient()

  const [commande, setCommande] = useState(null)
  const [etat, setEtat] = useState('chargement') // chargement | ok | introuvable
  const [message, setMessage] = useState(null)
  const [occupe, setOccupe] = useState(false)
  const [copie, setCopie] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null))
  }, [])

  /* Lie la commande au compte connecté (elle sera alors visible sur tous ses appareils) */
  const rattacher = async () => {
    setOccupe(true)
    const { data, error } = await supabase.rpc('rattacher_commandes', { p_codes: [code] })
    setOccupe(false)
    if (error) {
      setMessage({ type: 'err', texte: messageErreurCommande(error) })
      return
    }
    setMessage(
      data > 0
        ? { type: 'ok', texte: 'Commande ajoutée à ton compte.' }
        : { type: 'err', texte: 'Cette commande est déjà liée à un autre compte.' }
    )
    charger()
  }

  const charger = async () => {
    const { data, error } = await supabase.rpc('suivre_commande', { p_code: code })
    if (error) { setEtat('introuvable'); return }
    setCommande(data)
    setEtat('ok')
    memoriserSuivi(code) // la commande apparaîtra dans "Mes commandes" sur cet appareil
  }

  useEffect(() => { if (code) charger() }, [code])

  const annuler = async () => {
    const ok = window.confirm(
      `Annuler la commande ${referenceCommande(commande.numero)} ?\n\nTu pourras toujours repasser commande plus tard.`
    )
    if (!ok) return
    setOccupe(true)
    const { error } = await supabase.rpc('annuler_commande_par_code', { p_code: code })
    setOccupe(false)
    if (error) {
      setMessage({ type: 'err', texte: messageErreurCommande(error) })
    } else {
      setMessage({ type: 'ok', texte: 'Ta commande est annulée.' })
    }
    charger()
  }

  const partager = async () => {
    const lien = lienSuivi(code)
    try {
      if (navigator.share) {
        await navigator.share({ title: `Suivi ${referenceCommande(commande.numero)}`, url: lien })
      } else {
        await navigator.clipboard.writeText(lien)
        setCopie(true)
        setTimeout(() => setCopie(false), 2000)
      }
    } catch { /* partage annulé par l'utilisateur : rien à faire */ }
  }

  /* ── États de chargement / erreur ── */
  if (etat !== 'ok') {
    return (
      <div className="sv-app">
        <style>{css}</style>
        <Header />
        <main className="sv-page">
          {etat === 'chargement' ? (
            <div role="status" aria-busy="true" className="sv-squelette">
              <span className="visually-hidden">Chargement de ta commande…</span>
              <Squelette hauteur={140} rayon={12} />
              <Squelette hauteur={220} rayon={12} />
            </div>
          ) : (
            <EtatVide
              icone={SearchX}
              texte="Commande introuvable. Le lien est peut-être incomplet : copie-le en entier depuis le message reçu, ou retrouve tes commandes dans « Mes commandes »."
              action={{ label: 'Mes commandes', href: '/commandes' }}
            />
          )}
        </main>
        <BarreNavMobile actif="commandes" />
      </div>
    )
  }

  const statut = STATUTS_COMMANDE[commande.statut] || { label: commande.statut, ton: 'gris' }
  const etapeActuelle = ETAPES.find((e) => e.id === commande.statut)
  const aPayer = commande.statut !== 'annulee' && commande.statut !== 'livree'
  const avecAvance = Number(commande.montant_avance_requis) > 0
  const aRembourser = remboursementReste(commande)
  const lignesVisibles = commande.lignes || []
  const lignesIndispo = lignesVisibles.filter((l) => l.etat === 'indisponible')

  return (
    <div className="sv-app">
      <style>{css}</style>
      <Header />

      <main className="sv-page">
        <a href="/commandes" className="sv-retour"><Icone icone={ArrowLeft} taille={18} /> Mes commandes</a>

        {/* ── En-tête : la réponse à "où en est ma commande ?" ── */}
        <section className={`sv-hero sv-hero-${statut.ton}`}>
          <div className="sv-hero-haut">
            <span className="sv-ref">{referenceCommande(commande.numero)}</span>
            <span className="sv-date">Passée le {formatDate(commande.created_at)}</span>
          </div>
          <h1>
            {commande.statut === 'annulee' ? 'Commande annulée'
              : commande.statut === 'echec_livraison' ? 'Livraison à reprogrammer'
              : etapeActuelle?.titre || statut.label}
          </h1>
          <p>
            {commande.statut === 'annulee' ? 'Cette commande ne sera pas livrée. Aucun paiement ne t\u2019est demandé.'
              : commande.statut === 'echec_livraison' ? 'Nous n\u2019avons pas pu te livrer. Nous te recontactons pour convenir d\u2019un nouveau passage.'
              : etapeActuelle?.detail}
          </p>
          {aPayer && (
            <div className="sv-montant">
              <span>{avecAvance ? 'Reste à payer à la livraison' : 'À payer à la livraison'}</span>
              <b>{formatKMF(resteALaLivraison(commande))} KMF</b>
            </div>
          )}
        </section>

        {message && <p role={message.type === 'err' ? 'alert' : 'status'} className={`sv-message sv-message-${message.type}`}>{message.texte}</p>}

        {!commande.rattachee && (
          <div className="sv-alerte">
            {user ? (
              <>
                <p style={{ margin: '0 0 12px' }}>
                  Cette commande a été passée sans compte. Ajoute-la au tien pour la retrouver sur tous tes appareils.
                </p>
                <button onClick={rattacher} disabled={occupe} className="sv-btn">
                  Ajouter à mon compte
                </button>
              </>
            ) : (
              <p style={{ margin: 0 }}>
                <a href={`/login?suite=/suivi/${code}`} style={{ color: C.ink, fontWeight: 700 }}>Connecte-toi ou crée un compte</a>,
                puis reviens sur ce lien.
              </p>
            )}
          </div>
        )}

        {avanceEnAttente(commande) && (
          <section className="sv-doree" aria-labelledby="t-avance">
            <h2 id="t-avance">Avance en attente : reste {formatKMF(avanceReste(commande))} KMF</h2>
            <p>
              Ta commande sera confirmée dès que l&apos;avance est reçue en entier. Rien n&apos;est acheté avant.
            </p>
            <InstructionsAvance montant={avanceReste(commande)} reference={referenceCommande(commande.numero)} />
          </section>
        )}

        {commande.statut === 'annulee' && (aRembourser > 0 || Number(commande.montant_rembourse) > 0) && (
          <section className="sv-doree" aria-labelledby="t-remb">
            <h2 id="t-remb">Remboursement</h2>
            {aRembourser > 0 && <p><b>{formatKMF(aRembourser)} KMF à vous rembourser.</b> Notre équipe te contacte pour te les remettre.</p>}
            {Number(commande.montant_rembourse) > 0 && <p>Remboursé : {formatKMF(commande.montant_rembourse)} KMF</p>}
          </section>
        )}

        {lignesIndispo.length > 0 && commande.statut !== 'annulee' && (
          <p className="sv-alerte">
            {lignesIndispo.length > 1 ? 'Certains produits sont' : 'Un produit est'} en rupture chez notre fournisseur.
            Nous te contactons pour te proposer une solution.
          </p>
        )}

        <div className="sv-grille">
          {/* ── La frise ── */}
          <section className="sv-carte" aria-labelledby="t-etapes">
            <h2 id="t-etapes">Suivi</h2>
            <FriseCommande statut={commande.statut} etapesDatees={commande.etapes} />
          </section>

          <div>
            {/* ── Contenu ── */}
            <section className="sv-carte" aria-labelledby="t-contenu">
              <h2 id="t-contenu">Contenu</h2>
              <ul className="sv-lignes">
                {lignesVisibles.map((l, i) => (
                  <li key={i} className={`sv-ligne ${l.etat === 'retiree' ? 'sv-retiree' : ''}`}>
                    <span className="sv-thumb"><ProduitImage produit={l} emojiSize={20} /></span>
                    <span className="sv-ligne-info">
                      <b>{l.nom}</b>
                      <span>
                        {l.etat === 'retiree' ? 'Retiré de la commande'
                          : l.etat === 'indisponible' ? 'En rupture chez le fournisseur'
                          : `${l.quantite} × ${formatKMF(l.prix_unitaire)} KMF`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="sv-totaux">
                {Number(commande.montant_livraison) > 0 && (
                  <div><dt>Livraison</dt><dd>{formatKMF(commande.montant_livraison)} KMF</dd></div>
                )}
                <div className="sv-total"><dt>Total</dt><dd>{formatKMF(commande.montant_total)} KMF</dd></div>
                {Number(commande.montant_avance_recu) > 0 && (
                  <div><dt>Avance reçue</dt><dd>{formatKMF(commande.montant_avance_recu)} KMF</dd></div>
                )}
              </dl>
            </section>

            {/* ── Livraison ── */}
            <section className="sv-carte" aria-labelledby="t-livraison">
              <h2 id="t-livraison">Livraison</h2>
              <p className="sv-adresse">
                <b>{commande.prenom}</b><br />
                {labelIle(commande.ile)} — {commande.adresse_livraison}<br />
                <span>Téléphone : {commande.telephone_masque}</span>
              </p>
            </section>

            {/* ── Actions ── */}
            <div className="sv-actions">
              <button onClick={partager} className="sv-btn-secondaire">{copie ? <><Icone icone={Check} taille={18} /> Lien copié</> : 'Partager ce suivi'}</button>
              {WHATSAPP_SERVICE && (
                <a className="sv-btn-secondaire" target="_blank" rel="noopener noreferrer"
                  href={lienWhatsApp(WHATSAPP_SERVICE, `Bonjour, j'ai une question sur ma commande ${referenceCommande(commande.numero)}.`)}>
                  Écrire au service client
                </a>
              )}
              {commande.peut_annuler && (
                <button onClick={annuler} disabled={occupe} className="sv-btn-annuler">
                  {occupe ? 'Annulation…' : 'Annuler ma commande'}
                </button>
              )}
            </div>
            {commande.peut_annuler && (
              <p className="sv-aide">Tu peux annuler toi-même tant que nous ne t&apos;avons pas appelé pour confirmer.</p>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <BarreNavMobile actif="commandes" />
    </div>
  )
}

const css = `
  * { box-sizing: border-box; }
  .sv-app { background: ${C.bgGrey}; min-height: 100vh; color: ${C.inkDeep}; font-family: var(--font-jakarta), system-ui, sans-serif; padding-bottom: 72px; }

  .sv-page { max-width: 980px; margin: 0 auto; padding: 16px; }
  .sv-retour { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; font-size: 15px; font-weight: 700; color: ${C.ink}; text-decoration: none; }
  .sv-squelette { display: flex; flex-direction: column; gap: 12px; }

  /* ── En-tête ── */
  .sv-hero { background: ${C.ink}; color: #fff; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .sv-hero-vert { background: ${C.leaf}; }
  .sv-hero-rouge { background: ${C.clay}; }
  .sv-hero-gris { background: ${C.inkSoft}; }
  .sv-hero-or { background: ${C.inkDeep}; }
  .sv-hero-haut { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 14px; }
  .sv-ref { font-weight: 800; }
  .sv-hero h1 { font-size: 24px; font-weight: 800; margin: 12px 0 8px; }
  .sv-hero p { font-size: 15px; line-height: 1.5; margin: 0; max-width: 520px; }
  .sv-montant {
    display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap;
    margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.3);
  }
  .sv-montant span { font-size: 14px; }
  .sv-montant b { font-size: 22px; font-weight: 800; }

  .sv-message { font-size: 15px; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; font-weight: 600; }
  .sv-message-ok { background: #E8F5EE; color: #2c6e4d; }
  .sv-message-err { background: #FBF0EE; color: #a8453a; }
  .sv-alerte { font-size: 15px; background: ${C.white}; border: 1px solid ${C.line}; color: ${C.inkDeep}; border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; line-height: 1.5; }

  .sv-doree {
    background: #fbf0d9; border: 1px solid #e6c987; color: #4d3305; border-radius: 12px;
    padding: 16px; margin: 0 0 16px;
  }
  .sv-doree h2 { font-size: 18px; font-weight: 800; margin: 0 0 8px; }
  .sv-doree p { font-size: 15px; line-height: 1.5; margin: 0 0 12px; }
  .sv-doree p:last-child { margin-bottom: 0; }
  .sv-doree .ia-titre, .sv-doree .ia-liste { color: #4d3305; }
  .sv-grille { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .sv-carte { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .sv-carte h2 { font-size: 18px; font-weight: 800; margin: 0 0 16px; }

  .sv-lignes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .sv-ligne { display: flex; gap: 12px; align-items: center; }
  .sv-retiree { opacity: 0.55; }
  .sv-retiree b { text-decoration: line-through; }
  .sv-thumb { width: 52px; height: 52px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: ${C.sand}; display: flex; align-items: center; justify-content: center; }
  .sv-ligne-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sv-ligne-info b { font-size: 15px; overflow-wrap: anywhere; }
  .sv-ligne-info span { font-size: 14px; color: ${C.inkSoft}; }

  .sv-totaux { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid ${C.line}; display: flex; flex-direction: column; gap: 6px; }
  .sv-totaux div { display: flex; justify-content: space-between; gap: 12px; font-size: 15px; }
  .sv-totaux dt { color: ${C.inkSoft}; }
  .sv-totaux dd { margin: 0; font-weight: 700; }
  .sv-total dd { font-size: 18px; font-weight: 800; }
  .sv-total dt { color: ${C.inkDeep} !important; font-weight: 700; }

  .sv-adresse { font-size: 15px; line-height: 1.6; margin: 0; overflow-wrap: anywhere; }
  .sv-adresse span { color: ${C.inkSoft}; font-size: 14px; }

  .sv-actions { display: flex; flex-direction: column; gap: 10px; }
  .sv-btn, .sv-btn-secondaire, .sv-btn-annuler {
    display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 48px; padding: 0 16px;
    border-radius: 8px; font-family: inherit; font-size: 15px; font-weight: 700; text-decoration: none; cursor: pointer;
  }
  .sv-btn { background: ${C.ink}; color: ${C.white}; border: none; display: inline-flex; }
  .sv-btn:hover { background: ${C.inkDeep}; }
  .sv-btn:disabled { opacity: 0.6; cursor: wait; }
  .sv-btn-secondaire { background: ${C.white}; border: 1.5px solid ${C.line}; color: ${C.inkDeep}; }
  .sv-btn-secondaire:hover { border-color: ${C.inkSoft}; }
  .sv-btn-annuler { background: ${C.white}; border: 1.5px solid #e9c9c4; color: ${C.clay}; }
  .sv-btn-annuler:hover { background: #fbf0ee; }
  .sv-btn-annuler:disabled { opacity: 0.6; cursor: wait; }
  .sv-aide { font-size: 14px; color: ${C.inkSoft}; text-align: center; margin: 12px 0 0; }

  @media (min-width: 820px) {
    .sv-page { padding: 24px 20px; }
    .sv-grille { grid-template-columns: 1fr 1.15fr; align-items: start; }
    .sv-hero { padding: 26px 28px; }
    .sv-hero h1 { font-size: 30px; }
  }
  @media (min-width: 1000px) { .sv-app { padding-bottom: 0; } }
`