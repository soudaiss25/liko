'use client'

/* ─────────── app/admin/page.js ───────────
   Espace admin — pas de Header/Footer client (voir note du projet).
   Gate d'accès : réservé aux comptes avec role = 'admin'.

   Rôle de cette page = le "chef d'orchestre" :
   1. vérifie que tu es admin (lib/garde.js : login redemandé si accès direct par l'URL)
   2. charge les données UNE fois (produits + commandes + lignes de commande)
   3. affiche le bon écran selon l'onglet :
        Tableau de bord  → components/admin/Dashboard.js
        Produits         → components/admin/ListeProduits.js
        Formulaire       → components/admin/FormulaireProduit.js
        Commandes        → components/admin/Commandes.js
        Collaborateurs   → components/admin/Collaborateurs.js
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useGardeAcces } from '@/lib/garde'
import { supprimerPhotosProduit } from '@/lib/photos'
import { calculerVentes } from '@/lib/ventes'
import Dashboard from '@/components/admin/Dashboard'
import ListeProduits, { FILTRES_VIDES } from '@/components/admin/ListeProduits'
import FormulaireProduit from '@/components/admin/FormulaireProduit'
import Collaborateurs from '@/components/admin/Collaborateurs'
import Commandes from '@/components/admin/Commandes'

const C = {
  ink: '#1D4E63', inkDeep: '#143A4B', inkSoft: '#6E8A97',
  sand: '#F4F1EA', line: '#E4DED2',
  gold: '#E8A020', goldDeep: '#C6851A',
  leaf: '#3E9268', clay: '#C2574A', white: '#FFFFFF',
  bgGrey: '#F2F3F5',
}

export default function Admin() {
  const supabase = createClient()

  /* ── Accès (redirection vers /login gérée par la garde) ── */
  const { etat, profil } = useGardeAcces(['admin'])
  const autorise = etat === 'ok'
  const prenom = profil?.prenom || ''

  /* ── Données ── */
  const [produits, setProduits] = useState([])
  const [commandes, setCommandes] = useState([])
  const [items, setItems] = useState([])
  const [chargementDonnees, setChargementDonnees] = useState(true)
  const [alerteDonnees, setAlerteDonnees] = useState('')

  /* ── Navigation ── */
  const [vue, setVue] = useState('dashboard') // 'dashboard' | 'commandes' | 'produits' | 'form' | 'collaborateurs'
  const [produitEdite, setProduitEdite] = useState(null) // null = nouveau produit
  const [filtres, setFiltres] = useState(FILTRES_VIDES)

  /* ── Chargement des données ──
     Promise.all lance les 3 requêtes EN MÊME TEMPS au lieu de l'une après l'autre
     → la page s'affiche plus vite. */
  const chargerDonnees = async () => {
    setChargementDonnees(true)
    setAlerteDonnees('')

    const [resProduits, resCommandes, resItems] = await Promise.all([
      supabase.from('produits').select('*').order('created_at', { ascending: false }),
      supabase.from('commandes').select('id, statut, ile, montant_total, created_at'),
      supabase.from('commande_items').select('commande_id, produit_id, quantite, prix_unitaire'),
    ])

    setProduits(resProduits.data || [])
    setCommandes(resCommandes.data || [])
    setItems(resItems.data || [])

    if (resCommandes.error || resItems.error) {
      setAlerteDonnees('Les ventes ne peuvent pas être lues. Vérifie que le SQL des droits admin sur les commandes a bien été lancé.')
    }
    setChargementDonnees(false)
  }

  useEffect(() => {
    if (autorise) chargerDonnees()
  }, [autorise])

  /* Nombre de commandes qui attendent ton appel de confirmation (pastille sur l'onglet) */
  const aConfirmer = commandes.filter((c) => c.statut === 'recue').length

  /* Ventes de chaque produit depuis le début (pour la liste : "12 vendus", tri…) */
  const ventesParProduit = calculerVentes({ commandes, items, produits }).parProduit

  /* ── Navigation ── */
  const allerA = (nouvelleVue) => setVue(nouvelleVue)

  // Appelé par le tableau de bord : ouvre la liste avec des filtres déjà réglés
  const voirProduits = (filtresPartiels) => {
    setFiltres({ ...FILTRES_VIDES, ...filtresPartiels })
    setVue('produits')
  }

  const ouvrirAjout = () => { setProduitEdite(null); setVue('form') }
  const ouvrirEdition = (p) => { setProduitEdite(p); setVue('form') }
  const fermerFormulaire = () => setVue('produits')
  const apresEnregistrement = () => { setVue('produits'); chargerDonnees() }

  /* ── Actions sur un produit ── */
  const toggleActif = async (p) => {
    await supabase.from('produits').update({ actif: !p.actif }).eq('id', p.id)
    chargerDonnees()
  }

  const supprimer = async (p) => {
    if (!window.confirm(`Supprimer « ${p.nom} » ? Cette action est définitive.`)) return

    const { error } = await supabase.from('produits').delete().eq('id', p.id)
    if (error) {
      // Cas fréquent : le produit apparaît dans une commande → la base refuse
      window.alert('Suppression impossible : ' + error.message + '\n\nAstuce : tu peux plutôt le masquer.')
      return
    }
    await supprimerPhotosProduit(supabase, p.images || [])
    chargerDonnees()
  }

  const deconnexion = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  /* ═══════════ Chargement ═══════════ */
  if (etat === 'verification') {
    return (
      <div className="app">
        <style>{css}</style>
        <div className="state">Vérification de l'accès…</div>
      </div>
    )
  }

  /* ═══════════ Accès refusé ═══════════ */
  if (!autorise) {
    return (
      <div className="app">
        <style>{css}</style>
        <div className="refuse-box">
          <div className="refuse-emoji">🔒</div>
          <h1 className="refuse-title">Accès réservé</h1>
          <p className="refuse-sub">Cette page est réservée aux administrateurs de Salut Marketplace.</p>
          <a href="/" className="refuse-btn">Retour à l'accueil</a>
        </div>
      </div>
    )
  }

  /* ═══════════ Espace admin ═══════════ */
  const ongletActif = vue === 'form' ? 'produits' : vue

  return (
    <div className="app">
      <style>{css}</style>

      {/* ── Barre admin (distincte du site client) ── */}
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-brand">
            <img src="/logo.png" alt="Salut" className="admin-logo" />
            <div>
              <div className="admin-title">Espace Admin</div>
              <div className="admin-sub">Connecté en tant que {prenom || 'admin'}</div>
            </div>
          </div>
          <div className="admin-actions">
            <a href="/" className="admin-link">Voir le site →</a>
            <button onClick={deconnexion} className="admin-logout">Déconnexion</button>
          </div>
        </div>

        {/* ── Onglets ── */}
        <nav className="admin-tabs" aria-label="Sections de l'admin">
          <div className="admin-tabs-inner">
            <button
              onClick={() => allerA('dashboard')}
              aria-current={ongletActif === 'dashboard' ? 'page' : undefined}
              className={`admin-tab ${ongletActif === 'dashboard' ? 'admin-tab-on' : ''}`}
            >
              📊 Tableau de bord
            </button>
            <button
              onClick={() => allerA('commandes')}
              aria-current={ongletActif === 'commandes' ? 'page' : undefined}
              className={`admin-tab ${ongletActif === 'commandes' ? 'admin-tab-on' : ''}`}
            >
              🛎️ Commandes
              {aConfirmer > 0 && <span className="admin-tab-nb admin-tab-alerte">{aConfirmer}</span>}
            </button>
            <button
              onClick={() => allerA('produits')}
              aria-current={ongletActif === 'produits' ? 'page' : undefined}
              className={`admin-tab ${ongletActif === 'produits' ? 'admin-tab-on' : ''}`}
            >
              📦 Produits <span className="admin-tab-nb">{produits.length}</span>
            </button>
            <button
              onClick={() => allerA('collaborateurs')}
              aria-current={ongletActif === 'collaborateurs' ? 'page' : undefined}
              className={`admin-tab ${ongletActif === 'collaborateurs' ? 'admin-tab-on' : ''}`}
            >
              🤝 Collaborateurs
            </button>
          </div>
        </nav>
      </header>

      <main className="wrap">
        {alerteDonnees && <p role="alert" className="err">{alerteDonnees}</p>}

        {vue === 'collaborateurs' ? (
          <Collaborateurs />
        ) : vue === 'commandes' ? (
          <Commandes onChange={chargerDonnees} />
        ) : chargementDonnees && produits.length === 0 ? (
          <div className="state">Chargement…</div>
        ) : vue === 'dashboard' ? (
          <Dashboard
            produits={produits}
            commandes={commandes}
            items={items}
            onVoirProduits={voirProduits}
            onActualiser={chargerDonnees}
          />
        ) : vue === 'produits' ? (
          <ListeProduits
            produits={produits}
            ventesParProduit={ventesParProduit}
            filtres={filtres}
            setFiltres={setFiltres}
            onAjouter={ouvrirAjout}
            onModifier={ouvrirEdition}
            onToggleActif={toggleActif}
            onSupprimer={supprimer}
          />
        ) : (
          <FormulaireProduit
            // key : force un formulaire "neuf" quand on change de produit
            key={produitEdite ? produitEdite.id : 'nouveau'}
            produit={produitEdite}
            onAnnuler={fermerFormulaire}
            onEnregistre={apresEnregistrement}
          />
        )}

        <div style={{ height: '40px' }} />
      </main>
    </div>
  )
}

