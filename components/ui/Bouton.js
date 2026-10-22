/* ─────────── components/ui/Bouton.js ───────────
   Les boutons du site. Règle : UN seul bouton "achat" (or) par écran.

   variante :
     'achat'      → or : ajouter au panier, commander (l'action principale côté client)
     'principal'  → bleu pétrole : l'action principale dans l'admin et les espaces
     'secondaire' → contour (par défaut)
     'danger'     → contour rouge brique : supprimer, annuler
     'texte'      → lien discret
   Avec `href`, c'est un lien ; sinon un bouton. `grand` = pleine largeur, 52 px.
*/

export default function Bouton({ variante = 'secondaire', grand = false, href, className = '', children, ...reste }) {
  const classes = `ui-btn ui-btn-${variante} ${grand ? 'ui-btn-grand' : ''} ${className}`.trim()
  if (href) return <a href={href} className={classes} {...reste}>{children}</a>
  return <button type="button" className={classes} {...reste}>{children}</button>
}
