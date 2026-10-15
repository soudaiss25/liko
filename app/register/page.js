'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'


import { C } from '@/lib/theme'
/* ─────────── Tokens (alignés sur le logo) ─────────── */
const PAYS = [
  { code: '+269', flag: '🇰🇲', pays: 'Comores' },
  { code: '+33', flag: '🇫🇷', pays: 'France' },
  { code: '+262', flag: '🇾🇹', pays: 'Mayotte' },
  { code: '+221', flag: '🇸🇳', pays: 'Sénégal' },
  { code: '+227', flag: '🇳🇪', pays: 'Niger' },
  { code: '+86', flag: '🇨🇳', pays: 'Chine' },
  { code: '+213', flag: '🇩🇿', pays: 'Algérie' },
  { code: '+212', flag: '🇲🇦', pays: 'Maroc' },
  { code: '+216', flag: '🇹🇳', pays: 'Tunisie' },
  { code: '+225', flag: '🇨🇮', pays: "Côte d'Ivoire" },
  { code: '+237', flag: '🇨🇲', pays: 'Cameroun' },
  { code: '+230', flag: '🇲🇺', pays: 'Maurice' },
  { code: '+261', flag: '🇲🇬', pays: 'Madagascar' },
  { code: '+1', flag: '🇺🇸', pays: 'USA' },
  { code: '+44', flag: '🇬🇧', pays: 'UK' },
  { code: '+32', flag: '🇧🇪', pays: 'Belgique' },
  { code: '+41', flag: '🇨🇭', pays: 'Suisse' },
  { code: '+971', flag: '🇦🇪', pays: 'Émirats' },
  { code: '+91', flag: '🇮🇳', pays: 'Inde' },
]

const s = {
  page: {
    minHeight: '100vh',
    background: `radial-gradient(120% 55% at 50% 0%, #FFFFFF 0%, ${C.sand} 55%)`,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'flex-start',
    padding: '20px 18px 40px',
    fontFamily: "var(--font-jakarta), system-ui, -apple-system, sans-serif",
  },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '6px' },
  tagline: { fontSize: '14px', color: C.inkSoft, fontWeight: 500, marginTop: '-6px' },

  card: {
    width: '100%', maxWidth: '440px',
    background: C.white,
    borderWidth: '1px', borderStyle: 'solid', borderColor: C.line,
    borderRadius: '20px',
    padding: '28px 24px 24px',
    boxShadow: '0 4px 24px rgba(29,78,99,0.06)',
  },

  steps: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px' },
  dot: (active, done) => ({
    flex: 1, height: '5px', borderRadius: '3px',
    background: active || done ? C.ink : C.line,
    transition: 'background .2s',
  }),
  stepLabel: { fontSize: '13px', fontWeight: 600, color: C.inkSoft, marginBottom: '4px' },

  title: { fontSize: '22px', fontWeight: 800, color: C.inkDeep, margin: '0 0 4px', letterSpacing: '-0.4px' },
  sub: { fontSize: '14px', color: C.inkSoft, margin: '0 0 22px', lineHeight: 1.4 },

  row: { display: 'flex', gap: '12px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', flex: 1 },
  label: { fontSize: '13px', fontWeight: 700, color: C.inkDeep },
  hint: { fontSize: '12px', color: C.inkSoft, fontWeight: 500 },
  optional: { fontWeight: 500, color: '#A9B4B9' },
  input: {
    height: '54px', padding: '0 16px', width: '100%',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: C.line,
    borderRadius: '13px',
    fontSize: '16px', fontFamily: 'inherit', color: C.inkDeep,
    background: C.sand, outline: 'none',
    transition: 'border-color .15s, background .15s',
  },
  inputFocus: { borderColor: C.ink, background: C.white },

  flagBtn: {
    height: '54px', padding: '0 14px',
    background: C.sand,
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: C.line,
    borderRadius: '13px', display: 'flex', alignItems: 'center', gap: '7px',
    cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: C.inkDeep,
    whiteSpace: 'nowrap', userSelect: 'none', fontFamily: 'inherit',
  },
  flagBtnOpen: { borderColor: C.ink, background: C.white },
  dropdown: {
    position: 'absolute', top: '60px', left: 0, zIndex: 100,
    background: C.white,
    borderWidth: '1px', borderStyle: 'solid', borderColor: C.line,
    borderRadius: '14px', boxShadow: '0 12px 34px rgba(29,78,99,0.14)',
    width: '240px', maxHeight: '260px', overflowY: 'auto', padding: '5px',
  },
  ddItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '11px 12px', cursor: 'pointer', fontSize: '15px',
    borderRadius: '10px',
    background: active ? C.sand : 'transparent',
    color: active ? C.ink : C.inkDeep,
    fontWeight: active ? 700 : 500,
  }),
  ddPays: { flex: 1, color: C.inkSoft, fontSize: '14px', fontWeight: 500 },

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
  back: {
    width: '100%', height: '50px',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: C.line,
    borderRadius: '14px',
    background: C.white, color: C.inkSoft,
    fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
    cursor: 'pointer', marginTop: '10px',
  },
  err: {
    fontSize: '14px', color: C.clay,
    background: '#FBF0EE',
    borderWidth: '1px', borderStyle: 'solid', borderColor: '#F0D9D5',
    padding: '12px 14px', borderRadius: '12px', margin: '0 0 4px', lineHeight: 1.4,
  },
  bottomLink: {
    fontSize: '14px', color: C.inkSoft, textAlign: 'center', marginTop: '18px', marginBottom: 0,
  },
  foot: { fontSize: '13px', color: '#A9B4B9', textAlign: 'center', marginTop: '22px' },
}

