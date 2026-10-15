'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BarreNavMobile from '@/components/BarreNavMobile'
import { getPanier, modifierQuantite, retirerDuPanier } from '@/lib/cart'

import { C } from '@/lib/theme'
/* ─────────── Palette (identique aux autres pages) ─────────── */
const EMOJI_CAT = {
  'Vêtements': '👕', 'Chaussures': '👟', 'Beauté': '💄',
  'Accessoires': '👜', 'Maison': '🏠', 'Tech': '📱',
}
const emojiPour = (cat) => EMOJI_CAT[cat] || '📦'

export default function Panier() {
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [lignes, setLignes] = useState([])       // panier brut (localStorage)
  const [produits, setProduits] = useState({})   // { id: produit } — données fraîches Supabase
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    const chargerUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    chargerUser()
  }, [])

  const chargerPanier = useCallback(async () => {
    setChargement(true)
    const panierBrut = getPanier()
    setLignes(panierBrut)

    if (panierBrut.length === 0) {
      setProduits({})
      setChargement(false)
      return
    }

    const ids = [...new Set(panierBrut.map((l) => l.id))]
    const { data } = await supabase.from('produits').select('*').in('id', ids)

    const map = {}
    ;(data || []).forEach((p) => { map[p.id] = p })
    setProduits(map)
    setChargement(false)
  }, [])

  useEffect(() => {
    chargerPanier()
    // Si le panier change ailleurs sur la même page (rare ici), on se resynchronise
    window.addEventListener('panier-modifie', chargerPanier)
    return () => window.removeEventListener('panier-modifie', chargerPanier)
  }, [chargerPanier])

  const changerQuantite = (id, mode, nouvelleQuantite) => {
    modifierQuantite(id, mode, nouvelleQuantite)
    chargerPanier()
  }

  const retirer = (id, mode) => {
    retirerDuPanier(id, mode)
    chargerPanier()
  }

  // Calcule le prix d'une ligne selon son mode
  const prixLigne = (ligne) => {
    const p = produits[ligne.id]
    if (!p) return 0
    if (ligne.mode === 'lot') return (p.prix_gros || 0) * ligne.quantite
    return (p.prix_detail || 0) * ligne.quantite
  }

  const nbPiecesLigne = (ligne) => {
    const p = produits[ligne.id]
    if (!p) return ligne.quantite
    if (ligne.mode === 'lot') return ligne.quantite * (p.qte_min_gros || 6)
    return ligne.quantite
  }

  const lignesValides = lignes.filter((l) => produits[l.id])
  const total = lignesValides.reduce((sum, l) => sum + prixLigne(l), 0)
  const nbArticles = lignesValides.reduce((sum, l) => sum + nbPiecesLigne(l), 0)

  return (
    <div className="app">
      <style>{css}</style>

      <Header />

      <div className="wrap">
        <h1 className="page-title">Mon panier</h1>

        {chargement ? (
          <div className="state">Chargement du panier…</div>

        ) : lignesValides.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">🛒</div>
            <div className="empty-title">Ton panier est vide</div>
            <p className="empty-sub">Parcours le catalogue pour trouver ton bonheur.</p>
            <a href="/" className="empty-cta">Voir les produits →</a>
          </div>

        ) : (
          <div className="panier-layout">

            {/* Liste des lignes */}
            <div className="lignes-col">
              {!user && (
                <div className="guest-banner">
                  <span>💡 Connecte-toi pour sauvegarder ton panier d'une visite à l'autre</span>
                  <a href="/login" className="guest-banner-link">Se connecter</a>
                </div>
              )}

              {lignesValides.map((ligne) => {
                const p = produits[ligne.id]
                return (
                  <div key={`${ligne.id}-${ligne.mode}`} className="ligne">
                    <a href={`/produits/${p.id}`} className="ligne-img">
                      <span>{emojiPour(p.categorie)}</span>
                    </a>

                    <div className="ligne-info">
                      <a href={`/produits/${p.id}`} className="ligne-name">{p.nom}</a>
                      <div className="ligne-mode">
                        {ligne.mode === 'lot'
                          ? `Lot de ${p.qte_min_gros || 6} pièces`
                          : 'À l\u2019unité'}
                      </div>
                      <div className="ligne-price-unit">
                        {ligne.mode === 'lot'
                          ? `${Number(p.prix_gros).toLocaleString('fr-FR')} KMF / lot`
                          : `${Number(p.prix_detail).toLocaleString('fr-FR')} KMF / pièce`}
                      </div>
                    </div>

                    <div className="ligne-qty">
                      <button
                        onClick={() => changerQuantite(ligne.id, ligne.mode, ligne.quantite - 1)}
                        className="qty-btn"
                      >−</button>
                      <span className="qty-value">{ligne.quantite}</span>
                      <button
                        onClick={() => changerQuantite(ligne.id, ligne.mode, ligne.quantite + 1)}
                        className="qty-btn"
                      >+</button>
                    </div>

                    <div className="ligne-total">
                      {prixLigne(ligne).toLocaleString('fr-FR')} <span>KMF</span>
                    </div>

                    <button onClick={() => retirer(ligne.id, ligne.mode)} className="ligne-remove" title="Retirer">
                      🗑
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Résumé / total */}
            <div className="summary-col">
              <div className="summary-box">
                <h2 className="summary-title">Résumé</h2>

                <div className="summary-row">
                  <span>Articles ({nbArticles})</span>
                  <span>{total.toLocaleString('fr-FR')} KMF</span>
                </div>
                <div className="summary-row">
                  <span>Livraison</span>
                  <span className="summary-livraison">Calculée à l'étape suivante</span>
                </div>

                <div className="summary-divider" />

                <div className="summary-total">
                  <span>Total</span>
                  <b>{total.toLocaleString('fr-FR')} KMF</b>
                </div>

                <a href="/commande" className="checkout-btn">
                  Passer la commande →
                </a>

                {!user && (
                  <p className="checkout-note">
                    💡 Pas besoin de compte pour l'instant — la connexion est demandée
                    seulement pour valider ta commande.
                  </p>
                )}

                <div className="summary-trust">
                  <div>🚚 Livraison sur les 3 îles</div>
                  <div>💵 Paiement à la livraison disponible</div>
                  <div>💬 Une question ? Contacte-nous sur WhatsApp</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: '40px' }} />
      </div>

      <Footer />

      {/* ── BOTTOM NAV (mobile) ── */}
      <BarreNavMobile actif="panier" />
    </div>
  )
}

/* ─────────── CSS ─────────── */
const css = `
  * { box-sizing: border-box; }

  .app {
    background: ${C.bgGrey}; min-height: 100vh;
    font-family: var(--font-jakarta), system-ui, sans-serif;
    color: ${C.inkDeep}; padding-bottom: 70px;
  }

  .wrap { max-width: 1200px; margin: 0 auto; padding: 20px; }
  .page-title { font-size: 24px; font-weight: 800; color: ${C.inkDeep}; margin: 0 0 20px; }

  .state { text-align: center; padding: 80px 20px; color: ${C.inkSoft}; font-size: 15px; }

  /* ── Vide ── */
  .empty { text-align: center; padding: 70px 20px; }
  .empty-emoji { font-size: 60px; margin-bottom: 14px; }
  .empty-title { font-size: 19px; font-weight: 800; color: ${C.inkDeep}; margin-bottom: 8px; }
  .empty-sub { font-size: 14px; color: ${C.inkSoft}; margin-bottom: 22px; }
  .empty-cta {
    display: inline-block; background: ${C.ink}; color: #fff; text-decoration: none;
    padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 14px;
  }

  /* ── Layout ── */
  .panier-layout { display: grid; grid-template-columns: 1fr; gap: 24px; align-items: start; }

  .guest-banner {
    background: #FFF6E4; border: 1px solid #F1DDAE; border-radius: 10px; padding: 12px 16px;
    font-size: 13.5px; color: #7A5C1E; font-weight: 600; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  }
  .guest-banner-link { color: ${C.goldDeep}; font-weight: 700; text-decoration: none; white-space: nowrap; }

  /* ── Ligne panier ── */
  .lignes-col { display: flex; flex-direction: column; gap: 12px; }
  .ligne {
    background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 14px;
    display: grid; grid-template-columns: 64px 1fr auto; gap: 14px; align-items: center;
    position: relative;
  }
  .ligne-img {
    width: 64px; height: 64px; border-radius: 10px; background: ${C.sand};
    display: flex; align-items: center; justify-content: center; font-size: 30px;
    text-decoration: none; flex-shrink: 0;
  }
  .ligne-info { min-width: 0; }
  .ligne-name {
    display: block; font-size: 14.5px; font-weight: 700; color: ${C.inkDeep};
    text-decoration: none; margin-bottom: 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ligne-mode { font-size: 12px; color: ${C.goldDeep}; font-weight: 600; margin-bottom: 2px; }
  .ligne-price-unit { font-size: 12px; color: ${C.inkSoft}; }

  .ligne-qty {
    grid-column: 1 / -1; display: flex; align-items: center; gap: 0; width: fit-content;
    border: 1.5px solid ${C.line}; border-radius: 8px; overflow: hidden; margin-top: 6px;
  }
  .qty-btn {
    width: 34px; height: 34px; border: none; background: ${C.sand}; cursor: pointer;
    font-size: 16px; font-weight: 700; color: ${C.inkDeep};
  }
  .qty-value { width: 40px; text-align: center; font-size: 14px; font-weight: 700; color: ${C.inkDeep}; }

  .ligne-total {
    grid-column: 1 / -1; font-size: 16px; font-weight: 800; color: ${C.clay};
    text-align: right; margin-top: -34px;
  }
  .ligne-total span { font-size: 11px; font-weight: 600; color: ${C.inkSoft}; }

  .ligne-remove {
    position: absolute; top: 10px; right: 10px; width: 30px; height: 30px;
    border: none; background: none; cursor: pointer; font-size: 15px; color: ${C.inkSoft};
    border-radius: 8px;
  }
  .ligne-remove:hover { background: #FDECEB; color: ${C.clay}; }

  /* ── Résumé ── */
  .summary-col { width: 100%; }
  .summary-box { background: #fff; border: 1px solid ${C.line}; border-radius: 16px; padding: 22px; }
  .summary-title { font-size: 16px; font-weight: 800; color: ${C.inkDeep}; margin: 0 0 16px; }
  .summary-row {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 13.5px; color: ${C.inkSoft}; margin-bottom: 10px;
  }
  .summary-livraison { font-size: 12px; font-style: italic; }
  .summary-divider { height: 1px; background: ${C.line}; margin: 12px 0; }
  .summary-total {
    display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 18px;
  }
  .summary-total span { font-size: 14px; font-weight: 700; color: ${C.inkDeep}; }
  .summary-total b { font-size: 22px; font-weight: 800; color: ${C.inkDeep}; }

  .checkout-btn {
    display: block; text-align: center; width: 100%; height: 50px; line-height: 50px;
    background: ${C.gold}; color: ${C.inkDeep}; text-decoration: none;
    border-radius: 10px; font-weight: 800; font-size: 14.5px;
    transition: background .15s;
  }
  .checkout-btn:hover { background: ${C.goldDeep}; }

  .checkout-note { font-size: 11.5px; color: ${C.inkSoft}; line-height: 1.5; margin: 12px 0 0; }

  .summary-trust {
    margin-top: 18px; padding-top: 16px; border-top: 1px solid ${C.line};
    display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: ${C.inkSoft};
  }

  /* ── Bottom nav (mobile) ── */
  .bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; background: #fff;
    border-top: 1px solid ${C.line}; display: flex; padding: 9px 0 14px; z-index: 40;
  }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; text-decoration: none; }
  .nav-icon { font-size: 19px; opacity: 0.4; }
  .nav-label { font-size: 10px; font-weight: 600; color: #A9B4B9; }
  .nav-on .nav-icon { opacity: 1; }
  .nav-on .nav-label { color: ${C.ink}; }

  /* ═══════════ RESPONSIVE ═══════════ */
  @media (min-width: 900px) {
    .panier-layout { grid-template-columns: 2fr 1fr; }
    .ligne { grid-template-columns: 72px 1fr auto auto auto; }
    .ligne-img { width: 72px; height: 72px; font-size: 34px; }
    .ligne-qty { grid-column: auto; margin-top: 0; }
    .ligne-total { grid-column: auto; margin-top: 0; text-align: right; min-width: 90px; }
    .summary-col { position: sticky; top: 90px; }
    .bottom-nav { display: none; }
    .app { padding-bottom: 0; }
  }
`