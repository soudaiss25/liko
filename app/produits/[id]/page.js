'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BarreNavMobile from '@/components/BarreNavMobile'
import ProduitImage from '@/components/ProduitImage'
import { ajouterAuPanier } from '@/lib/cart'
import { flagPour, formatKMF } from '@/lib/produit'

import { C } from '@/lib/theme'
/* ─────────── Palette (identique au catalogue) ─────────── */
export default function FicheProduit() {
  const { id } = useParams()
  const supabase = createClient()

  const [user, setUser] = useState(null)
  const [produit, setProduit] = useState(null)
  const [variantes, setVariantes] = useState([])
  const [chargement, setChargement] = useState(true)

  const [photoActive, setPhotoActive] = useState(0) // index de la photo affichée en grand
  const [tailleChoisie, setTailleChoisie] = useState(null)
  const [couleurChoisie, setCouleurChoisie] = useState(null)
  const [mode, setMode] = useState('unite') // 'unite' ou 'lot'
  const [quantite, setQuantite] = useState(1) // nb d'unités si mode 'unite', nb de lots si mode 'lot'
  const [favori, setFavori] = useState(false)
  const [ajoute, setAjoute] = useState(false)

  useEffect(() => {
    const chargerUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    chargerUser()
  }, [])

  useEffect(() => {
    const charger = async () => {
      setChargement(true)
      const { data: p } = await supabase.from('produits').select('*').eq('id', id).single()
      setProduit(p)
      setPhotoActive(0)

      const { data: v } = await supabase.from('variantes').select('*').eq('produit_id', id)
      setVariantes(v || [])

      setChargement(false)
    }
    if (id) charger()
  }, [id])

  const images = produit?.images || []

  const tailles = [...new Set(variantes.map((v) => v.taille).filter(Boolean))]
  const couleurs = [...new Set(variantes.map((v) => v.couleur).filter(Boolean))]

  // En base, prix_gros = prix TOTAL du lot
  const enGros = mode === 'lot' && produit?.prix_gros
  const tailleLot = produit?.qte_min_gros || 6
  const prixLot = produit?.prix_gros || 0
  const prixParPieceEnLot = tailleLot ? Math.round(prixLot / tailleLot) : 0

  // Total = (nb unités × prix unité) OU (nb lots × prix du lot)
  const prixTotal = enGros
    ? prixLot * quantite
    : (produit?.prix_detail || 0) * quantite

  const nbPiecesTotal = enGros ? quantite * tailleLot : quantite

  const changerMode = (nouveauMode) => {
    setMode(nouveauMode)
    setQuantite(1)
  }

  const ajouterPanier = () => {
    ajouterAuPanier(produit.id, mode, quantite)
    setAjoute(true)
    setTimeout(() => setAjoute(false), 1800)
  }

  if (chargement) {
    return (
      <div className="app">
        <style>{css}</style>
        <div className="state">Chargement du produit…</div>
      </div>
    )
  }

  if (!produit) {
    return (
      <div className="app">
        <style>{css}</style>
        <div className="state">
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>😕</div>
          <div>Ce produit n'existe pas ou n'est plus disponible.</div>
          <a href="/" className="back-link">← Retour au catalogue</a>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <style>{css}</style>

      <Header />

      {/* ── Fil d'ariane ── */}
      <div className="wrap">
        <nav className="breadcrumb" aria-label="Fil d'Ariane">
          <a href="/">Accueil</a> <span>/</span> <span>{produit.categorie}</span> <span>/</span>
          <span className="breadcrumb-current">{produit.nom}</span>
        </nav>

        {/* ── Contenu principal ── */}
        <div className="product-layout">

          {/* ── Visuel : grande photo + miniatures ── */}
          <div className="visual-col">
            <div className="visual-frame">
              <ProduitImage
                produit={produit}
                src={images[photoActive]}
                alt={images.length > 1 ? `${produit.nom} — photo ${photoActive + 1} sur ${images.length}` : produit.nom}
                emojiSize={120}
                eager
              />
              {produit.prix_gros && <span className="visual-badge">GROS DISPO</span>}
            </div>

            {/* Les miniatures n'apparaissent que s'il y a plusieurs photos */}
            {images.length > 1 && (
              <div className="thumbs">
                {images.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => setPhotoActive(i)}
                    className={`thumb ${i === photoActive ? 'thumb-on' : ''}`}
                    aria-label={`Voir la photo ${i + 1}`}
                    aria-pressed={i === photoActive}
                  >
                    <img src={url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Infos ── */}
          <div className="info-col">
            <div className="info-origin">{flagPour(produit.origine)}</div>
            <h1 className="info-title">{produit.nom}</h1>

            <div className="info-price-row">
              {enGros ? (
                <>
                  <span className="info-price">
                    {formatKMF(prixLot)}
                    <span className="info-currency"> KMF</span>
                  </span>
                  <span className="info-gros-active">le lot de {tailleLot}</span>
                </>
              ) : (
                <span className="info-price">
                  {formatKMF(produit.prix_detail)}
                  <span className="info-currency"> KMF</span>
                </span>
              )}
            </div>
            {produit.prix_gros && (
              <p className="price-note">
                Aussi disponible en lot de {tailleLot} pièces, soit {formatKMF(prixParPieceEnLot)} KMF la pièce.
              </p>
            )}

            {produit.description && (
              <p className="info-desc">{produit.description}</p>
            )}

            {/* Tailles */}
            {tailles.length > 0 && (
              <div className="option-block">
                <div className="option-label">Taille</div>
                <div className="option-row">
                  {tailles.map((t) => (
                    <button key={t} onClick={() => setTailleChoisie(t)}
                      aria-pressed={tailleChoisie === t}
                      className={`option-btn ${tailleChoisie === t ? 'option-on' : ''}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Couleurs */}
            {couleurs.length > 0 && (
              <div className="option-block">
                <div className="option-label">Couleur</div>
                <div className="option-row">
                  {couleurs.map((c) => (
                    <button key={c} onClick={() => setCouleurChoisie(c)}
                      aria-pressed={couleurChoisie === c}
                      className={`option-btn ${couleurChoisie === c ? 'option-on' : ''}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {produit.prix_gros ? (
              <div className="option-block">
                <div className="option-label">Comment veux-tu l'acheter ?</div>
                <div className="mode-row">
                  <button
                    onClick={() => changerMode('unite')}
                    aria-pressed={mode === 'unite'}
                    className={`mode-card ${mode === 'unite' ? 'mode-card-on' : ''}`}
                  >
                    <span className="mode-card-name">À l'unité</span>
                    <span className="mode-card-desc">1 pièce</span>
                    <span className="mode-card-price">{formatKMF(produit.prix_detail)} KMF</span>
                  </button>
                  <button
                    onClick={() => changerMode('lot')}
                    aria-pressed={mode === 'lot'}
                    className={`mode-card ${mode === 'lot' ? 'mode-card-on' : ''}`}
                  >
                    <span className="mode-card-name">Par lot</span>
                    <span className="mode-card-desc">Lot de {tailleLot} pièces · {formatKMF(prixParPieceEnLot)} KMF/pièce</span>
                    <span className="mode-card-price">{formatKMF(prixLot)} KMF <i>le lot</i></span>
                  </button>
                </div>

                <div className="option-block" style={{ marginTop: '16px' }}>
                  <div className="option-label">
                    {mode === 'lot' ? `Combien de lots de ${tailleLot} ?` : 'Combien de pièces ?'}
                  </div>
                  <div className="qty-row">
                    <button onClick={() => setQuantite((q) => Math.max(1, q - 1))} className="qty-btn" aria-label="Diminuer la quantité">−</button>
                    <span className="qty-value" aria-live="polite">{quantite}</span>
                    <button onClick={() => setQuantite((q) => q + 1)} className="qty-btn" aria-label="Augmenter la quantité">+</button>
                  </div>
                  {mode === 'lot' && (
                    <p className="qty-hint">
                      = {nbPiecesTotal} pièce{nbPiecesTotal > 1 ? 's' : ''} au total
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="option-block">
                <div className="option-label">Quantité</div>
                <div className="qty-row">
                  <button onClick={() => setQuantite((q) => Math.max(1, q - 1))} className="qty-btn" aria-label="Diminuer la quantité">−</button>
                  <span className="qty-value" aria-live="polite">{quantite}</span>
                  <button onClick={() => setQuantite((q) => q + 1)} className="qty-btn" aria-label="Augmenter la quantité">+</button>
                </div>
              </div>
            )}

            {/* Total + CTA */}
            <div className="cta-box">
              <div className="cta-total">
                <span>Total</span>
                <b>{formatKMF(prixTotal)} KMF</b>
              </div>
              <div className="cta-row">
                <button onClick={() => setFavori(!favori)} className="fav-btn"
                  aria-pressed={favori} aria-label={favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                  {favori ? '❤️' : '🤍'}
                </button>
                <button onClick={ajouterPanier} className={`add-btn ${ajoute ? 'add-btn-done' : ''}`}>
                  {ajoute ? '✓ Ajouté au panier' : '🛒 Ajouter au panier'}
                </button>
              </div>
              {!user && (
                <p className="guest-note">
                  💡 Tu peux commander sans compte — la connexion est demandée seulement pour valider ta commande.
                </p>
              )}
            </div>

            {/* Réassurance */}
            <div className="mini-trust">
              <div>🚚 <b>Livraison</b> Grande Comore · Anjouan · Mohéli</div>
              <div>💵 <b>Paiement à la livraison</b> disponible</div>
              <div>💬 <b>Une question ?</b> Contacte-nous sur WhatsApp</div>
            </div>
          </div>
        </div>

        <div style={{ height: '60px' }} />
      </div>

      <Footer />

      {/* ── BOTTOM NAV (mobile) ── */}
      <BarreNavMobile />
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

  .breadcrumb { font-size: 12.5px; color: ${C.inkSoft}; margin-bottom: 20px; }
  .breadcrumb a { color: ${C.inkSoft}; text-decoration: none; }
  .breadcrumb span { margin: 0 4px; }
  .breadcrumb-current { color: ${C.inkDeep}; font-weight: 600; }

  .product-layout { display: grid; grid-template-columns: 1fr; gap: 30px; }

  /* ── Visuel ── */
  .visual-frame {
    width: 100%; aspect-ratio: 1; background: #fff; border: 1px solid ${C.line};
    border-radius: 16px; display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .visual-badge {
    position: absolute; top: 16px; left: 16px; background: ${C.leaf}; color: #fff;
    font-size: 11px; font-weight: 800; letter-spacing: 0.5px; padding: 6px 12px; border-radius: 8px;
  }

  /* Miniatures : défilent horizontalement sur mobile si besoin */
  .thumbs { display: flex; gap: 10px; margin-top: 12px; overflow-x: auto; padding-bottom: 4px; }
  .thumb {
    flex: 0 0 68px; width: 68px; height: 68px; padding: 0; cursor: pointer;
    border-radius: 10px; overflow: hidden; background: #fff;
    border: 2px solid ${C.line}; opacity: 0.7; transition: opacity .15s, border-color .15s;
  }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb:hover { opacity: 1; }
  .thumb-on { border-color: ${C.ink}; opacity: 1; }
  .thumb:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }

  /* ── Infos ── */
  .info-col { display: flex; flex-direction: column; }
  .info-origin { font-size: 13px; color: ${C.inkSoft}; margin-bottom: 8px; }
  .info-title { font-size: 24px; font-weight: 800; color: ${C.inkDeep}; margin: 0 0 14px; line-height: 1.25; }

  .info-price-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .info-price { font-size: 32px; font-weight: 800; color: ${C.clay}; }
  .info-currency { font-size: 15px; font-weight: 600; color: ${C.inkSoft}; }
  .info-gros-active {
    font-size: 12px; font-weight: 700; color: ${C.leaf}; background: #E8F5EE;
    padding: 5px 10px; border-radius: 7px;
  }

  .info-desc { font-size: 14.5px; line-height: 1.65; color: ${C.inkSoft}; margin: 0 0 22px; }

  .option-block { margin-bottom: 20px; }
  .option-label { font-size: 13px; font-weight: 700; color: ${C.inkDeep}; margin-bottom: 10px; }
  .option-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .option-btn {
    padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;
    background: #fff; border: 1.5px solid ${C.line}; color: ${C.inkDeep}; cursor: pointer; font-family: inherit;
  }
  .option-on { border-color: ${C.ink}; background: ${C.ink}; color: #fff; }

  .qty-row { display: flex; align-items: center; gap: 0; width: fit-content; border: 1.5px solid ${C.line}; border-radius: 10px; overflow: hidden; }
  .qty-btn {
    width: 44px; height: 44px; border: none; background: ${C.sand}; cursor: pointer;
    font-size: 18px; font-weight: 700; color: ${C.inkDeep};
  }
  .qty-value { width: 52px; text-align: center; font-size: 16px; font-weight: 700; color: ${C.inkDeep}; }

  .mode-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .mode-card {
    flex: 1; min-width: 160px; text-align: left; cursor: pointer; font-family: inherit;
    background: #fff; border: 2px solid ${C.line}; border-radius: 12px; padding: 16px;
    display: flex; flex-direction: column; gap: 3px;
  }
  .mode-card-name { font-size: 14px; font-weight: 700; color: ${C.inkDeep}; }
  .mode-card-desc { font-size: 12.5px; color: ${C.inkSoft}; margin-bottom: 6px; }
  .mode-card-price { font-size: 18px; font-weight: 800; color: ${C.inkSoft}; }
  .mode-card-price i { font-size: 11px; font-weight: 500; font-style: normal; }
  .mode-card-on { border-color: ${C.gold}; background: #FFFBF2; }
  .mode-card-on .mode-card-price { color: ${C.clay}; }

  .price-note { font-size: 12.5px; color: ${C.inkSoft}; margin: -8px 0 18px; line-height: 1.5; }
  .qty-hint { font-size: 12.5px; color: ${C.leaf}; font-weight: 600; margin: 10px 0 0; }

  .cta-box { background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 18px; margin-bottom: 20px; }
  .cta-total { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
  .cta-total span { font-size: 13px; color: ${C.inkSoft}; font-weight: 600; }
  .cta-total b { font-size: 22px; font-weight: 800; color: ${C.inkDeep}; }
  .cta-row { display: flex; gap: 10px; }
  .fav-btn {
    width: 52px; height: 52px; border-radius: 10px; border: 1.5px solid ${C.line};
    background: #fff; cursor: pointer; font-size: 20px; flex-shrink: 0;
  }
  .add-btn {
    flex: 1; height: 52px; border: none; border-radius: 10px; cursor: pointer;
    background: ${C.gold}; color: ${C.inkDeep}; font-size: 15px; font-weight: 800; font-family: inherit;
    transition: background .15s;
  }
  .add-btn:hover { background: ${C.goldDeep}; }
  .add-btn-done { background: ${C.leaf}; color: #fff; }
  .guest-note { font-size: 12px; color: ${C.inkSoft}; margin: 12px 0 0; line-height: 1.5; }

  .mini-trust { display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; color: ${C.inkSoft}; }
  .mini-trust b { color: ${C.inkDeep}; }

  .state { text-align: center; padding: 100px 20px; color: ${C.inkSoft}; font-size: 15px; }
  .back-link { display: inline-block; margin-top: 14px; color: ${C.ink}; font-weight: 700; text-decoration: none; }

  .bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; background: #fff;
    border-top: 1px solid ${C.line}; display: flex; padding: 9px 0 14px; z-index: 40;
  }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; text-decoration: none; }
  .nav-icon { font-size: 19px; opacity: 0.4; }
  .nav-label { font-size: 10px; font-weight: 600; color: #A9B4B9; }

  /* ═══════════ RESPONSIVE ═══════════ */
  @media (min-width: 800px) {
    .product-layout { grid-template-columns: 1fr 1fr; gap: 48px; }
    .bottom-nav { display: none; }
    .app { padding-bottom: 0; }
  }
  @media (min-width: 1000px) {
    .product-layout { grid-template-columns: 5fr 6fr; }
  }
`