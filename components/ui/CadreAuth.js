/* ─────────── components/ui/CadreAuth.js ───────────
   Cadre commun des pages de connexion et d'inscription : logo, carte blanche, titre.

   <CadreAuth titre="Connexion" sous="Connecte-toi pour suivre tes commandes.">…</CadreAuth>
*/

import { NOM_BOUTIQUE } from '@/lib/config'

export default function CadreAuth({ titre, sous, children, liens }) {
  return (
    <main className="ui-auth">
      <a href="/" className="ui-auth-marque" aria-label={`${NOM_BOUTIQUE}, retour à l'accueil`}>
        <img src="/logo.png" alt="" />
        <span>Salut</span>
      </a>
      <div className="ui-auth-carte">
        <h1 className="ui-auth-titre">{titre}</h1>
        {sous && <p className="ui-auth-sous">{sous}</p>}
        {children}
      </div>
      {liens && <div className="ui-auth-liens">{liens}</div>}
    </main>
  )
}
