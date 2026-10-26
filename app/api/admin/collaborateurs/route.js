/* ─────────── app/api/admin/collaborateurs/route.js ───────────
   Gestion des collaborateurs par l'admin, CÔTÉ SERVEUR.

   Pourquoi côté serveur ?
   → Créer un compte (avec mot de passe) ou changer le mot de passe de
     quelqu'un d'autre demande la clé service_role, qui ne doit JAMAIS
     arriver dans le navigateur.

   Chaque appel doit contenir le jeton de la personne connectée
   (en-tête Authorization). Le serveur vérifie qu'elle est bien admin
   avant de faire quoi que ce soit.

   GET    → liste des collaborateurs
   POST   → créer un nouveau compte collaborateur
            OU donner l'accès à un compte client existant
   PATCH  → changer le rôle (étranger ⇄ Comores, retirer l'accès)
            OU définir un nouveau mot de passe
*/

import { createClient } from '@supabase/supabase-js'
import { limiter, MESSAGE_LIMITE_ADMIN } from '@/lib/limiteur'
import {
  schemaCollaborateurCreation, schemaCollaborateurModification, validerCorps, REQUETE_INVALIDE,
} from '@/lib/schemas'

const ROLES_COLLAB = ['collab_etranger', 'collab_comores']
const MDP_MIN = 8

/* Client "tout-puissant" : uniquement ici, sur le serveur */
const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

const erreur = (message, status = 400) => Response.json({ error: message }, { status })

/* "+269 333 44 55" → "+2693334455" ; renvoie null si le format est mauvais */
function normaliserTelephone(brut) {
  const tel = String(brut || '').replace(/[\s.\-()]/g, '')
  return /^\+\d{8,15}$/.test(tel) ? tel : null
}

/* "@Said_M" → "said_m" ; renvoie null si le format est mauvais */
function normaliserUsername(brut) {
  const u = String(brut || '').trim().toLowerCase().replace(/^@/, '')
  return /^[a-z0-9_.]{3,20}$/.test(u) ? u : null
}

/* ── Vérifie que l'appel vient d'un admin connecté ──
   Renvoie { admin, idAdmin } si OK, sinon une Response d'erreur. */
async function verifierAdmin(request) {
  const jeton = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!jeton) return { refus: erreur('Non connecté.', 401) }

  const admin = service()
  const { data: { user }, error } = await admin.auth.getUser(jeton)
  if (error || !user) return { refus: erreur('Session expirée, reconnecte-toi.', 401) }

  const { data: profil } = await admin.from('users').select('role').eq('id', user.id).single()
  if (profil?.role !== 'admin') return { refus: erreur('Réservé à l\u2019administrateur.', 403) }

  // Anti abus : 30 requêtes par minute et par admin
  if (!(await limiter(admin, `admin:${user.id}`, 30, 60))) {
    return { refus: erreur(MESSAGE_LIMITE_ADMIN, 429) }
  }

  return { admin, idAdmin: user.id }
}

/* ═══════════ GET : liste des collaborateurs ═══════════ */
export async function GET(request) {
  const { admin, refus } = await verifierAdmin(request)
  if (refus) return refus

  const { data, error } = await admin
    .from('users')
    .select('id, prenom, nom, username, telephone, role, created_at')
    .in('role', ROLES_COLLAB)
    .order('created_at', { ascending: false })

  if (error) return erreur('Impossible de charger les collaborateurs : ' + error.message, 500)
  return Response.json({ collaborateurs: data || [] })
}