/* ─────────── CSS ───────────
   Ici : uniquement le style COMMUN à tout l'admin (barre, onglets, boutons, champs).
   Chaque composant (Dashboard, ListeProduits, FormulaireProduit) apporte son propre style. */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }

  .app {
    background: ${C.bgGrey}; min-height: 100vh;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: ${C.inkDeep};
  }

  .state { text-align: center; padding: 100px 20px; color: ${C.inkSoft}; font-size: 15px; }

  /* Cache un élément à l'écran mais le garde accessible (lecteurs d'écran, clavier) */
  .visually-hidden {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }

  /* ── Accès refusé ── */
  .refuse-box { max-width: 420px; margin: 100px auto; text-align: center; padding: 20px; }
  .refuse-emoji { font-size: 50px; margin-bottom: 14px; }
  .refuse-title { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
  .refuse-sub { font-size: 14px; color: ${C.inkSoft}; margin-bottom: 22px; }
  .refuse-btn {
    display: inline-block; background: ${C.ink}; color: #fff; text-decoration: none;
    padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 14px;
  }

  /* ── Barre admin ── */
  .admin-header { background: ${C.inkDeep}; position: sticky; top: 0; z-index: 30; }
  .admin-header-inner {
    max-width: 1100px; margin: 0 auto; padding: 14px 20px 10px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  }
  .admin-brand { display: flex; align-items: center; gap: 12px; }
  .admin-logo { width: 40px; height: 40px; object-fit: contain; background: #fff; border-radius: 8px; padding: 3px; }
  .admin-title { font-size: 15px; font-weight: 800; color: #fff; }
  .admin-sub { font-size: 12px; color: rgba(255,255,255,0.6); }
  .admin-actions { display: flex; align-items: center; gap: 14px; }
  .admin-link { font-size: 13px; color: ${C.gold}; text-decoration: none; font-weight: 600; }
  .admin-logout {
    background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer;
    padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: inherit;
  }
  .admin-logout:hover { background: rgba(255,255,255,0.18); }

  /* ── Onglets ── */
  .admin-tabs-inner {
    max-width: 1100px; margin: 0 auto; padding: 0 20px;
    display: flex; gap: 4px; overflow-x: auto;
  }
  .admin-tab {
    background: none; border: none; cursor: pointer; font-family: inherit;
    font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.6);
    padding: 12px 14px; border-bottom: 3px solid transparent; white-space: nowrap;
  }
  .admin-tab:hover { color: #fff; }
  .admin-tab-on { color: #fff; border-bottom-color: ${C.gold}; }
  .admin-tab-nb {
    font-size: 11px; background: rgba(255,255,255,0.15); padding: 2px 7px; border-radius: 10px; margin-left: 4px;
  }
  .admin-tab-alerte { background: ${C.gold}; color: ${C.inkDeep}; font-weight: 800; }

  .wrap { max-width: 1100px; margin: 0 auto; padding: 24px 20px; }

  /* ── Éléments communs utilisés par tous les composants admin ── */
  .page-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 14px; margin-bottom: 18px; flex-wrap: wrap;
  }
  .page-title { font-size: 22px; font-weight: 800; color: ${C.inkDeep}; margin: 0; }
  .page-sub { font-size: 13px; color: ${C.inkSoft}; margin: 4px 0 0; }

  .btn-primary {
    background: ${C.ink}; color: #fff; border: none; cursor: pointer;
    padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 700; font-family: inherit;
    white-space: nowrap;
  }
  .btn-primary:hover { background: ${C.inkDeep}; }
  .btn-primary:disabled { background: ${C.line}; color: #A9B4B9; cursor: not-allowed; }
  .btn-secondary {
    background: #fff; color: ${C.inkSoft}; border: 1.5px solid ${C.line}; cursor: pointer;
    padding: 11px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: inherit;
  }
  .btn-secondary:hover { border-color: ${C.inkSoft}; color: ${C.inkDeep}; }

  .field { margin-bottom: 18px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .label { display: block; font-size: 13px; font-weight: 700; color: ${C.inkDeep}; margin-bottom: 8px; }
  .optional { font-weight: 500; color: ${C.inkSoft}; font-size: 11.5px; }

  .input {
    width: 100%; padding: 0 14px; height: 46px; border-radius: 10px;
    border: 1.5px solid ${C.line}; background: ${C.sand}; font-size: 14px; font-family: inherit;
    color: ${C.inkDeep}; outline: none;
  }
  .input:focus { border-color: ${C.ink}; background: #fff; }
  .textarea { height: auto; padding: 12px 14px; resize: vertical; }

  .checkbox-row { display: flex; align-items: center; gap: 10px; font-size: 14px; color: ${C.inkDeep}; cursor: pointer; }
  .checkbox-row input { width: 18px; height: 18px; cursor: pointer; }

  .err {
    font-size: 13px; color: ${C.clay}; background: #FBF0EE; border: 1px solid #F0D9D5;
    border-radius: 10px; padding: 10px 12px; margin: 0 0 14px;
  }

  button:focus-visible, a:focus-visible, .input:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }

  @media (max-width: 700px) {
    .row { grid-template-columns: 1fr; }
    .admin-header-inner { padding: 12px 16px 8px; }
    .admin-sub { display: none; }
    .wrap { padding: 18px 14px; }
  }
`