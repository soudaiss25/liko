/* ─────────── components/ui/EtatVide.js ───────────
   État "rien à afficher" : une phrase + l'action utile.

   <EtatVide icone={Package} texte="Aucune commande pour le moment." action={{ label: 'Voir le catalogue', href: '/' }} />
   <EtatVide texte="Aucun résultat." action={{ label: 'Tout afficher', onClick: reinitialiser }} />
*/

import Icone from '@/components/ui/Icone'
import Bouton from '@/components/ui/Bouton'

export default function EtatVide({ icone, texte, action }) {
  return (
    <div className="ui-vide">
      {icone && <Icone icone={icone} taille={32} />}
      <p>{texte}</p>
      {action && <Bouton variante="secondaire" href={action.href} onClick={action.onClick}>{action.label}</Bouton>}
    </div>
  )
}

/* État "ça n'a pas marché" : message clair + comment réessayer */
export function EtatErreur({ texte = 'Impossible de charger les données.', onReessayer }) {
  return (
    <div className="ui-vide" role="alert">
      <p>{texte}</p>
      {onReessayer && <Bouton variante="secondaire" onClick={onReessayer}>Réessayer</Bouton>}
    </div>
  )
}
