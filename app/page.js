'use client'

import { useState, useEffect } from 'react'
import { Truck, Banknote, Clock, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import ProductCard from '@/components/ProductCard'
import BarreNavMobile from '@/components/BarreNavMobile'
import Icone from '@/components/ui/Icone'
import EtatVide, { EtatErreur } from '@/components/ui/EtatVide'
import { Squelette } from '@/components/ui/Squelette'
import { normaliserTexte } from '@/lib/produit'
import { DELAI_LIVRAISON } from '@/lib/config'
import { C } from '@/lib/theme'

const CATEGORIES = ['Tout', 'Vêtements', 'Chaussures', 'Beauté', 'Accessoires', 'Maison', 'Tech']

export default function Catalogue() {
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [produits, setProduits] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)

  const [categorie, setCategorie] = useState('Tout')
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    const chargerUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    chargerUser()
  }, [])

  const chargerProduits = async () => {
    setChargement(true)
    setErreur(false)
    const { data, error } = await supabase
      .from('produits').select('*').eq('actif', true)
      .order('created_at', { ascending: false })
    if (!error && data) setProduits(data)
    else setErreur(true)
    setChargement(false)
  }

  useEffect(() => { chargerProduits() }, [])

  /* Recherche sans accents ni majuscules : "boubou brode" trouve "Boubou brodé" */
  const q = normaliserTexte(recherche)
  const produitsFiltres = produits.filter((p) => {
    const matchCat = categorie === 'Tout' || p.categorie === categorie
    const matchRecherche = !q || normaliserTexte(`${p.nom} ${p.description || ''}`).includes(q)
    return matchCat && matchRecherche
  })

  /* Le bouton du bandeau descend jusqu'aux produits */
  const allerAuxProduits = () =>
    document.getElementById('produits')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const reinitialiser = () => { setRecherche(''); setCategorie('Tout') }

  return (
    <div className="app">
      <style>{css}</style>

      <Header search={recherche} onSearchChange={setRecherche} />

      {/* ════════ CATÉGORIES ════════ */}
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

      <main className="wrap">

        {/* ════════ BANDEAU ════════ */}
        <section className="promo" aria-label="Arrivage">
          <p className="promo-kicker">Arrivage de Chine</p>
          <h1 className="promo-title">Prix direct usine</h1>
          <p className="promo-sub">Livraison en {DELAI_LIVRAISON}. Tu paies à la réception.</p>
          <button className="promo-cta" onClick={allerAuxProduits}>Voir les produits</button>
        </section>

        {/* Bandeau invité : on rassure (pas de compte obligatoire) au lieu de pousser à se connecter */}
        {!user && (
          <div className="guest-banner">
            <span>Pas besoin de compte pour commander : tu paies à la livraison.</span>
            <a href="/login" className="guest-banner-link">J&apos;ai un compte</a>
          </div>
        )}

        {/* ════════ EN-TÊTE SECTION ════════ */}
        <div className="section-head" id="produits">
          <h2 className="section-title">
            {recherche ? `Résultats pour « ${recherche} »` : categorie === 'Tout' ? 'Tous les produits' : categorie}
          </h2>
          {!chargement && !erreur && (
            <span className="section-count">
              {produitsFiltres.length} produit{produitsFiltres.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ════════ GRILLE PRODUITS ════════
            Chaque carte est le composant partagé <ProductCard />.
            La page s'occupe seulement de la GRILLE (combien de colonnes). */}
        {chargement ? (
          <div className="grid" role="status" aria-busy="true">
            <span className="visually-hidden">Chargement des produits…</span>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="sk-carte">
                <Squelette hauteur="auto" rayon={0} style={{ aspectRatio: '1' }} />
                <div className="sk-texte">
                  <Squelette largeur="85%" hauteur={14} />
                  <Squelette largeur="40%" hauteur={20} />
                  <Squelette hauteur={44} />
                </div>
              </div>
            ))}
          </div>
        ) : erreur ? (
          <EtatErreur texte="Les produits ne se sont pas chargés. Vérifie ta connexion." onReessayer={chargerProduits} />
        ) : produitsFiltres.length === 0 ? (
          <EtatVide
            icone={Search}
            texte={produits.length === 0 ? 'Aucun produit en ligne pour le moment.' : 'Aucun produit ne correspond à ta recherche.'}
            action={(recherche || categorie !== 'Tout') ? { label: 'Voir tous les produits', onClick: reinitialiser } : undefined}
          />
        ) : (
          <div className="grid">
            {produitsFiltres.map((p) => (
              <ProductCard key={p.id} produit={p} />
            ))}
          </div>
        )}
      </main>

      {/* ════════ INFORMATIONS PRATIQUES ════════ */}
      <section className="trust" aria-label="Livraison et paiement">
        <div className="trust-inner">
          <div className="trust-item">
            <Icone icone={Truck} taille={24} />
            <div><b>Livraison sur les 3 îles</b><small>Grande Comore, Anjouan, Mohéli</small></div>
          </div>
          <div className="trust-item">
            <Icone icone={Banknote} taille={24} />
            <div><b>Paiement à la livraison</b><small>Rien à payer en ligne</small></div>
          </div>
          <div className="trust-item">
            <Icone icone={Clock} taille={24} />
            <div><b>Délai : {DELAI_LIVRAISON}</b><small>Les produits sont achetés après ta commande</small></div>
          </div>
        </div>
      </section>

      <Footer />
      <BarreNavMobile actif="accueil" />
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
    padding-bottom: 72px;
  }

  /* ════ CATÉGORIES ════ */
  .catrail { background: ${C.white}; border-bottom: 1px solid ${C.line}; }
  .catrail-inner {
    max-width: 1280px; margin: 0 auto; padding: 0 8px;
    display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;
  }
  .catrail-inner::-webkit-scrollbar { display: none; }
  .catchip {
    min-height: 48px; padding: 0 12px; background: none; border: none; cursor: pointer;
    font-family: inherit; font-size: 15px; font-weight: 600; color: ${C.inkSoft};
    white-space: nowrap; border-bottom: 3px solid transparent;
  }
  .catchip:hover { color: ${C.inkDeep}; }
  .catchip-on { color: ${C.ink}; border-bottom-color: ${C.ink}; font-weight: 700; }

  /* ════ CONTENU ════ */
  .wrap { max-width: 1280px; margin: 0 auto; padding: 16px; }

  /* ════ BANDEAU ════ */
  .promo { background: ${C.ink}; border-radius: 12px; padding: 24px 16px; color: ${C.white}; margin-bottom: 16px; }
  .promo-kicker { font-size: 13px; font-weight: 600; margin: 0 0 4px; opacity: 0.8; }
  .promo-title { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .promo-sub { font-size: 15px; margin: 0 0 16px; opacity: 0.9; }
  .promo-cta {
    background: ${C.white}; color: ${C.inkDeep}; border: none; cursor: pointer;
    min-height: 44px; padding: 0 16px; border-radius: 8px; font-weight: 700; font-size: 15px; font-family: inherit;
  }
  .promo-cta:hover { background: ${C.sand}; }

  /* ════ Bandeau invité ════ */
  .guest-banner {
    background: ${C.white}; border: 1px solid ${C.line}; border-radius: 8px; padding: 12px 16px;
    font-size: 14px; color: ${C.inkDeep}; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .guest-banner-link {
    color: ${C.ink}; font-weight: 700; white-space: nowrap; text-decoration: underline;
    min-height: 44px; display: inline-flex; align-items: center;
  }

  /* ════ SECTION ════ */
  .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; scroll-margin-top: 72px; }
  .section-title { font-size: 20px; font-weight: 800; color: ${C.inkDeep}; margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .section-count { font-size: 14px; color: ${C.inkSoft}; white-space: nowrap; }

  /* ════ GRILLE (les cartes viennent de ProductCard) ════ */
  .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
  .sk-carte { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden; }
  .sk-texte { padding: 12px; display: flex; flex-direction: column; gap: 8px; }

  /* ════ INFORMATIONS PRATIQUES ════ */
  .trust { background: ${C.white}; border-top: 1px solid ${C.line}; margin-top: 16px; color: ${C.ink}; }
  .trust-inner {
    max-width: 1280px; margin: 0 auto; padding: 24px 16px;
    display: grid; grid-template-columns: 1fr; gap: 16px;
  }
  .trust-item { display: flex; align-items: flex-start; gap: 12px; }
  .trust-item b { display: block; font-size: 15px; font-weight: 700; color: ${C.inkDeep}; }
  .trust-item small { font-size: 14px; color: ${C.inkSoft}; }

  /* ═══════════ RESPONSIVE ═══════════ */
  @media (min-width: 700px) {
    .grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .trust-inner { grid-template-columns: repeat(3, 1fr); }
    .promo { padding: 32px; }
  }
  @media (min-width: 1000px) {
    .grid { grid-template-columns: repeat(4, 1fr); }
    .app { padding-bottom: 0; }
  }
  @media (min-width: 1280px) {
    .grid { grid-template-columns: repeat(5, 1fr); }
  }
`
