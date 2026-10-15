/* ─────────── components/ui/Badge.js ───────────
   Petite étiquette de statut. Sobre : on n'en met que si elle apprend quelque chose.
   ton : 'gris' (par défaut) | 'bleu' | 'or' (à surveiller) | 'vert' | 'rouge'
*/

export default function Badge({ ton = 'gris', children }) {
  return <span className={`ui-badge ui-badge-${ton}`}>{children}</span>
}
