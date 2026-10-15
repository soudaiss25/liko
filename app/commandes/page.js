'use client'

/* ─────────── app/commandes/page.js ───────────
   "Mes commandes" :
   - connecté  → les commandes liées à son compte + celles suivies depuis cet
                 appareil (sauf celles liées à un autre compte). Celles sans
                 compte peuvent être ajoutées au sien d'un clic.
   - sans compte → les commandes suivies depuis CET appareil
   Les deux listes sont fusionnées, sans doublon.
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BarreNavMobile from '@/components/BarreNavMobile'
import ProduitImage from '@/components/ProduitImage'
import { formatKMF } from '@/lib/produit'
import {
  STATUTS_COMMANDE, referenceCommande, formatDate, suivisMemorises, messageErreurCommande,
} from '@/lib/commandes'

import { C } from '@/lib/theme'
const EN_COURS = ['recue', 'confirmee', 'en_achat', 'expediee', 'arrivee', 'en_livraison', 'echec_livraison']

export default function PageMesCommandes() {
  const supabase = createClient()
  const [commandes, setCommandes] = useState([])
  const [connecte, setConnecte] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState(null)

  const charger = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setConnecte(!!user)

    // 1. Commandes du compte (uniquement celles liées à CE compte)
    let duCompte = []
    if (user) {
      const { data } = await supabase.rpc('mes_commandes')
      duCompte = data || []
    }

    // 2. Commandes suivies depuis cet appareil (on ne recharge que celles qu'on n'a pas déjà)
    const connus = new Set(duCompte.map((c) => c.code_suivi))
    const codes = suivisMemorises().filter((c) => !connus.has(c))
    const reponses = await Promise.all(codes.map((code) => supabase.rpc('suivre_commande', { p_code: code })))
    const deLAppareil = reponses
      .map((r, i) => (r.data ? {
        numero: r.data.numero, statut: r.data.statut, created_at: r.data.created_at,
        montant_total: r.data.montant_total, code_suivi: codes[i],
        rattachee: r.data.rattachee, a_moi: r.data.a_moi,
        apercu: (r.data.lignes || []).filter((l) => l.etat !== 'retiree').slice(0, 3),
        nb_articles: (r.data.lignes || []).filter((l) => l.etat !== 'retiree').reduce((s, l) => s + l.quantite, 0),
      } : null))
      .filter(Boolean)
      // Connecté : on masque celles qui appartiennent à un autre compte
      .filter((c) => !(user && c.rattachee && !c.a_moi))

    const toutes = [...duCompte, ...deLAppareil].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setCommandes(toutes)
    setChargement(false)
  }

  useEffect(() => { charger() }, [])

  /* Commandes de cet appareil pas encore liées à un compte */
  const sansCompte = commandes.filter((c) => c.rattachee === false)

  const rattacherTout = async () => {
    const codes = sansCompte.map((c) => c.code_suivi)
    setOccupe(true)
    const { data, error } = await supabase.rpc('rattacher_commandes', { p_codes: codes })
    setOccupe(false)
    if (error) {
      setMessage({ type: 'err', texte: messageErreurCommande(error) })
      return
    }
    setMessage({ type: 'ok', texte: `${data} commande${data > 1 ? 's' : ''} ajoutée${data > 1 ? 's' : ''} à ton compte` })
    charger()
  }

  const enCours = commandes.filter((c) => EN_COURS.includes(c.statut))
  const terminees = commandes.filter((c) => !EN_COURS.includes(c.statut))

  return (
    <div className="mc-app">
      <style>{css}</style>
      <Header />

      <main className="mc-page">
        <h1 className="mc-titre">Mes commandes</h1>

        {chargement ? (
          <p className="mc-etat">Chargement…</p>
        ) : commandes.length === 0 ? (
          <div className="mc-vide">
            <div className="mc-vide-emoji" aria-hidden="true">📦</div>
            <h2>Aucune commande à afficher</h2>
            {connecte ? (
              <p>Tes commandes apparaîtront ici dès ta première commande.</p>
            ) : (
              <p>
                Tu as commandé sans compte ? Ouvre le lien de suivi reçu après ta commande.
                Tu peux aussi te connecter pour retrouver toutes tes commandes.
              </p>
            )}
            <div className="mc-vide-actions">
              <a href="/" className="mc-btn">Voir le catalogue</a>
              {!connecte && <a href="/login?suite=/commandes" className="mc-lien">Se connecter</a>}
            </div>
          </div>
        ) : (
          <>
            {!connecte && (
              <p className="mc-info">
                Ces commandes ont été suivies depuis cet appareil.{' '}
                <a href="/login?suite=/commandes">Connecte-toi</a> pour les retrouver sur tous tes appareils.
              </p>
            )}
            {message && <p role={message.type === 'err' ? 'alert' : 'status'} className={`mc-info mc-msg-${message.type}`}>{message.texte}</p>}
            {connecte && sansCompte.length > 0 && (
              <div className="mc-rattacher">
                <p>
                  {sansCompte.length} commande{sansCompte.length > 1 ? 's' : ''} passée{sansCompte.length > 1 ? 's' : ''} sans compte sur cet appareil.
                  Ajoute-{sansCompte.length > 1 ? 'les' : 'la'} à ton compte pour {sansCompte.length > 1 ? 'les' : 'la'} retrouver partout.
                </p>
                <button onClick={rattacherTout} disabled={occupe} className="mc-btn" style={{ border: 'none', cursor: 'pointer' }}>
                  Ajouter à mon compte
                </button>
              </div>
            )}
            <Section titre="En cours" liste={enCours} />
            <Section titre="Terminées" liste={terminees} />
          </>
        )}
      </main>

      <Footer />
      <BarreNavMobile actif="commandes" />
    </div>
  )
}

