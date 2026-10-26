/* ─────────── lib/limiteur.js ───────────
   Limiteur de requêtes (anti force brute). SERVEUR UNIQUEMENT.

   Il s'appuie sur la fonction SQL verifier_limite(p_cle, p_max, p_fenetre_secondes)
   (migration 08), appelable uniquement avec le client service_role :
     true  = autorisé (et la tentative est comptée)
     false = limite atteinte

   Si la base ne répond pas, on laisse passer (true) : on ne bloque pas les vrais
   utilisateurs parce que le limiteur est tombé. L'erreur est journalisée.
*/

/* Adresse IP du visiteur : premier élément de x-forwarded-for, sinon "inconnue" */
export function ipClient(request) {
  const brut = request.headers.get('x-forwarded-for')
  if (!brut) return 'inconnue'
  const premiere = brut.split(',')[0].trim()
  return premiere || 'inconnue'
}

/* true = on peut continuer, false = trop de tentatives */
export async function limiter(supabaseService, cle, max, fenetreSecondes) {
  try {
    const { data, error } = await supabaseService.rpc('verifier_limite', {
      p_cle: cle,
      p_max: max,
      p_fenetre_secondes: fenetreSecondes,
    })
    if (error) {
      console.error('[limiteur] erreur de la base, requête laissée passer :', cle, error.message)
      return true
    }
    return data !== false
  } catch (e) {
    console.error('[limiteur] échec de l\u2019appel, requête laissée passer :', cle, e?.message || e)
    return true
  }
}

export const MESSAGE_LIMITE = 'Trop de tentatives. Réessaie dans 15 minutes.'
export const MESSAGE_LIMITE_HEURE = 'Trop de tentatives. Réessaie dans une heure.'
export const MESSAGE_LIMITE_ADMIN = 'Trop de requêtes. Réessaie dans une minute.'
