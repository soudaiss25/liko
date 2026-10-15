'use client'

/* ─────────── lib/garde.js ───────────
   "Garde" des pages protégées (admin, espaces collaborateurs).

   Utilisation dans une page :
     const { etat, profil } = useGardeAcces(['collab_comores'])
     etat = 'verification' → afficher "Vérification…"
            'refuse'       → connecté, mais pas le bon rôle
            'ok'           → afficher la page ; profil = { id, role, prenom }

   Règles :
   1. Pas connecté → redirection vers /login, puis retour automatique sur la page demandée.
   2. Arrivée "directe" (URL tapée, favori, lien venant d'un autre site) →
      on déconnecte et on redemande le login, même si une session existe.
      ATTENTION, TEMPORAIRE, choix assumé : à revoir lors de la mise en production
      (passer EXIGER_LOGIN_SI_ACCES_DIRECT à false suffit à le désactiver).
   3. L'admin a accès à tout (pratique pour tester les espaces collaborateurs).

   ATTENTION : cette garde protège l'AFFICHAGE. La vraie sécurité des données reste
   dans la base (RLS + fonctions-guichets), qui revérifie tout de son côté.
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

export const EXIGER_LOGIN_SI_ACCES_DIRECT = true

/* Vrai si on n'arrive PAS depuis une page de notre propre site */
function estAccesDirect() {
  const provenance = document.referrer
  if (!provenance) return true // URL tapée, favori, nouvel onglet vide…
  try {
    return new URL(provenance).origin !== window.location.origin
  } catch {
    return true
  }
}

/* Envoie vers /login en mémorisant la page demandée (?suite=/admin)

   Sécurité anti-boucle : si on est DÉJÀ sur /login (par exemple parce que
   la garde a été mise sur la page de login par erreur), on ne redirige pas.
   Sans ça : /login → /login?suite=/login → /login?suite=/login?suite=… à l'infini. */
export function allerAuLogin() {
  const chemin = window.location.pathname
  if (chemin === '/login' || chemin.startsWith('/login/')) return false

  // On ne garde que le chemin, sans l'éventuel ?suite=… (évite l'empilement)
  window.location.replace(`/login?suite=${encodeURIComponent(chemin)}`)
  return true
}

export function useGardeAcces(rolesAutorises) {
  const [etat, setEtat] = useState('verification')
  const [profil, setProfil] = useState(null)

  useEffect(() => {
    const verifier = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Règle 1 : pas connecté
      if (!user) {
        if (!allerAuLogin()) setEtat('refuse') // déjà sur /login : on s'arrête là
        return
      }

      // Règle 2 : arrivée directe par l'URL → on redemande le login
      if (EXIGER_LOGIN_SI_ACCES_DIRECT && estAccesDirect()) {
        await supabase.auth.signOut()
        if (!allerAuLogin()) setEtat('refuse')
        return
      }

      const { data } = await supabase.from('users').select('role, prenom').eq('id', user.id).single()
      const role = data?.role || ''
      setProfil({ id: user.id, role, prenom: data?.prenom || '' })

      // Règle 3 : l'admin passe partout
      setEtat(role === 'admin' || rolesAutorises.includes(role) ? 'ok' : 'refuse')
    }
    verifier()
  }, [])

  return { etat, profil }
}