'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import { normaliserTexte } from '@/lib/produit'

import { C } from '@/lib/theme'
/* ─────────── Palette (du logo) ─────────── */
const CATEGORIES = ['Tout', 'Vêtements', 'Chaussures', 'Beauté', 'Accessoires', 'Maison', 'Tech']

export default function Catalogue() {
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [profil, setProfil] = useState(null)
  const [produits, setProduits] = useState([])
  const [chargement, setChargement] = useState(true)

  const [categorie, setCategorie] = useState('Tout')
  const [recherche, setRecherche] = useState('')
  const [favoris, setFavoris] = useState([])

  useEffect(() => {
    const chargerUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        // Le rôle sert à afficher le raccourci "Admin" dans la barre du bas
        const { data } = await supabase.from('users').select('prenom, role').eq('id', user.id).single()
        setProfil(data)
      }
    }
    chargerUser()
  }, [])

  useEffect(() => {
    const chargerProduits = async () => {
      setChargement(true)
      const { data, error } = await supabase
        .from('produits').select('*').eq('actif', true)
        .order('created_at', { ascending: false })
      if (!error && data) setProduits(data)
      setChargement(false)
    }
    chargerProduits()
  }, [])

  /* Recherche sans accents ni majuscules : "boubou brode" trouve "Boubou brodé" */
  const q = normaliserTexte(recherche)
  const produitsFiltres = produits.filter((p) => {
    const matchCat = categorie === 'Tout' || p.categorie === categorie
    const matchRecherche = !q || normaliserTexte(`${p.nom} ${p.description || ''}`).includes(q)
    return matchCat && matchRecherche
  })

  const toggleFavori = (id) =>
    setFavoris((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))

  /* Le bouton "Découvrir" du bandeau descend jusqu'aux produits */
  const allerAuxProduits = () =>
    document.getElementById('produits')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  /* Barre du bas : uniquement des pages qui existent.
     - "Commandes" est ouvert à tous : un client sans compte y retrouve
       les commandes passées depuis son téléphone
     - un admin a un raccourci vers son espace (en passant par un lien du site,
       on ne lui redemande pas de se connecter) */
  const navigation = [
    { icon: '🏠', label: 'Accueil', href: '/', active: true },
    { icon: '🛒', label: 'Panier', href: '/panier' },
    { icon: '📦', label: 'Commandes', href: '/commandes' },
    ...(!user ? [{ icon: '👤', label: 'Connexion', href: '/login' }] : []),
    ...(profil?.role === 'admin' ? [{ icon: '⚙️', label: 'Admin', href: '/admin' }] : []),
  ]

  return (
    <div className="app">
      <style>{css}</style>

      <Header search={recherche} onSearchChange={setRecherche} />

      {/* ════════ RAIL CATÉGORIES ════════ */}
      <nav className="catrail" aria-label="Catégories">
        <div className="catrail-inner">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setCategorie(cat)}
              aria-pressed={categorie === cat}
              className={`catchip ${categorie === cat ? 'catchip-on' : ''}`}>
              {cat}
            </button>
          ))}
        </div>
      </nav>

      <div className="wrap">

        {/* ════════ BANDEAUX PROMO ════════ */}
        <div className="promos">
          <div className="promo promo-main">
            <div className="promo-text">
              <div className="promo-kicker">ARRIVAGE DE CHINE</div>
              <div className="promo-title">Prix direct usine</div>
              <div className="promo-sub">Livraison 15–30 jours · Payez à la réception</div>
              <button className="promo-cta" onClick={allerAuxProduits}>Découvrir →</button>
            </div>
            <div className="promo-emoji">📦</div>
          </div>

          <div className="promo-side">
            <div className="promo-small">
              <div>
                <div className="promo-small-title">Achat en gros</div>
                <div className="promo-small-sub">Tarifs dégressifs</div>
              </div>
              <span>🏷️</span>
            </div>
            <div className="promo-small">
              <div>
                <div className="promo-small-title">Nouveautés</div>
                <div className="promo-small-sub">Chaque semaine</div>
              </div>
              <span>✨</span>
            </div>
          </div>
        </div>

        {/* Bandeau invité : on rassure (pas de compte obligatoire) au lieu de pousser à se connecter */}
        {!user && (
          <div className="guest-banner">
            <span>💡 Pas besoin de compte pour commander : tu paies à la livraison.</span>
            <a href="/login" className="guest-banner-link">J'ai un compte</a>
          </div>
        )}

        {/* ════════ EN-TÊTE SECTION ════════ */}
        <div className="section-head" id="produits">
          <h2 className="section-title">
            {recherche ? `Résultats pour « ${recherche} »` : categorie === 'Tout' ? 'Tous les produits' : categorie}
          </h2>
          <span className="section-count">
            {produitsFiltres.length} produit{produitsFiltres.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* ════════ GRILLE PRODUITS ════════
            Chaque carte est le composant partagé <ProductCard />.
            La page s'occupe seulement de la GRILLE (combien de colonnes). */}
        {chargement ? (
          <div className="state">Chargement des produits…</div>
        ) : produitsFiltres.length === 0 ? (
          <div className="state">
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
            <div>Aucun produit trouvé</div>
            {(recherche || categorie !== 'Tout') && (
              <button className="reset" onClick={() => { setRecherche(''); setCategorie('Tout') }}>
                Voir tous les produits
              </button>
            )}
          </div>
        ) : (
          <div className="grid">
            {produitsFiltres.map((p) => (
              <ProductCard
                key={p.id}
                produit={p}
                estFavori={favoris.includes(p.id)}
                onToggleFavori={() => toggleFavori(p.id)}
                titreFavori={user ? 'Ajouter aux favoris' : 'Connecte-toi pour sauvegarder tes favoris'}
              />
            ))}
          </div>
        )}

        <div style={{ height: '40px' }} />
      </div>

      {/* ════════ BANDE RÉASSURANCE ════════ */}
      <section className="trust">
        <div className="trust-inner">
          <div className="trust-item"><span>🚚</span><div><b>Livraison 3 îles</b><small>Grande Comore · Anjouan · Mohéli</small></div></div>
          <div className="trust-item"><span>💵</span><div><b>Payez à la livraison</b><small>Pas de paiement en ligne obligatoire</small></div></div>
          <div className="trust-item"><span>💬</span><div><b>Support WhatsApp</b><small>Une question ? On répond vite</small></div></div>
          <div className="trust-item"><span>🔒</span><div><b>Achat sécurisé</b><small>Vos données sont protégées</small></div></div>
        </div>
      </section>

      {/* ════════ FOOTER (composant partagé) ════════ */}
      <Footer />

      {/* ════════ BOTTOM NAV (mobile) ════════ */}
      <nav className="bottom-nav" aria-label="Navigation principale">
        {navigation.map((item) => (
          <a key={item.label} href={item.href} className={`nav-item ${item.active ? 'nav-on' : ''}`}
            aria-current={item.active ? 'page' : undefined}>
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}

/* ─────────── CSS ───────────
   Le style des cartes est dans components/ProductCard.js */
const css = `
  * { box-sizing: border-box; }

  .app {
    background: ${C.bgGrey};
    min-height: 100vh;
    font-family: var(--font-jakarta), system-ui, sans-serif;
    color: ${C.inkDeep};
  }

  /* ════ RAIL CATÉGORIES ════ */
  .catrail { background: ${C.white}; border-bottom: 1px solid ${C.line}; position: sticky; top: 0; z-index: 20; }
  .catrail-inner {
    max-width: 1280px; margin: 0 auto; padding: 0 20px;
    display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
  }
  .catrail-inner::-webkit-scrollbar { display: none; }
  .catchip {
    padding: 13px 16px; background: none; border: none; cursor: pointer;
    font-family: inherit; font-size: 14px; font-weight: 600; color: ${C.inkSoft};
    white-space: nowrap; border-bottom: 3px solid transparent;
  }
  .catchip-on { color: ${C.ink}; border-bottom-color: ${C.gold}; }

  /* ════ WRAP ════ */
  .wrap { max-width: 1280px; margin: 0 auto; padding: 20px; }

  /* ════ PROMOS ════ */
  .promos { display: grid; grid-template-columns: 1fr; gap: 14px; margin-bottom: 24px; }
  .promo-main {
    background: linear-gradient(120deg, ${C.ink}, ${C.inkDeep});
    border-radius: 14px; padding: 26px 28px; color: #fff;
    display: flex; align-items: center; justify-content: space-between; overflow: hidden;
  }
  .promo-kicker { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: ${C.gold}; margin-bottom: 8px; }
  .promo-title { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
  .promo-sub { font-size: 13px; opacity: 0.75; margin-bottom: 16px; }
  .promo-cta {
    background: ${C.gold}; color: ${C.inkDeep}; border: none; cursor: pointer;
    padding: 11px 22px; border-radius: 8px; font-weight: 700; font-size: 14px; font-family: inherit;
  }
  .promo-cta:hover { background: ${C.goldDeep}; }
  .promo-emoji { font-size: 62px; }
  .promo-side { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .promo-small {
    background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 18px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .promo-small span { font-size: 30px; }
  .promo-small-title { font-size: 15px; font-weight: 700; color: ${C.inkDeep}; }
  .promo-small-sub { font-size: 12px; color: ${C.inkSoft}; margin-top: 2px; }

  /* ════ Bandeau invité ════ */
  .guest-banner {
    background: #FFF6E4; border: 1px solid #F1DDAE; border-radius: 10px; padding: 12px 16px;
    font-size: 13.5px; color: #7A5C1E; font-weight: 600; margin-bottom: 20px;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .guest-banner-link { color: ${C.goldDeep}; font-weight: 700; text-decoration: none; white-space: nowrap; }

  /* ════ SECTION ════ */
  .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 16px; scroll-margin-top: 60px; }
  .section-title { font-size: 20px; font-weight: 800; color: ${C.inkDeep}; margin: 0; }
  .section-count { font-size: 13px; color: ${C.inkSoft}; white-space: nowrap; }

  /* ════ GRILLE (les cartes viennent de ProductCard) ════ */
  .grid { display: grid; gap: 14px; grid-template-columns: repeat(2, 1fr); }

  .state { text-align: center; padding: 70px 20px; color: ${C.inkSoft}; font-size: 15px; }
  .reset {
    margin-top: 16px; background: ${C.gold}; color: ${C.inkDeep}; border: none; cursor: pointer;
    padding: 12px 20px; border-radius: 10px; font-weight: 700; font-size: 14px; font-family: inherit;
  }

  /* ════ TRUST ════ */
  .trust { background: #fff; border-top: 1px solid ${C.line}; border-bottom: 1px solid ${C.line}; margin-top: 20px; }
  .trust-inner {
    max-width: 1280px; margin: 0 auto; padding: 24px 20px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
  }
  .trust-item { display: flex; align-items: center; gap: 12px; }
  .trust-item span { font-size: 26px; }
  .trust-item b { display: block; font-size: 13.5px; font-weight: 700; color: ${C.inkDeep}; }
  .trust-item small { font-size: 11.5px; color: ${C.inkSoft}; }

  /* ════ BOTTOM NAV (mobile) ════ */
  .bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; background: #fff;
    border-top: 1px solid ${C.line}; display: flex; padding: 9px 0 14px; z-index: 40;
  }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; text-decoration: none; min-height: 44px; justify-content: center; }
  .nav-icon { font-size: 19px; opacity: 0.4; }
  .nav-label { font-size: 10px; font-weight: 600; color: #A9B4B9; }
  .nav-on .nav-icon { opacity: 1; }
  .nav-on .nav-label { color: ${C.ink}; }

  .app { padding-bottom: 70px; }

  /* ═══════════ RESPONSIVE ═══════════ */
  @media (min-width: 700px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
    .promos { grid-template-columns: 2fr 1fr; }
    .trust-inner { grid-template-columns: repeat(4, 1fr); }
  }
  @media (min-width: 1000px) {
    .grid { grid-template-columns: repeat(4, 1fr); }
    .bottom-nav { display: none; }
    .app { padding-bottom: 0; }
  }
  @media (min-width: 1280px) {
    .grid { grid-template-columns: repeat(5, 1fr); }
  }
`