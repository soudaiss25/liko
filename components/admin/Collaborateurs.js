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
import { createClient } from '@/lib/supabase-browser'

import { C } from '@/lib/theme'
const ROLES = {
  collab_etranger: { icone: '🌍', label: 'À l\u2019étranger', detail: 'Prépare et expédie les envois' },
  collab_comores: { icone: '🇰🇲', label: 'Aux Comores', detail: 'Réceptionne les colis, gère le stock' },
}

const MDP_MIN = 8

/* Mêmes règles que le serveur, pour répondre tout de suite à l'écran */
const telephoneValide = (t) => /^\+\d{8,15}$/.test(String(t).replace(/[\s.\-()]/g, ''))
const usernameValide = (u) => /^[a-z0-9_.]{3,20}$/.test(String(u).trim().toLowerCase().replace(/^@/, ''))

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
    if (!usernameValide(form.username)) return 'Nom d\u2019utilisateur : 3 à 20 caractères (lettres, chiffres, _ ou .).'
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
          <p className="page-sub">Les personnes qui achètent à l'étranger et réceptionnent aux Comores</p>
        </div>
        {!formOuvert && (
          <button onClick={ouvrirForm} className="btn-primary">+ Ajouter un collaborateur</button>
        )}
      </div>

      {message && <p role={message.type === 'err' ? 'alert' : 'status'} className={message.type === 'err' ? 'err' : 'co-ok'}>{message.texte}</p>}

      {/* ════════ FORMULAIRE D'AJOUT ════════ */}
      {formOuvert && (
        <div className="co-panel">
          {identifiantsCrees ? (
            /* ── Écran de fin : identifiants à transmettre ── */
            <div>
              <h2 className="co-panel-titre">✓ Compte créé</h2>
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
                <button onClick={copierIdentifiants} className="btn-primary">{copie ? '✓ Copié' : '📋 Copier le message'}</button>
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
                    <span className="co-role-icone" aria-hidden="true">{r.icone}</span>
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
                  <label className="label" htmlFor="co-identifiant">Nom d'utilisateur ou téléphone de son compte</label>
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
                      <label className="label" htmlFor="co-username">Nom d'utilisateur</label>
                      <input id="co-username" className="input" value={form.username} autoCapitalize="none"
                        onChange={(e) => changer('username', e.target.value)} placeholder="said_m" />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="co-tel">Téléphone <span className="optional">— avec l'indicatif</span></label>
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
        <div className="state">Chargement…</div>
      ) : collabs.length === 0 ? (
        <div className="co-vide">
          <div className="co-vide-emoji">🤝</div>
          Aucun collaborateur pour l'instant.
        </div>
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
                  <span className={`co-badge ${c.role === 'collab_comores' ? 'co-badge-vert' : 'co-badge-bleu'}`}>
                    {r?.icone} {r?.label}
                  </span>
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
                    <button onClick={() => changerEspace(c)} disabled={occupe} className="co-btn">⇄ Changer d'espace</button>
                    <button onClick={() => { setMdpPour(c.id); setNouveauMdp('') }} disabled={occupe} className="co-btn">🔑 Nouveau mot de passe</button>
                    <button onClick={() => retirerAcces(c)} disabled={occupe} className="co-btn co-btn-danger">Retirer l'accès</button>
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
    font-size: 13.5px; color: ${C.leaf}; background: #E8F5EE; border: 1px solid #CDE8D8;
    border-radius: 10px; padding: 11px 13px; margin: 0 0 14px; font-weight: 600;
  }

  .co-panel { background: #fff; border: 1px solid ${C.line}; border-radius: 16px; padding: 20px; margin-bottom: 18px; }
  .co-panel-titre { font-size: 17px; font-weight: 800; margin: 0 0 14px; }
  .co-texte { font-size: 13.5px; color: ${C.inkSoft}; line-height: 1.5; margin: 0 0 14px; }
  .co-texte b { color: ${C.inkDeep}; }

  .co-roles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .co-role {
    display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left;
    background: #fff; border: 2px solid ${C.line}; border-radius: 12px; padding: 14px;
    cursor: pointer; font-family: inherit; color: ${C.inkDeep};
  }
  .co-role b { font-size: 14px; }
  .co-role span { font-size: 12px; color: ${C.inkSoft}; }
  .co-role-icone { font-size: 22px !important; margin-bottom: 2px; }
  .co-role-on { border-color: ${C.ink}; background: #E7EFF2; }

  .co-mode { display: flex; background: ${C.sand}; border-radius: 10px; padding: 3px; gap: 2px; margin-bottom: 16px; }
  .co-mode-btn {
    flex: 1; border: none; background: none; cursor: pointer; font-family: inherit;
    font-size: 13px; font-weight: 700; color: ${C.inkSoft}; padding: 9px; border-radius: 8px;
  }
  .co-mode-on { background: #fff; color: ${C.inkDeep}; box-shadow: 0 1px 3px rgba(20,58,75,0.12); }

  .co-mdp { display: flex; gap: 8px; }
  .co-mdp .input { flex: 1; font-family: ui-monospace, monospace; }
  .co-mdp-ligne { flex-wrap: wrap; margin-top: 10px; }
  .co-mdp-ligne .input { min-width: 180px; }

  .co-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-top: 4px; }

  .co-identifiants {
    background: ${C.sand}; border-radius: 12px; padding: 14px; margin: 0 0 14px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .co-identifiants dt { font-size: 11.5px; color: ${C.inkSoft}; font-weight: 600; }
  .co-identifiants dd { margin: 2px 0 0; font-size: 16px; font-weight: 800; font-family: ui-monospace, monospace; word-break: break-all; }

  .co-vide { text-align: center; padding: 44px 16px; color: ${C.inkSoft}; font-size: 14px; }
  .co-vide-emoji { font-size: 40px; margin-bottom: 8px; }

  .co-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .co-ligne { background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 14px; }
  .co-ligne-haut { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .co-avatar {
    width: 42px; height: 42px; border-radius: 50%; background: ${C.ink}; color: #fff;
    display: flex; align-items: center; justify-content: center; font-weight: 800; flex-shrink: 0;
  }
  .co-infos { flex: 1; min-width: 150px; display: flex; flex-direction: column; gap: 2px; }
  .co-infos b { font-size: 14.5px; }
  .co-infos span { font-size: 12.5px; color: ${C.inkSoft}; }
  .co-badge { font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 20px; white-space: nowrap; }
  .co-badge-bleu { background: #E7EFF2; color: ${C.ink}; }
  .co-badge-vert { background: #E8F5EE; color: ${C.leaf}; }

  .co-ligne-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .co-btn {
    background: ${C.sand}; border: none; cursor: pointer; font-family: inherit;
    font-size: 12.5px; font-weight: 700; color: ${C.inkDeep}; padding: 9px 12px; border-radius: 8px;
  }
  .co-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .co-btn-danger { color: ${C.clay}; }
  .co-btn-danger:hover { background: #FDECEB; }

  @media (max-width: 560px) {
    .co-roles { grid-template-columns: 1fr; }
  }
`