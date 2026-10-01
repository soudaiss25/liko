'use client'

/* ─────────── components/BarreNavMobile.js ───────────
   La barre de navigation du bas, sur téléphone (cachée sur ordinateur).
   Réutilisable sur toutes les pages client : <BarreNavMobile actif="commandes" />
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

const ITEMS = [
  { id: 'accueil', icone: '🏠', label: 'Accueil', href: '/' },
  { id: 'panier', icone: '🛒', label: 'Panier', href: '/panier' },
  { id: 'commandes', icone: '📦', label: 'Commandes', href: '/commandes' },
]

export default function BarreNavMobile({ actif }) {
  const [connecte, setConnecte] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setConnecte(!!data?.user))
  }, [])

  const items = [
    ...ITEMS,
    connecte
      ? { id: 'profil', icone: '👤', label: 'Profil', href: '/profil' }
      : { id: 'connexion', icone: '👤', label: 'Connexion', href: '/login' },
  ]

  return (
    <nav className="bn-barre" aria-label="Navigation principale">
      <style href="barre-nav-mobile" precedence="default">{css}</style>
      {items.map((item) => (
        <a key={item.id} href={item.href} className={`bn-item ${actif === item.id ? 'bn-on' : ''}`}
          aria-current={actif === item.id ? 'page' : undefined}>
          <span className="bn-icone" aria-hidden="true">{item.icone}</span>
          <span className="bn-label">{item.label}</span>
        </a>
      ))}
    </nav>
  )
}

const css = `
  .bn-barre {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 40; display: flex;
    background: #fff; border-top: 1px solid #E4DED2; padding: 8px 0 12px;
  }
  .bn-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; text-decoration: none; min-height: 44px; justify-content: center; }
  .bn-icone { font-size: 19px; opacity: 0.45; }
  .bn-label { font-size: 10.5px; font-weight: 600; color: #8A979D; }
  .bn-on .bn-icone { opacity: 1; }
  .bn-on .bn-label { color: #1D4E63; font-weight: 800; }
  @media (min-width: 1000px) { .bn-barre { display: none; } }
`