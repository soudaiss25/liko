'use client'

/* ─────────── components/admin/Collaborateurs.js ───────────
   Onglet "Collaborateurs" de l'admin :
   - créer un compte collaborateur (étranger ou Comores)
   - ou donner l'accès à un compte client qui existe déjà
   - changer d'espace, redéfinir un mot de passe, retirer l'accès

   Tout passe par la route serveur /api/admin/collaborateurs
   (la seule à avoir le droit de créer des comptes).
*/

import { useState, useEffect } from 'react'
import { Globe, MapPin, Plus, Copy, Check, ArrowLeftRight, KeyRound, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { usernameValide, MESSAGE_USERNAME } from '@/lib/username'
import Icone from '@/components/ui/Icone'
import Badge from '@/components/ui/Badge'
import EtatVide from '@/components/ui/EtatVide'
import { ChargementListe } from '@/components/ui/Squelette'

import { C } from '@/lib/theme'
const ROLES = {
  collab_etranger: { icone: Globe, label: 'À l\u2019étranger', detail: 'Prépare et expédie les envois' },
  collab_comores: { icone: MapPin, label: 'Aux Comores', detail: 'Réceptionne les colis, gère le stock' },
}

const MDP_MIN = 8

/* Mêmes règles que le serveur, pour répondre tout de suite à l'écran */
const telephoneValide = (t) => /^\+\d{8,15}$/.test(String(t).replace(/[\s.\-()]/g, ''))

/* Mot de passe lisible : sans 0/O, 1/l/I (trop faciles à confondre en le dictant) */
function genererMotDePasse(longueur = 10) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const aleatoire = new Uint32Array(longueur)
  crypto.getRandomValues(aleatoire)
  return Array.from(aleatoire, (n) => alphabet[n % alphabet.length]).join('')
}

