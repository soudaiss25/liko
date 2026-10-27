/* ─────────── lib/schemas.js ───────────
   Schémas Zod des corps de requête des routes serveur (mode strict : tout champ
   inconnu est refusé). Ils contrôlent la FORME (types, longueurs maximales).
   Les règles métier (prénom obligatoire, format du username, mot de passe minimum…)
   restent dans les routes, avec leurs messages d'origine.

   Pourquoi pas de longueur MINIMALE ici ? Les comptes existants ont des mots de passe
   de 6 caractères : exiger 8 à la connexion les bloquerait. Les minimums sont vérifiés
   à la création, dans chaque route.
*/

import { z } from 'zod'
import { MESSAGE_USERNAME, usernameValide } from '@/lib/username'

export const REQUETE_INVALIDE = 'Requête invalide.'

/* Une chaîne de texte avec une longueur maximale */
const chaine = (nom, max) =>
  z.string({ error: REQUETE_INVALIDE })
    .max(max, { error: `Le champ « ${nom} » est trop long (${max} caractères maximum).` })

/* Nom d'utilisateur : longueur maximale du texte brut (20 caractères + "@" éventuel et espaces),
   puis règle de lib/username.js. Vide accepté ici : la route décide si le username est obligatoire
   (il ne l'est pas quand on donne l'accès à un compte qui existe déjà). */
const usernameChamp = chaine('nom d\u2019utilisateur', 25)
  .refine((v) => v === '' || usernameValide(v), { error: MESSAGE_USERNAME })

/* ── /api/login ── */
export const schemaLogin = z.object({
  identifiant: chaine('identifiant', 50).optional(),
  password: chaine('mot de passe', 128).optional(),
}).strict()

/* ── /api/register ── */
export const schemaRegister = z.object({
  prenom: chaine('prénom', 60).optional(),
  nom: chaine('nom', 60).optional(),
  username: usernameChamp.optional(),
  email: chaine('e-mail', 120).optional(),
  adresse: chaine('adresse', 200).optional(),
}).strict()

/* ── /api/admin/collaborateurs ── */
export const schemaCollaborateurCreation = z.object({
  mode: chaine('mode', 20).optional(),
  role: chaine('rôle', 30).optional(),
  prenom: chaine('prénom', 60).optional(),
  nom: chaine('nom', 60).optional(),
  username: usernameChamp.optional(),
  telephone: chaine('téléphone', 30).optional(),
  motDePasse: chaine('mot de passe', 128).optional(),
  identifiant: chaine('identifiant', 50).optional(),
}).strict()

export const schemaCollaborateurModification = z.object({
  id: chaine('identifiant du collaborateur', 64).optional(),
  action: chaine('action', 20).optional(),
  role: chaine('rôle', 30).optional(),
  motDePasse: chaine('mot de passe', 128).optional(),
}).strict()

/* Valide un corps de requête.
   → { ok: true, donnees } ou { ok: false, message } (message en français, sans détail technique) */
export function validerCorps(schema, corps) {
  const resultat = schema.safeParse(corps)
  if (resultat.success) return { ok: true, donnees: resultat.data }
  const probleme = resultat.error.issues[0]
  // On ne montre que nos propres messages (trop long, username invalide), jamais ceux de Zod
  const message = probleme && (probleme.code === 'too_big' || probleme.code === 'custom') ? probleme.message : REQUETE_INVALIDE
  return { ok: false, message }
}
