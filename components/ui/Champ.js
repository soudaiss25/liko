/* ─────────── components/ui/Champ.js ───────────
   Un champ de formulaire = label + aide + contenu + erreur, toujours dans le même ordre.
   Le label est relié au champ par `id` : mets le même id sur le <input>.

   <Champ id="prenom" label="Prénom" erreur={erreurs.prenom}>
     <input id="prenom" className="ui-input" value={…} onChange={…} aria-invalid={!!erreurs.prenom} />
   </Champ>
*/

export default function Champ({ id, label, aide, optionnel, erreur, children }) {
  return (
    <div className="ui-champ">
      <label htmlFor={id} className="ui-label">
        {label}{optionnel && <span className="ui-optionnel"> (facultatif)</span>}
      </label>
      {aide && <p className="ui-aide">{aide}</p>}
      {children}
      {erreur && <p className="ui-erreur-champ" role="alert">{erreur}</p>}
    </div>
  )
}

/* Message d'information, de succès ou d'erreur. ton : 'err' | 'ok' | 'info' */
export function Message({ ton = 'info', children }) {
  return <p role={ton === 'err' ? 'alert' : 'status'} className={`ui-msg ui-msg-${ton}`}>{children}</p>
}