function Section({ titre, liste }) {
  if (liste.length === 0) return null
  return (
    <section className="mc-section" aria-label={titre}>
      <h2 className="mc-section-titre">{titre} <span>{liste.length}</span></h2>
      <ul className="mc-liste">
        {liste.map((c) => {
          const s = STATUTS_COMMANDE[c.statut] || { label: c.statut, ton: 'gris' }
          return (
            <li key={c.code_suivi}>
              <a href={`/suivi/${c.code_suivi}`} className="mc-carte">
                <span className="mc-carte-haut">
                  <b>{referenceCommande(c.numero)}</b>
                  <span className={`mc-badge mc-badge-${s.ton}`}>{s.label}</span>
                </span>
                <span className="mc-apercu">
                  {(c.apercu || []).map((p, i) => (
                    <span key={i} className="mc-thumb"><ProduitImage produit={p} emojiSize={18} /></span>
                  ))}
                  <span className="mc-apercu-texte">
                    {c.nb_articles} article{c.nb_articles > 1 ? 's' : ''}<br />
                    <span>{formatDate(c.created_at)}</span>
                  </span>
                </span>
                <span className="mc-carte-bas">
                  <b>{formatKMF(c.montant_total)} KMF</b>
                  <span className="mc-voir">Voir le suivi</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const css = `
  .mc-rattacher { background: #FFF6E4; border: 1px solid #F1DDAE; color: #7A5C1E; border-radius: 12px; padding: 14px; margin: 0 0 16px; font-size: 14px; line-height: 1.5; }
  .mc-rattacher p { margin: 0 0 10px; }
  .mc-rattacher button:disabled { opacity: 0.6; cursor: wait; }
  .mc-msg-ok { color: ${C.leaf}; font-weight: 600; }
  .mc-msg-err { color: ${C.clay}; font-weight: 600; }
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }
  .mc-app { background: ${C.bgGrey}; min-height: 100vh; color: ${C.inkDeep}; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; padding-bottom: 72px; }
  .mc-page { max-width: 820px; margin: 0 auto; padding: 18px 16px 30px; }
  .mc-titre { font-size: 24px; font-weight: 800; margin: 4px 0 16px; letter-spacing: -0.3px; }
  .mc-etat { color: ${C.inkSoft}; text-align: center; padding: 50px 0; }

  .mc-info { font-size: 13.5px; background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 12px 14px; margin: 0 0 18px; line-height: 1.5; color: ${C.inkSoft}; }
  .mc-info a { color: ${C.ink}; font-weight: 700; }

  .mc-vide { text-align: center; background: #fff; border: 1px solid ${C.line}; border-radius: 18px; padding: 40px 20px; }
  .mc-vide-emoji { font-size: 42px; margin-bottom: 8px; }
  .mc-vide h2 { font-size: 18px; margin: 0 0 8px; }
  .mc-vide p { font-size: 14px; color: ${C.inkSoft}; line-height: 1.55; margin: 0 auto 18px; max-width: 420px; }
  .mc-vide-actions { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .mc-btn { display: inline-flex; align-items: center; min-height: 50px; padding: 0 22px; border-radius: 12px; background: ${C.gold}; color: ${C.inkDeep}; font-weight: 800; text-decoration: none; }
  .mc-lien { font-weight: 700; color: ${C.ink}; }

  .mc-section { margin-bottom: 22px; }
  .mc-section-titre { font-size: 15px; font-weight: 800; margin: 0 0 10px; color: ${C.inkSoft}; }
  .mc-section-titre span { font-size: 12px; background: #fff; border: 1px solid ${C.line}; border-radius: 10px; padding: 1px 8px; margin-left: 4px; }

  .mc-liste { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .mc-carte {
    display: flex; flex-direction: column; gap: 12px; background: #fff; border: 1px solid ${C.line};
    border-radius: 16px; padding: 14px 16px; text-decoration: none; color: ${C.inkDeep};
  }
  .mc-carte:hover { border-color: ${C.inkSoft}; }
  .mc-carte-haut { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .mc-carte-haut b { font-size: 15px; }
  .mc-badge { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; }
  .mc-badge-or { background: #FFF1D6; color: #9A6A12; }
  .mc-badge-bleu { background: #E7EFF2; color: ${C.ink}; }
  .mc-badge-vert { background: #E8F5EE; color: ${C.leaf}; }
  .mc-badge-rouge { background: #FBF0EE; color: ${C.clay}; }
  .mc-badge-gris { background: #EDEFF1; color: ${C.inkSoft}; }

  .mc-apercu { display: flex; align-items: center; gap: 8px; }
  .mc-thumb { width: 46px; height: 46px; border-radius: 10px; overflow: hidden; background: ${C.sand}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .mc-apercu-texte { font-size: 13px; font-weight: 600; margin-left: 4px; line-height: 1.4; }
  .mc-apercu-texte span { color: ${C.inkSoft}; font-weight: 500; font-size: 12.5px; }

  .mc-carte-bas { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid ${C.line}; padding-top: 10px; }
  .mc-carte-bas b { font-size: 16px; }
  .mc-voir { font-size: 13.5px; font-weight: 700; color: ${C.ink}; }

  a:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }

  @media (min-width: 700px) { .mc-liste { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1000px) { .mc-app { padding-bottom: 0; } }
`