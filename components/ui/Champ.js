/* ─────────── components/ui/Champ.js ───────────
   Un champ de formulaire = label + aide + contenu + erreur, toujours dans le même ordre.
   Le label est relié au champ par `id` : mets le même id sur le <input>.
   L'aide a l'id `${id}-aide` et l'erreur l'id `${id}-erreur` : l'input doit recevoir
   aria-describedby avec ces ids, pour que les lecteurs d'écran les annoncent.

   <Champ id="prenom" label="Prénom" aide="Comme sur ta carte" erreur={erreurs.prenom}>
     <input id="prenom" className="ui-input" value={…} onChange={…}
       aria-invalid={!!erreurs.prenom}
       aria-describedby={erreurs.prenom ? 'prenom-erreur' : 'prenom-aide'} />
   </Champ>
*/

export default function Champ({ id, label, aide, optionnel, erreur, children }) {
  return (
    <div className="ui-champ">
      <label htmlFor={id} className="ui-label">
        {label}{optionnel && <span className="ui-optionnel"> (facultatif)</span>}
      </label>
      {aide && <p className="ui-aide" id={`${id}-aide`}>{aide}</p>}
      {children}
      {erreur && <p className="ui-erreur-champ" id={`${id}-erreur`} role="alert">{erreur}</p>}
    </div>
  )
}

/* Message d'information, de succès ou d'erreur. ton : 'err' | 'ok' | 'info' */
export function Message({ ton = 'info', children }) {
  return <p role={ton === 'err' ? 'alert' : 'status'} className={`ui-msg ui-msg-${ton}`}>{children}</p>
}
