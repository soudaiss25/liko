/* ─────────── lib/username.js ───────────
   LA règle du nom d'utilisateur, à un seul endroit.

   3 à 20 caractères, commence OBLIGATOIREMENT par une lettre, puis lettres minuscules,
   chiffres, _ ou . (le texte saisi est d'abord nettoyé : espaces, majuscules, "@" de tête).

   Pourquoi une lettre au début ? À la connexion, tout identifiant qui commence par un chiffre
   ou par "+" est pris pour un TÉLÉPHONE. Un username comme "2pac" ne pourrait donc jamais
   se connecter.
*/

export const USERNAME_REGEX = /^[a-z][a-z0-9_.]{2,19}$/

export const MESSAGE_USERNAME =
  "Nom d'utilisateur invalide : 3 à 20 caractères, commence par une lettre (lettres, chiffres, _ ou . ensuite)."

/* "@Said_M " → "said_m" */
export const normaliserUsername = (brut) =>
  String(brut || '').trim().toLowerCase().replace(/^@/, '')

export const usernameValide = (brut) => USERNAME_REGEX.test(normaliserUsername(brut))
