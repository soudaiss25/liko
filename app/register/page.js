'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import CadreAuth from '@/components/ui/CadreAuth'
import Champ, { Message } from '@/components/ui/Champ'
import Bouton from '@/components/ui/Bouton'
import Icone from '@/components/ui/Icone'

/* Indicatifs proposés : texte seul (les drapeaux ne s'affichent pas sur Windows) */
const PAYS = [
  { code: '+269', pays: 'Comores' },
  { code: '+33', pays: 'France' },
  { code: '+262', pays: 'Mayotte' },
  { code: '+221', pays: 'Sénégal' },
  { code: '+227', pays: 'Niger' },
  { code: '+86', pays: 'Chine' },
  { code: '+213', pays: 'Algérie' },
  { code: '+212', pays: 'Maroc' },
  { code: '+216', pays: 'Tunisie' },
  { code: '+225', pays: "Côte d'Ivoire" },
  { code: '+237', pays: 'Cameroun' },
  { code: '+230', pays: 'Maurice' },
  { code: '+261', pays: 'Madagascar' },
  { code: '+1', pays: 'USA' },
  { code: '+44', pays: 'UK' },
  { code: '+32', pays: 'Belgique' },
  { code: '+41', pays: 'Suisse' },
  { code: '+971', pays: 'Émirats' },
  { code: '+91', pays: 'Inde' },
]

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
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')
  const supabase = createClient()

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

  const etape1Valide = prenom && nom && username
  const etape2Valide = telephone && password && passwordConfirm

  const soumettre = (e) => {
    e.preventDefault()
    if (etape === 1) { if (etape1Valide) suivant() } else if (!loading && etape2Valide) inscrire()
  }

  return (
    <CadreAuth
      titre={etape === 1 ? 'Créer un compte' : 'Ton numéro et ton mot de passe'}
      sous={etape === 1
        ? 'Un compte te permet de retrouver tes commandes sur tous tes appareils. Pas besoin de compte pour commander.'
        : 'Ton téléphone sert à te contacter pour tes commandes.'}
      liens={etape === 1 ? <span>Déjà un compte ? <a href="/login">Se connecter</a></span> : null}
    >
      <p className="ui-aide" style={{ marginBottom: 16 }}>Étape {etape} sur 2</p>

      <form onSubmit={soumettre} noValidate>
        {etape === 1 ? (
          <>
            <Champ id="prenom" label="Prénom">
              <input id="prenom" className="ui-input" autoComplete="given-name"
                value={prenom} onChange={(e) => setPrenom(e.target.value)} />
            </Champ>

            <Champ id="nom" label="Nom">
              <input id="nom" className="ui-input" autoComplete="family-name"
                value={nom} onChange={(e) => setNom(e.target.value)} />
            </Champ>

            <Champ id="username" label="Nom d'utilisateur" aide="C'est ce nom qui te servira à te connecter.">
              <input id="username" className="ui-input" autoCapitalize="none" autoComplete="username"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </Champ>

            {erreur && <Message ton="err">{erreur}</Message>}

            <Bouton type="submit" variante="principal" grand disabled={!etape1Valide}>Continuer</Bouton>
          </>
        ) : (
          <>
            <Champ id="indicatif" label="Pays du numéro">
              <select id="indicatif" className="ui-input" value={selected.code}
                onChange={(e) => setSelected(PAYS.find((p) => p.code === e.target.value))}>
                {PAYS.map((p) => <option key={p.code} value={p.code}>{p.pays} ({p.code})</option>)}
              </select>
            </Champ>

            <Champ id="tel" label="Téléphone">
              <input id="tel" className="ui-input" type="tel" inputMode="tel" autoComplete="tel-national"
                placeholder="333 44 55" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </Champ>

            <Champ id="email" label="E-mail" optionnel>
              <input id="email" className="ui-input" type="email" inputMode="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </Champ>

            <Champ id="adresse" label="Adresse" optionnel>
              <input id="adresse" className="ui-input" autoComplete="street-address"
                placeholder="Moroni, Grande Comore"
                value={adresse} onChange={(e) => setAdresse(e.target.value)} />
            </Champ>

            <Champ id="pw" label="Mot de passe" aide="Au moins 6 caractères.">
              <input id="pw" className="ui-input" type="password" autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </Champ>

            <Champ id="pw2" label="Confirmer le mot de passe">
              <input id="pw2" className="ui-input" type="password" autoComplete="new-password"
                value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
            </Champ>

            {erreur && <Message ton="err">{erreur}</Message>}

            <Bouton type="submit" variante="principal" grand disabled={loading || !etape2Valide}>
              {loading ? 'Création du compte…' : 'Créer mon compte'}
            </Bouton>
            <Bouton grand style={{ marginTop: 8 }} onClick={() => { setEtape(1); setErreur('') }}>
              <Icone icone={ArrowLeft} taille={18} /> Retour
            </Bouton>
          </>
        )}
      </form>
    </CadreAuth>
  )
}
