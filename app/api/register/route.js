import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { id, telephone, nom, prenom, username, email, adresse, password } = await request.json()

    // Vérifier que le username n'existe pas déjà
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single()

    if (existingUser) {
      return Response.json({ error: "Ce nom d'utilisateur est déjà pris" }, { status: 400 })
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(12)
    const password_hash = await bcrypt.hash(password, salt)

    // Créer le profil
    const { error } = await supabase.from('users').upsert({
      id,
      telephone,
      nom,
      prenom,
      username: username.toLowerCase().replace('@', ''),
      email: email || null,
      adresse: adresse || null,
      password_hash,
      role: 'client',
      pin_set: false,
    })

    if (error) return Response.json({ error: error.message }, { status: 400 })

    return Response.json({ success: true })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}