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
import { getPanierCount } from '@/lib/cart'

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

      {/* ── Bandeau réassurance ── */}
      <div className="hd-topbar">
        <div className="hd-topbar-inner">
          <span>🚚 Livraison sur les 3 îles</span>
          <span className="hd-dot">·</span>
          <span>💵 Paiement à la livraison</span>
          <span className="hd-dot">·</span>
          <span className="hd-topbar-wa">💬 Aide sur WhatsApp</span>
        </div>
      </div>

      {/* ── Header principal ── */}
      <header className="hd-header">
        <div className="hd-header-inner">
          <a href="/" className="hd-brand">
            <img src="/logo.png" alt="Salut" className="hd-brand-logo" />
            <span className="hd-brand-name">Salut</span>
          </a>

          <form onSubmit={soumettreRecherche} className="hd-searchbar">
            <input
              className="hd-searchbar-input"
              placeholder="Rechercher un produit, une marque…"
              value={valeurRecherche}
              onChange={(e) => changerRecherche(e.target.value)}
            />
            <button type="submit" className="hd-searchbar-btn">🔍 Rechercher</button>
          </form>

          <div className="hd-actions">
            {estConnecte ? (
              <a href="/commandes" className="hd-action">
                <span className="hd-action-ico">👤</span>
                <span className="hd-action-txt">
                  <small>Bonjour</small>
                  <b>{prenom || 'Mon compte'}</b>
                </span>
              </a>
            ) : (
              <a href="/login" className="hd-action">
                <span className="hd-action-ico">👤</span>
                <span className="hd-action-txt">
                  <small>Bienvenue</small>
                  <b>Se connecter</b>
                </span>
              </a>
            )}

            <a href="/panier" className="hd-action">
              <span className="hd-action-ico">🛒</span>
              {nbPanier > 0 && <span className="hd-cart-badge">{nbPanier}</span>}
              <span className="hd-action-txt">
                <small>Panier</small>
                <b>{nbPanier} article{nbPanier > 1 ? 's' : ''}</b>
              </span>
            </a>
          </div>
        </div>

        {/* Recherche mobile */}
        <form onSubmit={soumettreRecherche} className="hd-searchbar-mobile">
          <input
            className="hd-searchbar-input"
            placeholder="Rechercher un produit…"
            value={valeurRecherche}
            onChange={(e) => changerRecherche(e.target.value)}
          />
          <button type="submit" className="hd-searchbar-btn">🔍</button>
        </form>
      </header>
    </>
  )
}

const css = `
  .hd-topbar { background: ${C.inkDeep}; color: #fff; font-size: 12px; }
  .hd-topbar-inner {
    max-width: 1280px; margin: 0 auto; padding: 8px 20px;
    display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;
  }
  .hd-dot { opacity: 0.4; }
  .hd-topbar-wa { color: ${C.gold}; font-weight: 600; }

  .hd-header { background: #fff; border-bottom: 1px solid ${C.line}; position: sticky; top: 0; z-index: 30; }
  .hd-header-inner {
    max-width: 1280px; margin: 0 auto; padding: 14px 20px;
    display: flex; align-items: center; gap: 22px;
  }
  .hd-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
  .hd-brand-logo { width: 92px; height: 92px; object-fit: contain; }
  .hd-brand-name { font-size: 33px; font-weight: 800; color: ${C.ink}; letter-spacing: -0.4px; }

  .hd-searchbar {
    flex: 1; display: none; align-items: center; background: #fff;
    border: 1.5px solid ${C.ink}; border-radius: 8px; overflow: hidden;
    height: 46px; max-width: 640px; transition: border-color .15s, box-shadow .15s;
  }
  .hd-searchbar:focus-within { border-color: ${C.gold}; box-shadow: 0 0 0 3px rgba(232,160,32,0.15); }
  .hd-searchbar-input {
    flex: 1; border: none; outline: none; height: 100%; padding: 0 16px;
    font-size: 15px; font-family: inherit; color: ${C.inkDeep};
  }
  .hd-searchbar-input::placeholder { color: #9AA7AE; }
  .hd-searchbar-btn {
    border: none; cursor: pointer; height: 100%; padding: 0 20px;
    background: ${C.gold}; color: ${C.inkDeep}; font-weight: 700; font-size: 14px;
    font-family: inherit; white-space: nowrap;
  }
  .hd-searchbar-btn:hover { background: ${C.goldDeep}; }

  .hd-searchbar-mobile { display: flex; align-items: stretch; gap: 0; padding: 0 16px 12px; }
  .hd-searchbar-mobile .hd-searchbar-input {
    background: #fff; border: 1.5px solid ${C.ink}; border-right: none;
    border-radius: 8px 0 0 8px; height: 44px;
  }
  .hd-searchbar-mobile .hd-searchbar-btn { border-radius: 0 8px 8px 0; height: 44px; padding: 0 16px; }

  .hd-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
  .hd-action {
    display: flex; align-items: center; gap: 10px; text-decoration: none;
    color: ${C.inkDeep}; padding: 9px 14px; border-radius: 10px; position: relative;
    transition: background .15s;
  }
  .hd-action:hover { background: ${C.sand}; }
  .hd-action-ico { font-size: 30px; }
  .hd-action-txt { display: none; flex-direction: column; line-height: 1.25; }
  .hd-action-txt small { font-size: 13px; color: ${C.inkSoft}; }
  .hd-action-txt b { font-size: 18px; font-weight: 700; color: ${C.inkDeep}; }
  .hd-cart-badge {
    position: absolute; top: 2px; left: 24px; background: ${C.gold}; color: ${C.inkDeep};
    font-size: 10px; font-weight: 800; min-width: 18px; height: 18px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center; padding: 0 5px;
  }

  @media (min-width: 700px) {
    .hd-searchbar { display: flex; }
    .hd-searchbar-mobile { display: none; }
    .hd-action-txt { display: flex; }
  }
`