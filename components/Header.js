'use client'

/* ─────────── components/Header.js ───────────
   Header partagé (bandeau réassurance + logo + recherche + compte + panier).
   À utiliser sur toutes les pages publiques.

   Deux modes de recherche :
   - Mode "piloté" (catalogue) : passe `search` + `onSearchChange`,
     le champ reflète et modifie l'état de la page qui l'utilise
     (filtrage en direct, sans recharger la page).
   - Mode "simple" (toutes les autres pages) : ne passe rien,
     le Header gère son propre champ et redirige vers le catalogue
     avec la recherche au clic sur "Rechercher".
*/

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Search, User, ShoppingCart } from 'lucide-react'
import Icone from '@/components/ui/Icone'
import { getPanierCount } from '@/lib/cart'
import { WHATSAPP_SERVICE } from '@/lib/config'
import { C } from '@/lib/theme'

export default function Header({ search, onSearchChange }) {
  const supabase = createClient()
  const router = useRouter()

  const [prenom, setPrenom] = useState(null)
  const [estConnecte, setEstConnecte] = useState(false)
  const [nbPanier, setNbPanier] = useState(0)
  const [rechercheLocale, setRechercheLocale] = useState('')

  const piloteParParent = typeof search === 'string' && typeof onSearchChange === 'function'
  const valeurRecherche = piloteParParent ? search : rechercheLocale
  const changerRecherche = (v) => (piloteParParent ? onSearchChange(v) : setRechercheLocale(v))

  useEffect(() => {
    const chargerUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEstConnecte(!!user)
      if (user) {
        const { data } = await supabase.from('users').select('prenom').eq('id', user.id).single()
        setPrenom(data?.prenom || null)
      }
    }
    chargerUser()
  }, [])

  useEffect(() => {
    setNbPanier(getPanierCount())
    const maj = () => setNbPanier(getPanierCount())
    window.addEventListener('panier-modifie', maj)
    return () => window.removeEventListener('panier-modifie', maj)
  }, [])

  const soumettreRecherche = (e) => {
    e.preventDefault()
    if (!piloteParParent) {
      router.push(`/?recherche=${encodeURIComponent(rechercheLocale)}`)
    }
  }

  return (
    <>
      <style>{css}</style>

      {/* ── Bandeau d'information ── */}
      <div className="hd-topbar">
        <div className="hd-topbar-inner">
          <span>Livraison sur les 3 îles</span>
          <span className="hd-dot">·</span>
          <span>Paiement à la livraison</span>
          {WHATSAPP_SERVICE && (
            <>
              <span className="hd-dot">·</span>
              <a href={`https://wa.me/${WHATSAPP_SERVICE}`} className="hd-topbar-wa">Aide sur WhatsApp</a>
            </>
          )}
        </div>
      </div>

      {/* ── Header principal ── */}
      <header className="hd-header">
        <div className="hd-header-inner">
          <a href="/" className="hd-brand" aria-label="Salut, retour à l'accueil">
            <img src="/logo.png" alt="" className="hd-brand-logo" />
            <span className="hd-brand-name">Salut</span>
          </a>

          <form onSubmit={soumettreRecherche} className="hd-searchbar" role="search">
            <input
              className="hd-searchbar-input"
              type="search"
              aria-label="Rechercher un produit"
              placeholder="Rechercher un produit"
              value={valeurRecherche}
              onChange={(e) => changerRecherche(e.target.value)}
            />
            <button type="submit" className="hd-searchbar-btn" aria-label="Rechercher">
              <Icone icone={Search} />
            </button>
          </form>

          <div className="hd-actions">
            {estConnecte ? (
              <a href="/commandes" className="hd-action" aria-label={`Mon compte : ${prenom || 'mes commandes'}`}>
                <Icone icone={User} taille={24} />
                <span className="hd-action-txt">
                  <small>Bonjour</small>
                  <b>{prenom || 'Mon compte'}</b>
                </span>
              </a>
            ) : (
              <a href="/login" className="hd-action" aria-label="Se connecter">
                <Icone icone={User} taille={24} />
                <span className="hd-action-txt">
                  <small>Bienvenue</small>
                  <b>Se connecter</b>
                </span>
              </a>
            )}

            <a href="/panier" className="hd-action" aria-label={`Panier : ${nbPanier} article${nbPanier > 1 ? 's' : ''}`}>
              <Icone icone={ShoppingCart} taille={24} />
              {nbPanier > 0 && <span className="hd-cart-badge">{nbPanier}</span>}
              <span className="hd-action-txt">
                <small>Panier</small>
                <b>{nbPanier} article{nbPanier > 1 ? 's' : ''}</b>
              </span>
            </a>
          </div>
        </div>

        {/* Recherche mobile */}
        <form onSubmit={soumettreRecherche} className="hd-searchbar-mobile" role="search">
          <input
            className="hd-searchbar-input"
            type="search"
            aria-label="Rechercher un produit"
            placeholder="Rechercher un produit"
            value={valeurRecherche}
            onChange={(e) => changerRecherche(e.target.value)}
          />
          <button type="submit" className="hd-searchbar-btn" aria-label="Rechercher">
            <Icone icone={Search} />
          </button>
        </form>
      </header>
    </>
  )
}

