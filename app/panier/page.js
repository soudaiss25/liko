'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Trash2, Minus, Plus, Truck, Banknote } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BarreNavMobile from '@/components/BarreNavMobile'
import ProduitImage from '@/components/ProduitImage'
import Icone from '@/components/ui/Icone'
import EtatVide, { EtatErreur } from '@/components/ui/EtatVide'
import { ChargementListe } from '@/components/ui/Squelette'
import { getPanier, modifierQuantite, retirerDuPanier } from '@/lib/cart'
import { C } from '@/lib/theme'

export default function Panier() {
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [lignes, setLignes] = useState([])       // panier brut (localStorage)
  const [produits, setProduits] = useState({})   // { id: produit } — données fraîches Supabase
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    const chargerUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    chargerUser()
  }, [])

  const chargerPanier = useCallback(async () => {
    setChargement(true)
    setErreur(false)
    const panierBrut = getPanier()
    setLignes(panierBrut)

    if (panierBrut.length === 0) {
      setProduits({})
      setChargement(false)
      return
    }

    const ids = [...new Set(panierBrut.map((l) => l.id))]
    const { data, error } = await supabase.from('produits')
      // Colonnes listées une à une : jamais de prix d'achat côté visiteur
      .select('id, nom, categorie, images, prix_detail, prix_gros, qte_min_gros, mode_paiement, avance_unitaire')
      .in('id', ids)
    if (error) setErreur(true)

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

      <main className="wrap">
        <h1 className="page-title">Mon panier</h1>

        {chargement ? (
          <ChargementListe nb={3} hauteur={112} />

        ) : erreur ? (
          <EtatErreur texte="Ton panier ne s'est pas chargé. Vérifie ta connexion." onReessayer={chargerPanier} />

        ) : lignesValides.length === 0 ? (
          <EtatVide
            icone={ShoppingCart}
            texte="Ton panier est vide."
            action={{ label: 'Voir les produits', href: '/' }}
          />

        ) : (
          <div className="panier-layout">

            {/* Liste des lignes */}
            <div className="lignes-col">
              {!user && (
                <div className="guest-banner">
                  <span>Connecte-toi pour retrouver ton panier d&apos;une visite à l&apos;autre.</span>
                  <a href="/login" className="guest-banner-link">Se connecter</a>
                </div>
              )}

              {lignesValides.map((ligne) => {
                const p = produits[ligne.id]
                return (
                  <div key={`${ligne.id}-${ligne.mode}`} className="ligne">
                    <a href={`/produits/${p.id}`} className="ligne-img" aria-label={`Voir ${p.nom}`}>
                      <ProduitImage produit={p} emojiSize={36} />
                    </a>

                    <div className="ligne-info">
                      <a href={`/produits/${p.id}`} className="ligne-name">{p.nom}</a>
                      <div className="ligne-mode">
                        {ligne.mode === 'lot'
                          ? `Lot de ${p.qte_min_gros || 6} pièces`
                          : 'À l’unité'}
                      </div>
                      <div className="ligne-price-unit">
                        {ligne.mode === 'lot'
                          ? `${Number(p.prix_gros).toLocaleString('fr-FR')} KMF le lot`
                          : `${Number(p.prix_detail).toLocaleString('fr-FR')} KMF la pièce`}
                      </div>
                    </div>

                    <div className="ligne-bas">
                      <div className="ligne-qty">
                        <button
                          onClick={() => changerQuantite(ligne.id, ligne.mode, ligne.quantite - 1)}
                          className="qty-btn"
                          aria-label={`Diminuer la quantité de ${p.nom}`}
                        ><Icone icone={Minus} taille={18} /></button>
                        <span className="qty-value" aria-live="polite">{ligne.quantite}</span>
                        <button
                          onClick={() => changerQuantite(ligne.id, ligne.mode, ligne.quantite + 1)}
                          className="qty-btn"
                          aria-label={`Augmenter la quantité de ${p.nom}`}
                        ><Icone icone={Plus} taille={18} /></button>
                      </div>

                      <div className="ligne-total">
                        {prixLigne(ligne).toLocaleString('fr-FR')} <span>KMF</span>
                      </div>

                      <button onClick={() => retirer(ligne.id, ligne.mode)} className="ligne-remove"
                        aria-label={`Retirer ${p.nom} du panier`}>
                        <Icone icone={Trash2} />
                      </button>
                    </div>
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
                  <span className="summary-livraison">Calculée à l&apos;étape suivante</span>
                </div>

                <div className="summary-divider" />

                <div className="summary-total">
                  <span>Total</span>
                  <b>{total.toLocaleString('fr-FR')} KMF</b>
                </div>

                <a href="/commande" className="checkout-btn">
                  Passer la commande
                </a>

                {!user && (
                  <p className="checkout-note">
                    Tu peux commander sans compte : tu paies à la livraison.
                  </p>
                )}

                <div className="summary-trust">
                  <div><Icone icone={Truck} /> Livraison sur les 3 îles</div>
                  <div><Icone icone={Banknote} /> Paiement à la livraison</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

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
    color: ${C.inkDeep}; padding-bottom: 72px;
  }

  .wrap { max-width: 1200px; margin: 0 auto; padding: 16px 16px 32px; }
  .page-title { font-size: 24px; font-weight: 800; color: ${C.inkDeep}; margin: 0 0 16px; }

  /* ── Layout ── */
  .panier-layout { display: grid; grid-template-columns: 1fr; gap: 24px; align-items: start; }

  .guest-banner {
    background: ${C.white}; border: 1px solid ${C.line}; border-radius: 8px; padding: 12px 16px;
    font-size: 14px; color: ${C.inkDeep}; margin-bottom: 12px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .guest-banner-link {
    color: ${C.ink}; font-weight: 700; text-decoration: underline; white-space: nowrap;
    min-height: 44px; display: inline-flex; align-items: center;
  }

  /* ── Ligne panier ── */
  .lignes-col { display: flex; flex-direction: column; gap: 12px; }
  .ligne {
    background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 12px;
    display: grid; grid-template-columns: 72px 1fr; gap: 12px; align-items: start;
  }
  .ligne-img {
    width: 72px; height: 72px; border-radius: 8px; background: ${C.sand};
    overflow: hidden; display: block; flex-shrink: 0;
  }
  .ligne-info { min-width: 0; }
  .ligne-name {
    display: block; font-size: 15px; font-weight: 700; color: ${C.inkDeep};
    text-decoration: none; margin: -10px 0 0; min-height: 44px; display: flex; align-items: center; overflow-wrap: anywhere;
  }
  .ligne-name:hover { text-decoration: underline; }
  .ligne-mode { font-size: 14px; color: ${C.inkSoft}; margin-bottom: 4px; }
  .ligne-price-unit { font-size: 14px; color: ${C.inkSoft}; }

  .ligne-bas {
    grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  .ligne-qty {
    display: flex; align-items: center; width: fit-content;
    border: 1.5px solid ${C.line}; border-radius: 8px; overflow: hidden;
  }
  .qty-btn {
    width: 44px; height: 44px; border: none; background: ${C.sand}; cursor: pointer; color: ${C.inkDeep};
    display: flex; align-items: center; justify-content: center;
  }
  .qty-btn:hover { background: ${C.line}; }
  .qty-value { width: 44px; text-align: center; font-size: 16px; font-weight: 700; color: ${C.inkDeep}; }

  .ligne-total { margin-left: auto; font-size: 18px; font-weight: 800; color: ${C.clay}; text-align: right; }
  .ligne-total span { font-size: 13px; font-weight: 600; color: ${C.inkSoft}; }

  .ligne-remove {
    width: 44px; height: 44px; border: none; background: none; cursor: pointer;
    color: ${C.inkSoft}; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  }
  .ligne-remove:hover { background: #FBF0EE; color: ${C.clay}; }

  /* ── Résumé ── */
  .summary-col { width: 100%; }
  .summary-box { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; }
  .summary-title { font-size: 18px; font-weight: 800; color: ${C.inkDeep}; margin: 0 0 16px; }
  .summary-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    font-size: 15px; color: ${C.inkSoft}; margin-bottom: 8px;
  }
  .summary-livraison { font-size: 14px; text-align: right; }
  .summary-divider { height: 1px; background: ${C.line}; margin: 12px 0; }
  .summary-total {
    display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px;
  }
  .summary-total span { font-size: 16px; font-weight: 700; color: ${C.inkDeep}; }
  .summary-total b { font-size: 22px; font-weight: 800; color: ${C.inkDeep}; }

  .checkout-btn {
    display: flex; align-items: center; justify-content: center; width: 100%; min-height: 52px;
    background: ${C.gold}; color: ${C.inkDeep}; text-decoration: none;
    border-radius: 8px; font-weight: 800; font-size: 16px;
  }
  .checkout-btn:hover { background: ${C.goldDeep}; }

  .checkout-note { font-size: 14px; color: ${C.inkSoft}; line-height: 1.5; margin: 12px 0 0; }

  .summary-trust {
    margin-top: 16px; padding-top: 16px; border-top: 1px solid ${C.line};
    display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: ${C.inkSoft};
  }
  .summary-trust > div { display: flex; align-items: center; gap: 8px; }

  /* ═══════════ RESPONSIVE ═══════════ */
  @media (min-width: 900px) {
    .panier-layout { grid-template-columns: 2fr 1fr; }
    .ligne { grid-template-columns: 88px 1fr auto; }
    .ligne-img { width: 88px; height: 88px; }
    .ligne-bas { grid-column: auto; flex-wrap: nowrap; }
    .ligne-total { min-width: 100px; }
    .summary-col { position: sticky; top: 90px; }
  }
  @media (min-width: 1000px) {
    .app { padding-bottom: 0; }
  }
`
