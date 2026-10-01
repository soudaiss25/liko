'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

/* ─────────── Tokens (alignés sur le logo) ─────────── */
const C = {
  ink: '#1D4E63',
  inkDeep: '#143A4B',
  inkSoft: '#6E8A97',
  sand: '#FAF8F3',
  line: '#E9E4DA',
  gold: '#D99A2B',
  leaf: '#4E8A6B',
  clay: '#C2574A',
  white: '#FFFFFF',
}

const s = {
  page: {
    minHeight: '100vh',
    background: `radial-gradient(120% 60% at 50% 0%, #FFFFFF 0%, ${C.sand} 58%)`,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px 18px 40px',
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  },
  logoWrap: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', marginBottom: '10px',
  },
  tagline: {
    fontSize: '14px', color: C.inkSoft, fontWeight: 500, marginTop: '-6px',
  },
  card: {
    width: '100%', maxWidth: '420px',
    background: C.white,
    borderWidth: '1px', borderStyle: 'solid', borderColor: C.line,
    borderRadius: '20px',
    padding: '28px 24px 24px',
    boxShadow: '0 4px 24px rgba(29,78,99,0.06)',
  },
  title: {
    fontSize: '22px', fontWeight: 800, color: C.inkDeep, margin: '0 0 4px',
    letterSpacing: '-0.4px',
  },
  sub: {
    fontSize: '14px', color: C.inkSoft, margin: '0 0 24px', lineHeight: 1.4,
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px',
  },
  label: { fontSize: '13px', fontWeight: 700, color: C.inkDeep },
  hint: { fontSize: '12px', color: C.inkSoft, fontWeight: 500 },
  input: {
    height: '54px', padding: '0 16px', width: '100%',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: C.line,
    borderRadius: '13px',
    fontSize: '16px', fontFamily: 'inherit', color: C.inkDeep,
    background: C.sand, outline: 'none',
    transition: 'border-color .15s, background .15s',
  },
  inputFocus: { borderColor: C.ink, background: C.white },
  cta: {
    width: '100%', height: '56px', border: 'none', borderRadius: '14px',
    background: C.ink, color: C.white,
    fontSize: '16px', fontWeight: 700, fontFamily: 'inherit',
    cursor: 'pointer', marginTop: '6px', transition: 'background .15s',
  },
  ctaDisabled: {
    width: '100%', height: '56px', border: 'none', borderRadius: '14px',
    background: C.line, color: '#A9B4B9',
    fontSize: '16px', fontWeight: 700, fontFamily: 'inherit',
    cursor: 'not-allowed', marginTop: '6px',
  },
  err: {
    fontSize: '14px', color: C.clay,
    background: '#FBF0EE',
    borderWidth: '1px', borderStyle: 'solid', borderColor: '#F0D9D5',
    padding: '12px 14px', borderRadius: '12px', margin: '0 0 4px', lineHeight: 1.4,
  },
  links: {
    display: 'flex', flexDirection: 'column', gap: '12px',
    alignItems: 'center', marginTop: '22px',
  },
  link: {
    fontSize: '14px', color: C.ink, textDecoration: 'none', fontWeight: 600,
  },
  linkMute: {
    fontSize: '14px', color: C.inkSoft, textDecoration: 'none', fontWeight: 500,
  },
  foot: {
    fontSize: '13px', color: '#A9B4B9', textAlign: 'center', marginTop: '22px',
  },
}

/* ─────────── Logo (ton PNG détouré dans /public) ─────────── */
function Logo({ size = 150 }) {
  return (
    <img
      src="/logo.png"
      alt="Salut"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}

/* Page à rouvrir après la connexion (?suite=/admin).
   Sécurité : on n'accepte qu'un chemin INTERNE ("/admin"), jamais une adresse
   externe ("https://site-pirate.com" ou "//site-pirate.com"), sinon quelqu'un
   pourrait envoyer un lien piégé qui redirige vers un faux site après le login. */
function lireSuite() {
  const suite = new URLSearchParams(window.location.search).get('suite') || ''
  const interne = suite.startsWith('/') && !suite.startsWith('//') && !suite.startsWith('/\\')
  return interne && !suite.startsWith('/login') ? suite : null
}

export default function Login() {
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')
  const [focused, setFocused] = useState(null)
  const [pageDemandee, setPageDemandee] = useState(null)
  const supabase = createClient()

  // Si on arrive ici depuis une page protégée, on l'affiche au-dessus du formulaire
  useEffect(() => { setPageDemandee(lireSuite()) }, [])

  /* ── Connexion ──
     1. On envoie identifiant + mot de passe à NOTRE serveur (/api/login)
     2. Le serveur vérifie et renvoie des jetons de session
     3. On donne ces jetons au client Supabase du navigateur → on est connecté
     4. On redirige : vers la page demandée (?suite=…) s'il y en a une,
        sinon selon le rôle (collaborateurs → leur espace, les autres → accueil)
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
      const ESPACE_PAR_ROLE = {
        collab_etranger: '/espace/etranger',
        collab_comores: '/espace/comores',
      }
      window.location.href = lireSuite() || ESPACE_PAR_ROLE[profil?.role] || '/'
    } catch (e) {
      setErreur('Pas de connexion internet ? Réessaie dans un instant.')
      setLoading(false)
    }
  }

  const disabled = loading || !identifiant || !password

  const inputStyle = (name) => ({
    ...s.input,
    ...(focused === name ? s.inputFocus : {}),
  })

  return (
    <main style={s.page}>
      <div style={s.logoWrap}>
        <Logo />
        <div style={s.tagline}>La marketplace des Comores</div>
      </div>

      <div style={s.card}>
        <h1 style={s.title}>Content de te revoir 👋</h1>
        <p style={s.sub}>
          {pageDemandee
            ? 'Cette page est protégée : connecte-toi pour y accéder.'
            : 'Connecte-toi pour suivre tes commandes.'}
        </p>

        <div style={s.field}>
          <label htmlFor="identifiant" style={s.label}>Téléphone ou nom d'utilisateur</label>
          <span style={s.hint}>Le même que tu as choisi à l'inscription.</span>
          <input
            id="identifiant"
            style={inputStyle('id')}
            placeholder="+269 XXX XX XX ou ton username"
            autoComplete="username"
            autoCapitalize="none"
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            onFocus={() => setFocused('id')}
            onBlur={() => setFocused(null)}
            onKeyDown={(e) => e.key === 'Enter' && !disabled && connecter()}
          />
        </div>

        <div style={s.field}>
          <label htmlFor="password" style={s.label}>Mot de passe</label>
          <input
            id="password"
            style={inputStyle('pw')}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused('pw')}
            onBlur={() => setFocused(null)}
            onKeyDown={(e) => e.key === 'Enter' && !disabled && connecter()}
          />
        </div>

        {erreur && <p role="alert" style={s.err}>{erreur}</p>}

        <button onClick={connecter} disabled={disabled} style={disabled ? s.ctaDisabled : s.cta}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <div style={s.links}>
          <a href="/forgot" style={s.link}>Mot de passe oublié</a>
          <a href="/forgot?type=numero" style={s.link}>J'ai changé de numéro</a>
          <a href="/register" style={s.linkMute}>Pas encore de compte ? Créer un compte</a>
        </div>
      </div>

      <p style={s.foot}>Livraison sur les trois îles</p>
    </main>
  )
}