const css = `
  .hd-topbar { background: ${C.inkDeep}; color: ${C.white}; font-size: 13px; }
  .hd-topbar-inner {
    max-width: 1280px; margin: 0 auto; padding: 8px 16px;
    display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
  }
  .hd-dot { opacity: 0.5; }
  .hd-topbar-wa { color: ${C.white}; font-weight: 700; text-decoration: underline; }

  .hd-header { background: ${C.white}; border-bottom: 1px solid ${C.line}; position: sticky; top: 0; z-index: 30; }
  .hd-header-inner {
    max-width: 1280px; margin: 0 auto; padding: 8px 16px;
    display: flex; align-items: center; gap: 16px;
  }
  .hd-brand { display: flex; align-items: center; gap: 8px; text-decoration: none; flex-shrink: 0; min-height: 44px; }
  .hd-brand-logo { width: 44px; height: 44px; object-fit: contain; }
  .hd-brand-name { font-size: 24px; font-weight: 800; color: ${C.ink}; }

  .hd-searchbar {
    flex: 1; display: none; align-items: center; background: ${C.white};
    border: 1.5px solid ${C.line}; border-radius: 8px; overflow: hidden;
    height: 44px; max-width: 640px;
  }
  .hd-searchbar:focus-within { border-color: ${C.ink}; }
  .hd-searchbar-input {
    flex: 1; min-width: 0; border: none; outline: none; height: 100%; padding: 0 16px;
    font-size: 16px; font-family: inherit; color: ${C.inkDeep}; background: transparent;
  }
  .hd-searchbar-input::placeholder { color: ${C.inkSoft}; }
  .hd-searchbar-btn {
    border: none; cursor: pointer; height: 100%; width: 48px; flex-shrink: 0;
    background: ${C.ink}; color: ${C.white}; display: flex; align-items: center; justify-content: center;
  }
  .hd-searchbar-btn:hover { background: ${C.inkDeep}; }

  .hd-searchbar-mobile {
    display: flex; align-items: stretch; margin: 0 16px 8px; height: 44px;
    border: 1.5px solid ${C.line}; border-radius: 8px; overflow: hidden;
  }
  .hd-searchbar-mobile:focus-within { border-color: ${C.ink}; }

  .hd-actions { display: flex; align-items: center; gap: 4px; margin-left: auto; flex-shrink: 0; }
  .hd-action {
    display: flex; align-items: center; gap: 8px; text-decoration: none;
    color: ${C.inkDeep}; min-width: 44px; min-height: 44px; padding: 0 8px;
    justify-content: center; border-radius: 8px; position: relative;
  }
  .hd-action:hover { background: ${C.bgGrey}; }
  .hd-action-txt { display: none; flex-direction: column; line-height: 1.25; }
  .hd-action-txt small { font-size: 12px; color: ${C.inkSoft}; }
  .hd-action-txt b { font-size: 14px; font-weight: 700; color: ${C.inkDeep}; }
  .hd-cart-badge {
    position: absolute; top: 2px; left: 24px; background: ${C.ink}; color: ${C.white};
    font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center; padding: 0 4px;
  }

  @media (min-width: 700px) {
    .hd-searchbar { display: flex; }
    .hd-searchbar-mobile { display: none; }
    .hd-action-txt { display: flex; }
    .hd-action { padding: 0 12px; }
  }
`
