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

import { createClient } from '@/lib/supabase-browser'
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
        <div className="state">Vérification de l'accès…</div>
      </div>
    )
  }

  if (etat === 'refuse') {
    return (
      <div className="app">
        <style>{css}</style>
        <div className="refuse-box">
          <div className="refuse-emoji">🔒</div>
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
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; }

  .app {
    background: ${C.bgGrey}; min-height: 100vh;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: ${C.inkDeep};
  }
  .state { text-align: center; padding: 90px 20px; color: ${C.inkSoft}; font-size: 15px; }
  .visually-hidden {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }

  .refuse-box { max-width: 420px; margin: 90px auto; text-align: center; padding: 20px; }
  .refuse-emoji { font-size: 48px; margin-bottom: 12px; }
  .refuse-title { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
  .refuse-sub { font-size: 14px; color: ${C.inkSoft}; margin: 0 0 22px; line-height: 1.5; }

  /* ── Barre du haut ── */
  .esp-header { background: ${C.inkDeep}; position: sticky; top: 0; z-index: 30; }
  .esp-header-inner {
    max-width: 900px; margin: 0 auto; padding: 12px 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .esp-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .esp-logo { width: 38px; height: 38px; object-fit: contain; background: #fff; border-radius: 8px; padding: 3px; }
  .esp-title { font-size: 15px; font-weight: 800; color: #fff; }
  .esp-sub { font-size: 12px; color: rgba(255,255,255,0.65); }
  .esp-logout {
    background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer;
    padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: inherit;
  }
  .esp-test {
    background: ${C.gold}; color: ${C.inkDeep}; font-size: 12.5px; font-weight: 600;
    text-align: center; padding: 6px 12px;
  }
  .esp-test a { color: ${C.inkDeep}; font-weight: 800; }

  .wrap { max-width: 900px; margin: 0 auto; padding: 18px 16px 60px; }

  /* ── En-têtes de section ── */
  .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .page-title { font-size: 21px; font-weight: 800; margin: 0; }
  .page-sub { font-size: 13px; color: ${C.inkSoft}; margin: 4px 0 0; }

  /* ── Boutons (zones de pouce : 44 px de haut minimum) ── */
  .btn-primary, .btn-secondary, .btn-danger {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 46px; padding: 0 18px; border-radius: 10px; cursor: pointer;
    font-size: 14px; font-weight: 700; font-family: inherit; text-decoration: none; white-space: nowrap;
  }
  .btn-primary { background: ${C.ink}; color: #fff; border: none; }
  .btn-primary:hover { background: ${C.inkDeep}; }
  .btn-primary:disabled { background: ${C.line}; color: #A9B4B9; cursor: not-allowed; }
  .btn-secondary { background: #fff; color: ${C.inkDeep}; border: 1.5px solid ${C.line}; }
  .btn-secondary:hover { border-color: ${C.inkSoft}; }
  .btn-danger { background: #fff; color: ${C.clay}; border: 1.5px solid #F0D9D5; }
  .btn-danger:hover { background: #FDECEB; }
  .btn-large { width: 100%; min-height: 52px; font-size: 15px; }

  /* ── Onglets segmentés ── */
  .segment { display: flex; background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 3px; gap: 2px; margin-bottom: 16px; }
  .seg {
    flex: 1; border: none; background: none; cursor: pointer; font-family: inherit;
    font-size: 13.5px; font-weight: 700; color: ${C.inkSoft}; padding: 10px 6px; border-radius: 9px; white-space: nowrap;
  }
  .seg-on { background: ${C.ink}; color: #fff; }
  .seg-nb { font-size: 11.5px; opacity: 0.8; margin-left: 3px; }

  /* ── Champs ── */
  .field { margin-bottom: 14px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 7px; }
  .hint { font-weight: 500; color: ${C.inkSoft}; font-size: 11.5px; }
  .input {
    width: 100%; height: 48px; padding: 0 14px; border-radius: 10px;
    border: 1.5px solid ${C.line}; background: ${C.sand};
    font-size: 16px; font-family: inherit; color: ${C.inkDeep}; outline: none;
  }
  .input:focus { border-color: ${C.ink}; background: #fff; }
  .textarea { height: auto; padding: 12px 14px; resize: vertical; }

  /* ── Cartes et badges ── */
  .carte { background: #fff; border: 1px solid ${C.line}; border-radius: 14px; padding: 16px; margin-bottom: 12px; }
  .carte-titre { font-size: 15px; font-weight: 800; margin: 0 0 12px; }
  .badge { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 4px 9px; border-radius: 20px; white-space: nowrap; }
  .badge-gris { background: #EDEFF1; color: ${C.inkSoft}; }
  .badge-or { background: #FFF1D6; color: ${C.goldDeep}; }
  .badge-vert { background: #E8F5EE; color: ${C.leaf}; }
  .badge-rouge { background: #FBF0EE; color: ${C.clay}; }

  .vide { text-align: center; padding: 44px 16px; color: ${C.inkSoft}; font-size: 14px; }
  .vide-emoji { font-size: 40px; margin-bottom: 8px; }

  .err {
    font-size: 13.5px; color: ${C.clay}; background: #FBF0EE; border: 1px solid #F0D9D5;
    border-radius: 10px; padding: 11px 13px; margin: 0 0 14px; line-height: 1.45;
  }
  .ok {
    font-size: 13.5px; color: ${C.leaf}; background: #E8F5EE; border: 1px solid #CDE8D8;
    border-radius: 10px; padding: 11px 13px; margin: 0 0 14px; font-weight: 600;
  }

  button:focus-visible, a:focus-visible, .input:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }

  @media (max-width: 560px) {
    .row { grid-template-columns: 1fr; }
    .esp-sub { display: none; }
  }
`