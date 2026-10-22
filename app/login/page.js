'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import CadreAuth from '@/components/ui/CadreAuth'
import Champ, { Message } from '@/components/ui/Champ'
import Bouton from '@/components/ui/Bouton'
import { WHATSAPP_SERVICE } from '@/lib/config'

/* Page à rouvrir après la connexion (?suite=/admin).
   Sécurité : on n'accepte qu'un chemin INTERNE ("/admin"), jamais une adresse
   externe ("https://site-pirate.com" ou "//site-pirate.com"), sinon quelqu'un
   pourrait envoyer un lien piégé qui redirige vers un faux site après le login. */
function lireSuite() {
  const suite = new URLSearchParams(window.location.search).get('suite') || ''
  const interne = suite.startsWith('/') && !suite.startsWith('//') && !suite.startsWith('/\\')
  return interne && !suite.startsWith('/login') ? suite : null
}

/* Où arrive chacun après la connexion, selon son rôle.
   Les clients (et tout rôle non listé) arrivent sur l'accueil. */
const ESPACE_PAR_ROLE = {
  admin: '/admin',
  collab_etranger: '/espace/etranger',
  collab_comores: '/espace/comores',
}

export default function Login() {
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')
  const [pageDemandee, setPageDemandee] = useState(null)
  const supabase = createClient()

  // Si on arrive ici depuis une page protégée, on l'affiche au-dessus du formulaire
  useEffect(() => { setPageDemandee(lireSuite()) }, [])

  /* ── Connexion ──
     1. On envoie identifiant + mot de passe à NOTRE serveur (/api/login)
     2. Le serveur vérifie et renvoie des jetons de session
     3. On donne ces jetons au client Supabase du navigateur → on est connecté
     4. On redirige : vers la page demandée (?suite=…) s'il y en a une,
        sinon selon le rôle (admin → /admin, collaborateurs → leur espace,
        clients → accueil)
  */
  const connecter = async () => {
    setLoading(true)
    setErreur('')

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiant, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErreur(data.error || 'Connexion impossible')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })

      if (error) {
        setErreur('Connexion impossible, réessaie')
        setLoading(false)
        return
      }

      // Chacun arrive directement dans SON espace selon son rôle
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profil } = await supabase.from('users').select('role').eq('id', user.id).single()
      window.location.href = lireSuite() || ESPACE_PAR_ROLE[profil?.role] || '/'
    } catch (e) {
      setErreur('Pas de connexion internet ? Réessaie dans un instant.')
      setLoading(false)
    }
  }

  const disabled = loading || !identifiant || !password

  const soumettre = (e) => {
    e.preventDefault()
    if (!disabled) connecter()
  }

  return (
    <CadreAuth
      titre="Connexion"
      sous={pageDemandee
        ? 'Cette page est protégée : connecte-toi pour y accéder.'
        : 'Connecte-toi pour suivre tes commandes.'}
      liens={
        <>
          <span>Pas encore de compte ? <a href="/register">Créer un compte</a></span>
          {WHATSAPP_SERVICE && (
            <span>Mot de passe perdu ? <a href={`https://wa.me/${WHATSAPP_SERVICE}`}>Écris-nous sur WhatsApp</a></span>
          )}
        </>
      }
    >
      <form onSubmit={soumettre} noValidate>
        <Champ id="identifiant" label="Téléphone ou nom d'utilisateur" aide="Le même que tu as choisi à l'inscription.">
          <input
            id="identifiant"
            className="ui-input"
            aria-describedby="identifiant-aide"
            placeholder="+269 333 44 55 ou ton nom d'utilisateur"
            autoComplete="username"
            autoCapitalize="none"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
          />
        </Champ>

        <Champ id="password" label="Mot de passe">
          <input
            id="password"
            className="ui-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Champ>

        {erreur && <Message ton="err">{erreur}</Message>}

        <Bouton type="submit" variante="principal" grand disabled={disabled}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </Bouton>
      </form>
    </CadreAuth>
  )
}
