'use client'

/* ─────────── components/espace/CadreEspace.js ───────────
   Le "cadre" commun aux espaces collaborateurs :
   - vérifie l'accès (via lib/garde.js : login redemandé si besoin)
   - affiche la barre du haut (nom, déconnexion)
   - fournit le style de base (boutons, champs, cartes, badges…)

   Le contenu de la page (children) n'est affiché QU'APRÈS la vérification :
   il ne charge donc jamais de données pour quelqu'un qui n'a pas le droit.

   Utilisation :
     <CadreEspace rolesAutorises={['collab_comores']} titre="Espace Comores">
       <MonContenu />
     </CadreEspace>

   L'admin a accès à tous les espaces (pratique pour tester).
*/

import { Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import Icone from '@/components/ui/Icone'
import { ChargementListe } from '@/components/ui/Squelette'
import { useGardeAcces } from '@/lib/garde'

import { C } from '@/lib/theme'
export default function CadreEspace({ rolesAutorises, titre, children }) {
  const { etat, profil } = useGardeAcces(rolesAutorises)

  const deconnexion = async () => {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  if (etat === 'verification') {
    return (
      <div className="app">
        <style>{css}</style>
        <div className="state"><ChargementListe nb={2} hauteur={72} /></div>
      </div>
    )
  }

  if (etat === 'refuse') {
    return (
      <div className="app">
        <style>{css}</style>
        <div className="refuse-box">
          <div className="refuse-emoji"><Icone icone={Lock} taille={32} /></div>
          <h1 className="refuse-title">Accès réservé</h1>
          <p className="refuse-sub">
            Ton compte n'a pas accès à cet espace. Si c'est une erreur, contacte l'administrateur.
          </p>
          <a href="/" className="btn-primary">Retour à l'accueil</a>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <style>{css}</style>

      <header className="esp-header">
        <div className="esp-header-inner">
          <div className="esp-brand">
            <img src="/logo.png" alt="Salut" className="esp-logo" />
            <div>
              <div className="esp-title">{titre}</div>
              <div className="esp-sub">Bonjour {profil?.prenom || 'collaborateur'}</div>
            </div>
          </div>
          <button onClick={deconnexion} className="esp-logout">Déconnexion</button>
        </div>
        {profil?.role === 'admin' && (
          <div className="esp-test">
            Mode test : tu vois cet espace en tant qu'admin. <a href="/admin">Retour à l'admin</a>
          </div>
        )}
      </header>

      <main className="wrap">{children}</main>
    </div>
  )
}

/* ─────────── CSS de base, partagé par tous les espaces collaborateurs ─────────── */
const css = `
  * { box-sizing: border-box; }

  .app {
    background: ${C.bgGrey}; min-height: 100vh;
    font-family: var(--font-jakarta), system-ui, sans-serif; color: ${C.inkDeep};
  }
  .state { padding: 24px 16px; max-width: 900px; margin: 0 auto; color: ${C.inkSoft}; font-size: 15px; }

  .refuse-box { max-width: 420px; margin: 64px auto; text-align: center; padding: 16px; color: ${C.inkSoft}; }
  .refuse-emoji { margin-bottom: 16px; }
  .refuse-title { font-size: 24px; font-weight: 800; margin: 0 0 8px; color: ${C.inkDeep}; }
  .refuse-sub { font-size: 16px; color: ${C.inkSoft}; margin: 0 0 24px; line-height: 1.5; }

  /* ── Barre du haut ── */
  .esp-header { background: ${C.inkDeep}; position: sticky; top: 0; z-index: 30; }
  .esp-header-inner {
    max-width: 900px; margin: 0 auto; padding: 8px 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .esp-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .esp-logo { width: 40px; height: 40px; object-fit: contain; background: ${C.white}; border-radius: 8px; padding: 4px; flex-shrink: 0; }
  .esp-title { font-size: 16px; font-weight: 800; color: ${C.white}; }
  .esp-sub { font-size: 14px; color: rgba(255,255,255,0.75); }
  .esp-logout {
    background: rgba(255,255,255,0.12); border: none; color: ${C.white}; cursor: pointer;
    min-height: 44px; padding: 0 16px; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: inherit;
  }
  .esp-logout:hover { background: rgba(255,255,255,0.2); }
  .esp-test {
    background: ${C.white}; color: ${C.inkDeep}; font-size: 14px; font-weight: 600;
    text-align: center; padding: 8px 16px; border-top: 1px solid ${C.line};
  }
  .esp-test a { color: ${C.ink}; font-weight: 800; }

  .wrap { max-width: 900px; margin: 0 auto; padding: 16px 16px 64px; }

  /* ── En-têtes de section ── */
  .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .page-title { font-size: 24px; font-weight: 800; margin: 0; }
  .page-sub { font-size: 15px; color: ${C.inkSoft}; margin: 4px 0 0; }

  /* ── Boutons (zones de pouce : 44 px de haut minimum) ── */
  .btn-primary, .btn-secondary, .btn-danger {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 44px; padding: 0 16px; border-radius: 8px; cursor: pointer;
    font-size: 15px; font-weight: 700; font-family: inherit; text-decoration: none; white-space: nowrap;
  }
  .btn-primary { background: ${C.ink}; color: ${C.white}; border: none; }
  .btn-primary:hover { background: ${C.inkDeep}; }
  .btn-primary:disabled { background: ${C.line}; color: ${C.inkSoft}; cursor: not-allowed; }
  .btn-secondary { background: ${C.white}; color: ${C.inkDeep}; border: 1.5px solid ${C.line}; }
  .btn-secondary:hover { border-color: ${C.inkSoft}; }
  .btn-danger { background: ${C.white}; color: ${C.clay}; border: 1.5px solid #e9c9c4; }
  .btn-danger:hover { background: #fbf0ee; }
  .btn-secondary:disabled, .btn-danger:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn-large { width: 100%; min-height: 52px; font-size: 16px; }

  /* ── Onglets segmentés ── */
  .segment { display: flex; background: ${C.white}; border: 1px solid ${C.line}; border-radius: 8px; padding: 4px; gap: 4px; margin-bottom: 16px; }
  .seg {
    flex: 1; border: none; background: none; cursor: pointer; font-family: inherit;
    font-size: 15px; font-weight: 700; color: ${C.inkSoft}; min-height: 44px; padding: 0 8px; border-radius: 6px; white-space: nowrap;
  }
  .seg-on { background: ${C.ink}; color: ${C.white}; }
  .seg-nb { font-size: 14px; opacity: 0.85; margin-left: 4px; }

  /* ── Champs ── */
  .field { margin-bottom: 16px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .label { display: block; font-size: 15px; font-weight: 700; margin-bottom: 8px; }
  .hint { font-weight: 500; color: ${C.inkSoft}; font-size: 14px; }
  .input {
    width: 100%; min-height: 48px; padding: 0 16px; border-radius: 8px;
    border: 1.5px solid ${C.line}; background: ${C.sand};
    font-size: 16px; font-family: inherit; color: ${C.inkDeep}; outline: none;
  }
  .input:focus { border-color: ${C.ink}; background: ${C.white}; }
  .textarea { height: auto; padding: 12px 16px; resize: vertical; }

  /* ── Cartes et badges ── */
  .carte { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .carte-titre { font-size: 18px; font-weight: 800; margin: 0 0 12px; }
  .badge { display: inline-block; font-size: 13px; font-weight: 700; padding: 3px 8px; border-radius: 6px; white-space: nowrap; }
  .badge-gris { background: #edeff1; color: #55707d; }
  .badge-bleu { background: #e3eef3; color: ${C.ink}; }
  .badge-or { background: #fbf0d9; color: #8a5a0b; }
  .badge-vert { background: #e6f3ec; color: #2c6e4d; }
  .badge-rouge { background: #fbeceb; color: #a8453a; }

  .vide { text-align: center; padding: 48px 16px; color: ${C.inkSoft}; font-size: 15px; }
  .vide-emoji { margin-bottom: 8px; display: flex; justify-content: center; }

  .err {
    font-size: 15px; color: #a8453a; background: #fbf0ee; border: 1px solid #efd4cf;
    border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; line-height: 1.45;
  }
  .ok {
    font-size: 15px; color: #2c6e4d; background: #e6f3ec; border: 1px solid #cde5d8;
    border-radius: 8px; padding: 12px 16px; margin: 0 0 16px; font-weight: 600;
  }

  @media (max-width: 560px) {
    .row { grid-template-columns: 1fr; }
    .esp-sub { display: none; }
  }
`