/* Appel à la route serveur, avec le jeton de l'admin connecté */
async function appelerApi(methode, corps) {
  const { data: { session } } = await createClient().auth.getSession()
  const res = await fetch('/api/admin/collaborateurs', {
    method: methode,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: corps ? JSON.stringify(corps) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Erreur du serveur, réessaie.')
  return json
}

const FORM_VIDE = {
  mode: 'nouveau', // 'nouveau' | 'existant'
  role: '',
  prenom: '', nom: '', username: '', telephone: '', motDePasse: '',
  identifiant: '',
}

export default function Collaborateurs() {
  const [collabs, setCollabs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'err', texte }

  const [formOuvert, setFormOuvert] = useState(false)
  const [form, setForm] = useState(FORM_VIDE)
  const [erreurForm, setErreurForm] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [identifiantsCrees, setIdentifiantsCrees] = useState(null) // à transmettre au collaborateur
  const [copie, setCopie] = useState(false)

  const [mdpPour, setMdpPour] = useState(null) // id du collaborateur dont on change le mot de passe
  const [nouveauMdp, setNouveauMdp] = useState('')

  const charger = async () => {
    setChargement(true)
    try {
      const { collaborateurs } = await appelerApi('GET')
      setCollabs(collaborateurs)
    } catch (e) {
      setMessage({ type: 'err', texte: e.message })
    }
    setChargement(false)
  }

  useEffect(() => { charger() }, [])

  const changer = (cle, valeur) => setForm({ ...form, [cle]: valeur })

  const ouvrirForm = () => {
    setForm(FORM_VIDE)
    setErreurForm('')
    setIdentifiantsCrees(null)
    setMessage(null)
    setFormOuvert(true)
  }

  /* ── Vérifications à l'écran (le serveur revérifie tout) ── */
  const verifierForm = () => {
    if (!form.role) return 'Choisis le type de collaborateur.'
    if (form.mode === 'existant') {
      return form.identifiant.trim() ? '' : 'Indique le nom d\u2019utilisateur ou le téléphone du compte.'
    }
    if (!form.prenom.trim()) return 'Le prénom est obligatoire.'
    if (!usernameValide(form.username)) return MESSAGE_USERNAME
    if (!telephoneValide(form.telephone)) return 'Téléphone au format international, avec l\u2019indicatif : +269…, +86…'
    if (form.motDePasse.length < MDP_MIN) return `Mot de passe : au moins ${MDP_MIN} caractères (bouton « Générer » si besoin).`
    return ''
  }

  const envoyerForm = async () => {
    const probleme = verifierForm()
    if (probleme) { setErreurForm(probleme); return }

    setOccupe(true)
    setErreurForm('')
    try {
      const res = await appelerApi('POST', form)
      if (form.mode === 'nouveau') {
        // On garde les identifiants UNE fois, pour les transmettre au collaborateur
        setIdentifiantsCrees({
          prenom: form.prenom.trim(),
          username: form.username.trim().toLowerCase().replace(/^@/, ''),
          motDePasse: form.motDePasse,
          espace: form.role === 'collab_etranger' ? '/espace/etranger' : '/espace/comores',
        })
      } else {
        setFormOuvert(false)
      }
      setMessage({ type: 'ok', texte: res.message })
      charger()
    } catch (e) {
      setErreurForm(e.message)
    }
    setOccupe(false)
  }

  const copierIdentifiants = async () => {
    const i = identifiantsCrees
    const texte =
      `Bonjour ${i.prenom}, voici tes accès Salut Marketplace :\n` +
      `• Site : ${window.location.origin}/login\n` +
      `• Identifiant : ${i.username}\n` +
      `• Mot de passe : ${i.motDePasse}\n` +
      `Après connexion, tu arrives directement dans ton espace.`
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      window.prompt('Copie ce texte :', texte)
    }
  }

  /* ── Actions sur un collaborateur ── */
  const agir = async (corps, confirmation) => {
    if (confirmation && !window.confirm(confirmation)) return
    setOccupe(true)
    setMessage(null)
    try {
      const res = await appelerApi('PATCH', corps)
      setMessage({ type: 'ok', texte: res.message })
      setMdpPour(null)
      setNouveauMdp('')
      charger()
    } catch (e) {
      setMessage({ type: 'err', texte: e.message })
    }
    setOccupe(false)
  }

  const changerEspace = (c) => {
    const autre = c.role === 'collab_etranger' ? 'collab_comores' : 'collab_etranger'
    agir(
      { id: c.id, action: 'role', role: autre },
      `Passer ${c.prenom} dans l'espace « ${ROLES[autre].label} » ?`
    )
  }

  const retirerAcces = (c) =>
    agir(
      { id: c.id, action: 'role', role: 'client' },
      `Retirer l'accès collaborateur de ${c.prenom} ?\n\nSon compte reste actif comme simple client, ` +
      'et ses envois passés restent dans l\u2019historique.'
    )

  const validerMdp = (c) => {
    if (nouveauMdp.length < MDP_MIN) {
      setMessage({ type: 'err', texte: `Le mot de passe doit faire au moins ${MDP_MIN} caractères.` })
      return
    }
    agir({ id: c.id, action: 'mot_de_passe', motDePasse: nouveauMdp })
  }

  return (
    <section aria-labelledby="titre-collabs">
      <style href="admin-collabs" precedence="default">{css}</style>

      <div className="page-head">
        <div>
          <h1 id="titre-collabs" className="page-title">Collaborateurs</h1>
          <p className="page-sub">Les personnes qui achètent à l&apos;étranger et réceptionnent aux Comores</p>
        </div>
        {!formOuvert && (
          <button onClick={ouvrirForm} className="btn-primary"><Icone icone={Plus} taille={18} /> Ajouter un collaborateur</button>
        )}
      </div>

      {message && <p role={message.type === 'err' ? 'alert' : 'status'} className={message.type === 'err' ? 'err' : 'co-ok'}>{message.texte}</p>}

      {/* ════════ FORMULAIRE D'AJOUT ════════ */}
      {formOuvert && (
        <div className="co-panel">
          {identifiantsCrees ? (
            /* ── Écran de fin : identifiants à transmettre ── */
            <div>
              <h2 className="co-panel-titre">Compte créé</h2>
              <p className="co-texte">
                Transmets ces identifiants à {identifiantsCrees.prenom} (par WhatsApp par exemple).
                <b> Le mot de passe ne sera plus affiché ensuite.</b>
              </p>
              <dl className="co-identifiants">
                <div><dt>Identifiant</dt><dd>{identifiantsCrees.username}</dd></div>
                <div><dt>Mot de passe</dt><dd>{identifiantsCrees.motDePasse}</dd></div>
                <div><dt>Son espace</dt><dd>{identifiantsCrees.espace}</dd></div>
              </dl>
              <div className="co-actions">
                <button onClick={copierIdentifiants} className="btn-primary">{copie ? <><Icone icone={Check} taille={18} /> Copié</> : <><Icone icone={Copy} taille={18} /> Copier le message</>}</button>
                <button onClick={() => setFormOuvert(false)} className="btn-secondary">Terminé</button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="co-panel-titre">Nouveau collaborateur</h2>

              {/* 1. Type */}
              <span className="label">Il travaille…</span>
              <div className="co-roles" role="group" aria-label="Type de collaborateur">
                {Object.entries(ROLES).map(([id, r]) => (
                  <button key={id} onClick={() => changer('role', id)} aria-pressed={form.role === id}
                    className={`co-role ${form.role === id ? 'co-role-on' : ''}`}>
                    <span className="co-role-icone"><Icone icone={r.icone} taille={24} /></span>
                    <b>{r.label}</b>
                    <span>{r.detail}</span>
                  </button>
                ))}
              </div>

              {/* 2. Nouveau compte ou compte existant */}
              <div className="co-mode" role="group" aria-label="Type de compte">
                {[
                  { id: 'nouveau', label: 'Créer un compte' },
                  { id: 'existant', label: 'Il a déjà un compte' },
                ].map((m) => (
                  <button key={m.id} onClick={() => changer('mode', m.id)} aria-pressed={form.mode === m.id}
                    className={`co-mode-btn ${form.mode === m.id ? 'co-mode-on' : ''}`}>
                    {m.label}
                  </button>
                ))}
              </div>

              {form.mode === 'existant' ? (
                <div className="field">
                  <label className="label" htmlFor="co-identifiant">Nom d&apos;utilisateur ou téléphone de son compte</label>
                  <input id="co-identifiant" className="input" value={form.identifiant} autoCapitalize="none"
                    onChange={(e) => changer('identifiant', e.target.value)} placeholder="said_m ou +2693334455" />
                </div>
              ) : (
                <>
                  <div className="row">
                    <div className="field">
                      <label className="label" htmlFor="co-prenom">Prénom</label>
                      <input id="co-prenom" className="input" value={form.prenom}
                        onChange={(e) => changer('prenom', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="co-nom">Nom <span className="optional">— facultatif</span></label>
                      <input id="co-nom" className="input" value={form.nom}
                        onChange={(e) => changer('nom', e.target.value)} />
                    </div>
                  </div>
                  <div className="row">
                    <div className="field">
                      <label className="label" htmlFor="co-username">Nom d&apos;utilisateur</label>
                      <input id="co-username" className="input" value={form.username} autoCapitalize="none"
                        onChange={(e) => changer('username', e.target.value)} placeholder="said_m" />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="co-tel">Téléphone <span className="optional">— avec l&apos;indicatif</span></label>
                      <input id="co-tel" className="input" inputMode="tel" value={form.telephone}
                        onChange={(e) => changer('telephone', e.target.value)} placeholder="+269 333 44 55" />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="co-mdp">Mot de passe provisoire</label>
                    <div className="co-mdp">
                      <input id="co-mdp" className="input" value={form.motDePasse} autoComplete="new-password"
                        onChange={(e) => changer('motDePasse', e.target.value)} placeholder={`${MDP_MIN} caractères minimum`} />
                      <button onClick={() => changer('motDePasse', genererMotDePasse())} className="btn-secondary">Générer</button>
                    </div>
                  </div>
                </>
              )}

              {erreurForm && <p role="alert" className="err">{erreurForm}</p>}

              <div className="co-actions">
                <button onClick={() => setFormOuvert(false)} disabled={occupe} className="btn-secondary">Annuler</button>
                <button onClick={envoyerForm} disabled={occupe} className="btn-primary">
                  {occupe ? 'Patiente…' : form.mode === 'existant' ? 'Donner l\u2019accès' : 'Créer le compte'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════ LISTE ════════ */}
      {chargement ? (
        <ChargementListe nb={3} hauteur={88} />
      ) : collabs.length === 0 ? (
        <EtatVide icone={Users} texte="Aucun collaborateur pour l'instant." action={{ label: 'Ajouter un collaborateur', onClick: ouvrirForm }} />
      ) : (
        <ul className="co-liste">
          {collabs.map((c) => {
            const r = ROLES[c.role]
            return (
              <li key={c.id} className="co-ligne">
                <div className="co-ligne-haut">
                  <span className="co-avatar" aria-hidden="true">{(c.prenom || '?')[0].toUpperCase()}</span>
                  <div className="co-infos">
                    <b>{c.prenom} {c.nom || ''}</b>
                    <span>@{c.username} · {c.telephone}</span>
                  </div>
                  <Badge ton={c.role === 'collab_comores' ? 'vert' : 'bleu'}>{r?.label}</Badge>
                </div>

                {mdpPour === c.id ? (
                  <div className="co-mdp co-mdp-ligne">
                    <input className="input" value={nouveauMdp} aria-label={`Nouveau mot de passe de ${c.prenom}`}
                      onChange={(e) => setNouveauMdp(e.target.value)} placeholder={`${MDP_MIN} caractères minimum`} />
                    <button onClick={() => setNouveauMdp(genererMotDePasse())} className="btn-secondary">Générer</button>
                    <button onClick={() => validerMdp(c)} disabled={occupe} className="btn-primary">Valider</button>
                    <button onClick={() => { setMdpPour(null); setNouveauMdp('') }} className="btn-secondary">Annuler</button>
                  </div>
                ) : (
                  <div className="co-ligne-actions">
                    <button onClick={() => changerEspace(c)} disabled={occupe} className="co-btn"><Icone icone={ArrowLeftRight} taille={18} /> Changer d&apos;espace</button>
                    <button onClick={() => { setMdpPour(c.id); setNouveauMdp('') }} disabled={occupe} className="co-btn"><Icone icone={KeyRound} taille={18} /> Nouveau mot de passe</button>
                    <button onClick={() => retirerAcces(c)} disabled={occupe} className="co-btn co-btn-danger">Retirer l&apos;accès</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ─────────── CSS (préfixe co-) ─────────── */
const css = `
  .co-ok {
    font-size: 15px; color: #2c6e4d; background: #e6f3ec; border: 1px solid #cde5d8;
    border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; font-weight: 600;
  }

  .co-panel { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .co-panel-titre { font-size: 18px; font-weight: 800; margin: 0 0 16px; }
  .co-texte { font-size: 15px; color: ${C.inkSoft}; line-height: 1.5; margin: 0 0 16px; }
  .co-texte b { color: ${C.inkDeep}; }

  .co-roles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .co-role {
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;
    background: ${C.white}; border: 1.5px solid ${C.line}; border-radius: 8px; padding: 16px;
    cursor: pointer; font-family: inherit; color: ${C.inkDeep};
  }
  .co-role b { font-size: 15px; }
  .co-role span { font-size: 14px; color: ${C.inkSoft}; }
  .co-role .co-role-icone { margin-bottom: 4px; color: ${C.ink}; display: flex; }
  .co-role-on { border-color: ${C.ink}; box-shadow: inset 0 0 0 1px ${C.ink}; }

  .co-mode { display: flex; background: ${C.sand}; border-radius: 8px; padding: 4px; gap: 4px; margin-bottom: 16px; }
  .co-mode-btn {
    flex: 1; border: none; background: none; cursor: pointer; font-family: inherit;
    font-size: 15px; font-weight: 700; color: ${C.inkSoft}; min-height: 44px; padding: 0 8px; border-radius: 6px;
  }
  .co-mode-on { background: ${C.white}; color: ${C.inkDeep}; }

  .co-mdp { display: flex; gap: 8px; }
  .co-mdp .input { flex: 1; font-family: ui-monospace, monospace; }
  .co-mdp-ligne { flex-wrap: wrap; margin-top: 10px; }
  .co-mdp-ligne .input { min-width: 180px; }

  .co-actions { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; margin-top: 4px; }

  .co-identifiants {
    background: ${C.sand}; border-radius: 8px; padding: 16px; margin: 0 0 16px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .co-identifiants dt { font-size: 14px; color: ${C.inkSoft}; font-weight: 600; }
  .co-identifiants dd { margin: 2px 0 0; font-size: 16px; font-weight: 800; font-family: ui-monospace, monospace; word-break: break-all; }

  .co-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .co-ligne { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; }
  .co-ligne-haut { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .co-avatar {
    width: 44px; height: 44px; border-radius: 50%; background: ${C.ink}; color: ${C.white};
    display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0;
  }
  .co-infos { flex: 1; min-width: 150px; display: flex; flex-direction: column; gap: 2px; }
  .co-infos b { font-size: 16px; }
  .co-infos span { font-size: 14px; color: ${C.inkSoft}; }

  .co-ligne-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .co-btn {
    background: ${C.white}; border: 1.5px solid ${C.line}; cursor: pointer; font-family: inherit;
    font-size: 15px; font-weight: 700; color: ${C.inkDeep}; min-height: 44px; padding: 0 16px; border-radius: 8px;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .co-btn:hover:not(:disabled) { border-color: ${C.inkSoft}; }
  .co-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .co-btn-danger { color: ${C.clay}; }
  .co-btn-danger:hover:not(:disabled) { background: #fbf0ee; border-color: #e9c9c4; }

  @media (max-width: 560px) {
    .co-roles { grid-template-columns: 1fr; }
  }
`