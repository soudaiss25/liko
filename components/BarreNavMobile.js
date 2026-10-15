'use client'

/* ─────────── components/BarreNavMobile.js ───────────
   La barre de navigation du bas, sur téléphone (cachée sur ordinateur).
   Réutilisable sur toutes les pages client : <BarreNavMobile actif="commandes" />
   Accueil, Panier, Commandes pour tout le monde ; puis Connexion (non connecté)
   ou Admin (rôle admin).
*/

import { useState, useEffect } from 'react'
import { House, ShoppingCart, Package, User, Settings } from 'lucide-react'
import Icone from '@/components/ui/Icone'
import { createClient } from '@/lib/supabase-browser'
import { C } from '@/lib/theme'

const ITEMS = [
  { id: 'accueil', icone: House, label: 'Accueil', href: '/' },
  { id: 'panier', icone: ShoppingCart, label: 'Panier', href: '/panier' },
  { id: 'commandes', icone: Package, label: 'Commandes', href: '/commandes' },
]

export default function BarreNavMobile({ actif }) {
  const [connecte, setConnecte] = useState(false)
  const [role, setRole] = useState(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      setConnecte(!!data?.user)
      if (!data?.user) return
      const { data: profil } = await supabase.from('users').select('role').eq('id', data.user.id).single()
      setRole(profil?.role || null)
    })
  }, [])

  const items = [
    ...ITEMS,
    ...(!connecte ? [{ id: 'connexion', icone: User, label: 'Connexion', href: '/login' }] : []),
    ...(role === 'admin' ? [{ id: 'admin', icone: Settings, label: 'Admin', href: '/admin' }] : []),
  ]

  return (
    <nav className="bn-barre" aria-label="Navigation principale">
      <style href="barre-nav-mobile" precedence="default">{css}</style>
      {items.map((item) => (
        <a key={item.id} href={item.href} className={`bn-item ${actif === item.id ? 'bn-on' : ''}`}
          aria-current={actif === item.id ? 'page' : undefined}>
          <Icone icone={item.icone} taille={24} />
          <span className="bn-label">{item.label}</span>
        </a>
      ))}
    </nav>
  )
}

const css = `
  .bn-barre {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 40; display: flex;
    background: ${C.white}; border-top: 1px solid ${C.line}; padding: 4px 0 8px;
  }
  .bn-item {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; text-decoration: none; min-height: 48px; color: ${C.inkSoft};
  }
  .bn-label { font-size: 12px; font-weight: 600; }
  .bn-on { color: ${C.ink}; }
  .bn-on .bn-label { font-weight: 800; }
  @media (min-width: 1000px) { .bn-barre { display: none; } }
`