/* ─────────── Logo (ton PNG détouré dans /public) ─────────── */
function Logo({ size = 130 }) {
  return (
    <img src="/logo.png" alt="Salut" width={size} height={size}
      style={{ objectFit: 'contain', display: 'block' }} />
  )
}

export default function Register() {
  const [etape, setEtape] = useState(1)

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [telephone, setTelephone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const [selected, setSelected] = useState(PAYS[0])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')
  const [focused, setFocused] = useState(null)
  const dropdownRef = useRef(null)
  const supabase = createClient()

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const validerEtape1 = () => {
    if (!prenom || !nom) return 'Indique ton prénom et ton nom'
    if (!username) return "Choisis un nom d'utilisateur"
    if (username.length < 3) return "Le nom d'utilisateur doit faire au moins 3 caractères"
    return null
  }

  const suivant = () => {
    const err = validerEtape1()
    if (err) { setErreur(err); return }
    setErreur('')
    setEtape(2)
  }

  const validerEtape2 = () => {
    if (!telephone) return 'Indique ton numéro de téléphone'
    if (!password) return 'Choisis un mot de passe'
    if (password.length < 6) return 'Le mot de passe doit faire au moins 6 caractères'
    if (password !== passwordConfirm) return 'Les deux mots de passe ne sont pas identiques'
    return null
  }

  const inscrire = async () => {
    const err = validerEtape2()
    if (err) { setErreur(err); return }

    setLoading(true)
    setErreur('')

    const numeroComplet = `${selected.code}${telephone}`

    const { data, error } = await supabase.auth.signUp({
      phone: numeroComplet,
      password,
    })

    if (error) { setErreur(error.message); setLoading(false); return }

    // Sans session, impossible de prouver qui on est au serveur
    const jeton = data?.session?.access_token
    if (!jeton) { setErreur('Inscription impossible, réessaie'); setLoading(false); return }

    // Le serveur déduit l'id et le téléphone du jeton : on n'envoie que le profil
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ prenom, nom, username, email, adresse }),
    })

    const result = await res.json().catch(() => ({}))
    if (!res.ok || result.error) {
      setErreur(result.error || 'Inscription impossible, réessaie')
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  const inputStyle = (name) => ({ ...s.input, ...(focused === name ? s.inputFocus : {}) })
  const bind = (name) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  })

  const etape1Valide = prenom && nom && username
  const etape2Valide = telephone && password && passwordConfirm

  return (
    <main style={s.page}>
      <div style={s.logoWrap}>
        <Logo />
        <div style={s.tagline}>La marketplace des Comores</div>
      </div>

      <div style={s.card}>

        <div style={s.steps}>
          <div style={s.dot(etape === 1, etape > 1)} />
          <div style={s.dot(etape === 2, false)} />
        </div>
        <div style={s.stepLabel}>Étape {etape} sur 2</div>

        {etape === 1 ? (
          <>
            <h1 style={s.title}>Bienvenue 👋</h1>
            <p style={s.sub}>Commençons par faire connaissance.</p>

            <div style={s.row}>
              <div style={s.field}>
                <label style={s.label}>Prénom</label>
                <input style={inputStyle('prenom')} placeholder="Soudaiss"
                  value={prenom} onChange={(e) => setPrenom(e.target.value)} {...bind('prenom')} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Nom</label>
                <input style={inputStyle('nom')} placeholder="Elfayadine"
                  value={nom} onChange={(e) => setNom(e.target.value)} {...bind('nom')} />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Nom d'utilisateur</label>
              <span style={s.hint}>C'est ce nom qui te servira à te connecter.</span>
              <input style={inputStyle('username')} placeholder="soudaiss"
                value={username} onChange={(e) => setUsername(e.target.value)} {...bind('username')}
                onKeyDown={(e) => e.key === 'Enter' && etape1Valide && suivant()} />
            </div>

            {erreur && <p style={s.err}>{erreur}</p>}

            <button onClick={suivant} disabled={!etape1Valide}
              style={!etape1Valide ? s.ctaDisabled : s.cta}>
              Continuer
            </button>

            <p style={s.bottomLink}>
              Déjà un compte ?{' '}
              <a href="/login" style={{ color: C.ink, textDecoration: 'none', fontWeight: 700 }}>
                Se connecter
              </a>
            </p>
          </>
        ) : (
          <>
            <h1 style={s.title}>Presque fini ✅</h1>
            <p style={s.sub}>Ton téléphone sert à te contacter pour tes commandes.</p>

            <div style={s.field}>
              <label style={s.label}>Téléphone</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <div onClick={() => setOpen(!open)}
                    style={{ ...s.flagBtn, ...(open ? s.flagBtnOpen : {}) }}>
                    <span>{selected.flag}</span>
                    <span>{selected.code}</span>
                    <span style={{ fontSize: '11px', color: C.inkSoft }}>▾</span>
                  </div>
                  {open && (
                    <div style={s.dropdown}>
                      {PAYS.map((p) => (
                        <div key={p.code} onClick={() => { setSelected(p); setOpen(false) }}
                          style={s.ddItem(selected.code === p.code)}>
                          <span>{p.flag}</span>
                          <span style={s.ddPays}>{p.pays}</span>
                          <span>{p.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input style={{ ...inputStyle('tel'), flex: 1 }} type="tel" placeholder="XXX XX XX"
                  value={telephone} onChange={(e) => setTelephone(e.target.value)} {...bind('tel')} />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Email <span style={s.optional}>— facultatif</span></label>
              <span style={s.hint}>Utile si tu perds l'accès à ton numéro.</span>
              <input style={inputStyle('email')} type="email" placeholder="soudaiss@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} {...bind('email')} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Adresse <span style={s.optional}>— facultatif</span></label>
              <input style={inputStyle('adresse')} placeholder="Moroni, Grande Comore"
                value={adresse} onChange={(e) => setAdresse(e.target.value)} {...bind('adresse')} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Mot de passe</label>
              <span style={s.hint}>Au moins 6 caractères.</span>
              <input style={inputStyle('pw')} type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} {...bind('pw')} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Confirmer le mot de passe</label>
              <input style={inputStyle('pw2')} type="password" placeholder="••••••••"
                value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} {...bind('pw2')}
                onKeyDown={(e) => e.key === 'Enter' && etape2Valide && inscrire()} />
            </div>

            {erreur && <p style={s.err}>{erreur}</p>}

            <button onClick={inscrire} disabled={loading || !etape2Valide}
              style={loading || !etape2Valide ? s.ctaDisabled : s.cta}>
              {loading ? 'Création du compte…' : 'Créer mon compte'}
            </button>

            <button onClick={() => { setEtape(1); setErreur('') }} style={s.back}>
              ← Retour
            </button>
          </>
        )}
      </div>

      <p style={s.foot}>Livraison sur les trois îles</p>
    </main>
  )
}