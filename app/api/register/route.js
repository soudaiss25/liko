/* ─────────── app/api/register/route.js ───────────
   Création / mise à jour du PROFIL après l'inscription.

   Le compte (téléphone + mot de passe) est déjà créé par Supabase Auth,
   dans le navigateur. Cette route ne fait que remplir la table `users`.

   Sécurité : l'appelant doit envoyer le jeton de sa session
   (en-tête Authorization). Tout ce qui identifie la personne (id, téléphone)
   vient du JETON, jamais du corps de la requête. Le rôle est toujours
   'client' à la création, et n'est jamais modifié ici.

   Corps accepté : prenom, nom, username, email (facultatif), adresse
   (rien d'autre n'est lu).
*/

import { createClient } from '@supabase/supabase-js'

const USERNAME_VALIDE = /^[a-z0-9_.]{3,20}$/
const EMAIL_VALIDE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

const erreur = (message, status = 400) => Response.json({ error: message }, { status })

export async function POST(request) {
  try {
    // 1. Jeton présent ?
    const jeton = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jeton) return erreur('Non connecté.', 401)

    // 2. Jeton valide ?
    const supabase = service()
    const { data: { user } = {}, error: erreurJeton } = await supabase.auth.getUser(jeton)
    if (erreurJeton || !user) return erreur('Session expirée, reconnecte-toi.', 401)

    // 3. Identité : celle du jeton, jamais celle du corps
    const id = user.id
    // Le téléphone est obligatoire en base : on le vérifie AVANT toute écriture
    if (!user.phone) return erreur('Un numéro de téléphone est nécessaire pour créer ton compte.')
    const telephone = user.phone.startsWith('+') ? user.phone : `+${user.phone}`

    // 4. Validation des champs
    const corps = await request.json().catch(() => ({}))
    const prenom = String(corps.prenom || '').trim()
    const nom = String(corps.nom || '').trim()
    const adresse = String(corps.adresse || '').trim()
    const username = String(corps.username || '').trim().toLowerCase().replace(/^@/, '')
    const emailBrut = String(corps.email || '').trim().toLowerCase()
    const email = emailBrut || null
    if (email && !EMAIL_VALIDE.test(email)) {
      return erreur('Adresse e-mail invalide (tu peux la laisser vide).')
    }

    if (prenom.length < 2) return erreur('Indique ton prénom (2 caractères minimum).')
    if (!USERNAME_VALIDE.test(username)) {
      return erreur('Nom d’utilisateur invalide : 3 à 20 caractères (lettres, chiffres, _ ou .)')
    }

    // 5. Unicité du username (chez quelqu'un d'autre)
    const { data: pris, error: erreurPris } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', id)
      .maybeSingle()
    if (erreurPris) throw erreurPris
    if (pris) return erreur('Ce nom d’utilisateur est déjà pris.', 409)

    // 6. Mise à jour si le profil existe, sinon création (rôle client en dur)
    const { data: existant, error: erreurExistant } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (erreurExistant) throw erreurExistant

    const champs = { prenom, nom, username, email, adresse: adresse || null }
    const { error: erreurEcriture } = existant
      ? await supabase.from('users').update(champs).eq('id', id)
      : await supabase.from('users').insert({ id, telephone, role: 'client', ...champs })
    if (erreurEcriture) throw erreurEcriture

    return Response.json({ success: true })
  } catch {
    return erreur('Erreur serveur, réessaie.', 500)
  }
}