/* ═══════════ POST : créer / promouvoir ═══════════ */
export async function POST(request) {
  const { admin, refus } = await verifierAdmin(request)
  if (refus) return refus

  let corpsBrut
  try { corpsBrut = await request.json() } catch { return erreur(REQUETE_INVALIDE) }
  const verif = validerCorps(schemaCollaborateurCreation, corpsBrut)
  if (!verif.ok) return erreur(verif.message)
  const corps = verif.donnees

  const role = corps.role
  if (!ROLES_COLLAB.includes(role)) return erreur('Choisis le type de collaborateur.')

  /* ── Cas A : donner l'accès à un compte qui existe déjà ── */
  if (corps.mode === 'existant') {
    const identifiant = String(corps.identifiant || '').trim()
    if (!identifiant) return erreur('Indique le nom d\u2019utilisateur ou le téléphone du compte.')

    const tel = normaliserTelephone(identifiant)
    const colonne = tel ? 'telephone' : 'username'
    const valeur = tel || identifiant.toLowerCase().replace(/^@/, '')

    const { data: cible } = await admin.from('users').select('id, role, prenom').eq(colonne, valeur).maybeSingle()
    if (!cible) return erreur('Aucun compte trouvé avec cet identifiant.')
    if (cible.role === 'admin') return erreur('Ce compte est administrateur : on ne le transforme pas en collaborateur.')
    if (cible.role === role) return erreur('Ce compte a déjà ce rôle.')

    const { error } = await admin.from('users').update({ role }).eq('id', cible.id)
    if (error) return erreur('Mise à jour impossible : ' + error.message, 500)
    return Response.json({ ok: true, message: `${cible.prenom || 'Le compte'} est maintenant collaborateur.` })
  }

  /* ── Cas B : créer un tout nouveau compte ── */
  const prenom = String(corps.prenom || '').trim()
  const nom = String(corps.nom || '').trim()
  const username = normaliserUsername(corps.username)
  const telephone = normaliserTelephone(corps.telephone)
  const motDePasse = String(corps.motDePasse || '')

  if (!prenom) return erreur('Le prénom est obligatoire.')
  if (!username) return erreur('Nom d\u2019utilisateur invalide : 3 à 20 caractères (lettres, chiffres, _ ou .).')
  if (!telephone) return erreur('Téléphone invalide : format international, ex. +2693334455 ou +8613800138000.')
  if (motDePasse.length < MDP_MIN) return erreur(`Le mot de passe doit faire au moins ${MDP_MIN} caractères.`)

  // Doublons vérifiés AVANT de créer quoi que ce soit
  const { data: memeUsername } = await admin.from('users').select('id').eq('username', username).maybeSingle()
  if (memeUsername) return erreur('Ce nom d\u2019utilisateur est déjà pris.')
  const { data: memeTel } = await admin.from('users').select('id').eq('telephone', telephone).maybeSingle()
  if (memeTel) return erreur('Ce téléphone a déjà un compte. Utilise plutôt « Compte existant ».')

  // 1. Le compte de connexion (Supabase Auth)
  const { data: cree, error: errAuth } = await admin.auth.admin.createUser({
    phone: telephone,
    password: motDePasse,
    phone_confirm: true, // pas de SMS de vérification (désactivés pour l'instant)
  })
  if (errAuth) {
    if (/already/i.test(errAuth.message)) return erreur('Ce téléphone a déjà un compte de connexion.')
    return erreur('Création du compte impossible : ' + errAuth.message, 500)
  }

  // 2. Le profil (notre table users)
  const { error: errProfil } = await admin.from('users').insert({
    id: cree.user.id, telephone, prenom, nom: nom || null, username, role,
  })

  // Si le profil échoue, on supprime le compte de connexion créé à l'étape 1 :
  // sinon il resterait un compte "fantôme" impossible à utiliser.
  if (errProfil) {
    await admin.auth.admin.deleteUser(cree.user.id)
    return erreur('Création du profil impossible : ' + errProfil.message, 500)
  }

  return Response.json({ ok: true, message: `Compte de ${prenom} créé.` })
}

/* ═══════════ PATCH : changer le rôle ou le mot de passe ═══════════ */
export async function PATCH(request) {
  const { admin, idAdmin, refus } = await verifierAdmin(request)
  if (refus) return refus

  let corpsBrut
  try { corpsBrut = await request.json() } catch { return erreur(REQUETE_INVALIDE) }
  const verif = validerCorps(schemaCollaborateurModification, corpsBrut)
  if (!verif.ok) return erreur(verif.message)
  const corps = verif.donnees

  const { id, action } = corps
  if (!id) return erreur('Collaborateur manquant.')

  // Règle : l'admin ne peut pas se modifier lui-même ici (évite de se bloquer dehors)
  if (id === idAdmin) return erreur('Tu ne peux pas modifier ton propre compte ici.')

  const { data: cible } = await admin.from('users').select('id, role, prenom').eq('id', id).maybeSingle()
  if (!cible) return erreur('Ce compte n\u2019existe plus.')
  if (!ROLES_COLLAB.includes(cible.role)) return erreur('Ce compte n\u2019est pas (ou plus) collaborateur.')

  if (action === 'role') {
    const nouveau = corps.role
    if (![...ROLES_COLLAB, 'client'].includes(nouveau)) return erreur('Rôle invalide.')
    if (nouveau === cible.role) return erreur('Ce compte a déjà ce rôle.')

    const { error } = await admin.from('users').update({ role: nouveau }).eq('id', id)
    if (error) return erreur('Mise à jour impossible : ' + error.message, 500)

    const message = nouveau === 'client'
      ? `${cible.prenom || 'Le compte'} n'a plus accès à l'espace collaborateur (il reste client).`
      : `${cible.prenom || 'Le compte'} a changé d'espace.`
    return Response.json({ ok: true, message })
  }

  if (action === 'mot_de_passe') {
    const motDePasse = String(corps.motDePasse || '')
    if (motDePasse.length < MDP_MIN) return erreur(`Le mot de passe doit faire au moins ${MDP_MIN} caractères.`)

    const { error } = await admin.auth.admin.updateUserById(id, { password: motDePasse })
    if (error) return erreur('Changement impossible : ' + error.message, 500)
    return Response.json({ ok: true, message: `Nouveau mot de passe défini pour ${cible.prenom || 'ce compte'}.` })
  }

  return erreur('Action inconnue.')
}