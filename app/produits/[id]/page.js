'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import BarreNavMobile from '@/components/BarreNavMobile'
import ProduitImage from '@/components/ProduitImage'
import Icone from '@/components/ui/Icone'
import EtatVide from '@/components/ui/EtatVide'
import { Squelette } from '@/components/ui/Squelette'
import { Heart, Check, Minus, Plus, Truck, Banknote, PackageX } from 'lucide-react'
import { ajouterAuPanier } from '@/lib/cart'
import { formatKMF } from '@/lib/produit'
import { C } from '@/lib/theme'

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
        <Header />
        <div className="wrap" role="status" aria-busy="true">
          <span className="visually-hidden">Chargement du produit…</span>
          <div className="product-layout">
            <Squelette hauteur="auto" rayon={12} style={{ aspectRatio: '1' }} />
            <div className="sk-infos">
              <Squelette largeur="30%" hauteur={14} />
              <Squelette largeur="80%" hauteur={28} />
              <Squelette largeur="40%" hauteur={32} />
              <Squelette hauteur={80} />
              <Squelette hauteur={52} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!produit) {
    return (
      <div className="app">
        <style>{css}</style>
        <Header />
        <EtatVide
          icone={PackageX}
          texte="Ce produit n'existe pas ou n'est plus disponible."
          action={{ label: 'Retour au catalogue', href: '/' }}
        />
        <BarreNavMobile />
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
              {produit.prix_gros && <span className="visual-badge">Prix de gros</span>}
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
            {produit.origine && <div className="info-origin">Origine : {produit.origine}</div>}
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
                <div className="option-label">Comment veux-tu l&apos;acheter ?</div>
                <div className="mode-row">
                  <button
                    onClick={() => changerMode('unite')}
                    aria-pressed={mode === 'unite'}
                    className={`mode-card ${mode === 'unite' ? 'mode-card-on' : ''}`}
                  >
                    <span className="mode-card-name">À l&apos;unité</span>
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
                    <button onClick={() => setQuantite((q) => Math.max(1, q - 1))} className="qty-btn" aria-label="Diminuer la quantité"><Icone icone={Minus} /></button>
                    <span className="qty-value" aria-live="polite">{quantite}</span>
                    <button onClick={() => setQuantite((q) => q + 1)} className="qty-btn" aria-label="Augmenter la quantité"><Icone icone={Plus} /></button>
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
                  <button onClick={() => setQuantite((q) => Math.max(1, q - 1))} className="qty-btn" aria-label="Diminuer la quantité"><Icone icone={Minus} /></button>
                  <span className="qty-value" aria-live="polite">{quantite}</span>
                  <button onClick={() => setQuantite((q) => q + 1)} className="qty-btn" aria-label="Augmenter la quantité"><Icone icone={Plus} /></button>
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
                  <Icone icone={Heart} taille={24} fill={favori ? C.clay : 'none'} color={favori ? C.clay : C.inkDeep} />
                </button>
                <button onClick={ajouterPanier} className={`add-btn ${ajoute ? 'add-btn-done' : ''}`}>
                  {ajoute ? <><Icone icone={Check} /> Ajouté au panier</> : 'Ajouter au panier'}
                </button>
              </div>
              {!user && (
                <p className="guest-note">
                  Tu peux commander sans compte : la connexion est demandée seulement pour valider ta commande.
                </p>
              )}
            </div>

            {/* Réassurance */}
            <div className="mini-trust">
              <div><Icone icone={Truck} /> <span><b>Livraison</b> Grande Comore, Anjouan, Mohéli</span></div>
              <div><Icone icone={Banknote} /> <span><b>Paiement à la livraison</b></span></div>
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
    color: ${C.inkDeep}; padding-bottom: 72px;
  }

  .wrap { max-width: 1200px; margin: 0 auto; padding: 16px; }

  .breadcrumb { font-size: 14px; color: ${C.inkSoft}; margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 4px; }
  .breadcrumb a { color: ${C.inkSoft}; display: inline-flex; align-items: center; min-height: 44px; }
  .breadcrumb-current { color: ${C.inkDeep}; font-weight: 600; overflow-wrap: anywhere; }

  .product-layout { display: grid; grid-template-columns: 1fr; gap: 24px; }
  .sk-infos { display: flex; flex-direction: column; gap: 12px; }

  /* ── Visuel ── */
  .visual-frame {
    width: 100%; aspect-ratio: 1; background: ${C.sand}; border: 1px solid ${C.line};
    border-radius: 12px; display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .visual-badge {
    position: absolute; top: 12px; left: 12px; background: ${C.white}; color: ${C.ink};
    font-size: 13px; font-weight: 700; padding: 4px 8px; border-radius: 6px;
  }

  /* Miniatures : défilent horizontalement sur mobile si besoin */
  .thumbs { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; padding-bottom: 4px; }
  .thumb {
    flex: 0 0 64px; width: 64px; height: 64px; padding: 0; cursor: pointer;
    border-radius: 8px; overflow: hidden; background: ${C.white};
    border: 2px solid ${C.line}; opacity: 0.75;
  }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb:hover { opacity: 1; }
  .thumb-on { border-color: ${C.ink}; opacity: 1; }

  /* ── Infos ── */
  .info-col { display: flex; flex-direction: column; min-width: 0; }
  .info-origin { font-size: 14px; color: ${C.inkSoft}; margin-bottom: 8px; }
  .info-title { font-size: 24px; font-weight: 800; color: ${C.inkDeep}; margin: 0 0 12px; line-height: 1.25; overflow-wrap: anywhere; }

  .info-price-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .info-price { font-size: 32px; font-weight: 800; color: ${C.clay}; }
  .info-currency { font-size: 16px; font-weight: 600; color: ${C.inkSoft}; }
  .info-gros-active { font-size: 14px; font-weight: 700; color: ${C.leaf}; }

  .info-desc { font-size: 16px; line-height: 1.6; color: ${C.inkDeep}; margin: 0 0 24px; }

  .option-block { margin-bottom: 24px; }
  .option-label { font-size: 15px; font-weight: 700; color: ${C.inkDeep}; margin-bottom: 8px; }
  .option-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .option-btn {
    min-height: 44px; min-width: 44px; padding: 0 16px; border-radius: 8px; font-size: 15px; font-weight: 600;
    background: ${C.white}; border: 1.5px solid ${C.line}; color: ${C.inkDeep}; cursor: pointer; font-family: inherit;
  }
  .option-btn:hover { border-color: ${C.inkSoft}; }
  .option-on { border-color: ${C.ink}; background: ${C.ink}; color: ${C.white}; }

  .qty-row { display: flex; align-items: center; width: fit-content; border: 1.5px solid ${C.line}; border-radius: 8px; overflow: hidden; background: ${C.white}; }
  .qty-btn {
    width: 48px; height: 48px; border: none; background: ${C.sand}; cursor: pointer; color: ${C.inkDeep};
    display: flex; align-items: center; justify-content: center;
  }
  .qty-btn:hover { background: ${C.line}; }
  .qty-value { width: 56px; text-align: center; font-size: 16px; font-weight: 700; color: ${C.inkDeep}; }

  .mode-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .mode-card {
    flex: 1; min-width: 150px; text-align: left; cursor: pointer; font-family: inherit;
    background: ${C.white}; border: 1.5px solid ${C.line}; border-radius: 8px; padding: 12px 16px;
    display: flex; flex-direction: column; gap: 4px; min-height: 44px;
  }
  .mode-card-name { font-size: 15px; font-weight: 700; color: ${C.inkDeep}; }
  .mode-card-desc { font-size: 14px; color: ${C.inkSoft}; margin-bottom: 4px; }
  .mode-card-price { font-size: 18px; font-weight: 800; color: ${C.inkSoft}; }
  .mode-card-price i { font-size: 13px; font-weight: 500; font-style: normal; }
  .mode-card-on { border-color: ${C.ink}; box-shadow: inset 0 0 0 1px ${C.ink}; }
  .mode-card-on .mode-card-price { color: ${C.clay}; }

  .price-note { font-size: 14px; color: ${C.inkSoft}; margin: -8px 0 16px; line-height: 1.5; }
  .qty-hint { font-size: 14px; color: ${C.leaf}; font-weight: 600; margin: 8px 0 0; }

  .cta-box { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
  .cta-total { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
  .cta-total span { font-size: 15px; color: ${C.inkSoft}; font-weight: 600; }
  .cta-total b { font-size: 22px; font-weight: 800; color: ${C.inkDeep}; }
  .cta-row { display: flex; gap: 8px; }
  .fav-btn {
    width: 52px; height: 52px; border-radius: 8px; border: 1.5px solid ${C.line};
    background: ${C.white}; cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .fav-btn:hover { border-color: ${C.inkSoft}; }
  .add-btn {
    flex: 1; min-height: 52px; border: none; border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    background: ${C.gold}; color: ${C.inkDeep}; font-size: 16px; font-weight: 800; font-family: inherit;
  }
  .add-btn:hover { background: ${C.goldDeep}; }
  .add-btn-done { background: ${C.leaf}; color: ${C.white}; }
  .add-btn-done:hover { background: ${C.leaf}; }
  .guest-note { font-size: 14px; color: ${C.inkSoft}; margin: 12px 0 0; line-height: 1.5; }

  .mini-trust { display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: ${C.inkSoft}; }
  .mini-trust > div { display: flex; align-items: center; gap: 8px; color: ${C.ink}; }
  .mini-trust span { color: ${C.inkSoft}; }
  .mini-trust b { color: ${C.inkDeep}; }

  /* ═══════════ RESPONSIVE ═══════════ */
  @media (min-width: 800px) {
    .product-layout { grid-template-columns: 1fr 1fr; gap: 48px; }
  }
  @media (min-width: 1000px) {
    .product-layout { grid-template-columns: 5fr 6fr; }
    .app { padding-bottom: 0; }
  }
`
