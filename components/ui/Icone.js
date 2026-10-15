/* ─────────── components/ui/Icone.js ───────────
   La SEULE façon d'afficher une icône sur le site (bibliothèque : lucide-react).
   Un style de trait unique : épaisseur 1.75, couleur héritée du texte.
   Tailles : 20 par défaut, 18 dans les petits boutons, 24 dans la barre du bas.

   Utilisation : <Icone icone={Search} />   <Icone icone={Home} taille={24} />
   Une icône est décorative (cachée aux lecteurs d'écran) : un bouton qui ne
   contient qu'une icône DOIT avoir un aria-label.
*/

export default function Icone({ icone: Composant, taille = 20, ...reste }) {
  return <Composant size={taille} strokeWidth={1.75} aria-hidden="true" focusable="false" {...reste} />
}
