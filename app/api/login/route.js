/* ─────────── app/api/login/route.js ───────────
   Connexion côté SERVEUR.
   Pourquoi ici et pas dans le navigateur ?
   → Pour trouver le téléphone à partir d'un username, il faut lire la table
     `users`. La RLS l'interdit (à juste titre) aux visiteurs non connectés.
   → Le serveur utilise la clé service_role, qui ne quitte jamais le serveur.
   → Le navigateur ne reçoit que les jetons de session, jamais le téléphone.
*/

import { createClient } from '@supabase/supabase-js'

// Message volontairement vague : on ne dit jamais si c'est le username
// ou le mot de passe qui est faux (sinon on peut deviner quels comptes existent)
const ERREUR_GENERIQUE = 'Identifiant ou mot de passe incorrect'

export async function POST(request) {
  try {
    const { identifiant, password } = await request.json()

    if (!identifiant || !password) {
      return Response.json({ error: 'Remplis les deux champs' }, { status: 400 })
    }

    // On enlève les espaces : "+269 333 44 55" → "+2693334455"
    let telephone = identifiant.trim().replace(/\s/g, '')
    const isPhone = telephone.startsWith('+') || /^\d/.test(telephone)

    // 1. Username → on cherche le téléphone avec la clé service_role
    if (!isPhone) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      )

      const { data: userRow } = await admin
        .from('users')
        .select('telephone')
        .eq('username', telephone.toLowerCase().replace('@', ''))
        .maybeSingle()

      if (!userRow) {
        return Response.json({ error: ERREUR_GENERIQUE }, { status: 401 })
      }
      telephone = userRow.telephone
    }

    // 2. Connexion avec la clé publique normale (anon)
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    )

    const { data, error } = await anon.auth.signInWithPassword({
      phone: telephone,
      password,
    })

    if (error || !data.session) {
      return Response.json({ error: ERREUR_GENERIQUE }, { status: 401 })
    }

    // 3. On renvoie uniquement les jetons de session
    return Response.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  } catch (e) {
    return Response.json({ error: 'Erreur serveur, réessaie dans un instant' }, { status: 500 })
  }
}