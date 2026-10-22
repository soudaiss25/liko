/* ─────────── components/ui/Squelette.js ───────────
   Zone grise qui remplace "Chargement…" : on voit où le contenu va arriver.

   <Squelette largeur="60%" hauteur={16} />
   <ChargementListe nb={4} hauteur={96} />   → plusieurs blocs, annoncés "Chargement" aux lecteurs d'écran
*/

export function Squelette({ largeur = '100%', hauteur = 16, rayon = 8, style }) {
  return <span className="ui-sk" aria-hidden="true" style={{ width: largeur, height: hauteur, borderRadius: rayon, ...style }} />
}

export function ChargementListe({ nb = 3, hauteur = 88 }) {
  return (
    <div role="status" aria-busy="true" className="ui-chargement">
      <span className="visually-hidden">Chargement…</span>
      {Array.from({ length: nb }, (_, i) => <Squelette key={i} hauteur={hauteur} rayon={12} />)}
    </div>
  )
}
