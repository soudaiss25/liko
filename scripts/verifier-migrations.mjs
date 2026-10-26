/* ─────────── scripts/verifier-migrations.mjs ───────────
   Contrôle le dossier supabase/migrations avant toute fusion.
   Échoue (code 1) avec un message clair par problème trouvé.

   Règles :
   1. nom de fichier : NN_nom-en-minuscules.sql (deux chiffres, tirets, minuscules et chiffres)
   2. pas de numéro en double, pas de numéro manquant dans la suite
   3. DROP TABLE, TRUNCATE et DELETE FROM interdits, sauf si la ligne juste au-dessus est
      exactement le commentaire  -- DESTRUCTIF ASSUMÉ
      (le corps d'une fonction, entre $$ … $$, n'est pas contrôlé : ce code s'exécute à l'usage,
       pas à l'application de la migration ; un bloc DO, lui, est contrôlé)
   4. aucune clé secrète : "service_role" suivi d'une valeur, sb_secret_, eyJhbGci

   Exception : 00_schema-initial.sql (s'il existe) n'est pas contrôlé.

   Utilisation :  node scripts/verifier-migrations.mjs [dossier]
*/

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const FICHIER_EXCEPTION = '00_schema-initial.sql'
export const MARQUEUR_DESTRUCTIF = '-- DESTRUCTIF ASSUMÉ'

const FORMAT_NOM = /^(\d{2})_[a-z0-9]+(?:-[a-z0-9]+)*\.sql$/
const DESTRUCTIF = /\b(drop\s+table|truncate|delete\s+from)\b/i
const SECRETS = [
  { motif: /service_role\s*[=:]\s*["']?[A-Za-z0-9._-]{8,}/i, raison: '"service_role" suivi d\u2019une valeur (clé secrète ?)' },
  { motif: /sb_secret_/i, raison: 'texte qui ressemble à une clé secrète Supabase (sb_secret_)' },
  { motif: /eyJhbGci/, raison: 'texte qui ressemble à un jeton ou une clé JWT (eyJhbGci)' },
]

/* Remplace par des espaces le corps des fonctions ($$ … $$), en gardant les retours à la ligne
   pour que les numéros de ligne restent justes. Un bloc "do $$ … $$" est conservé. */
function sansCorpsDeFonctions(sql) {
  return sql.replace(/(\$[A-Za-z_]*\$)([\s\S]*?)\1/g, (tout, balise, corps, position) => {
    const avant = sql.slice(0, position)
    const debutInstruction = avant.lastIndexOf(';') + 1
    const entete = avant.slice(debutInstruction).trim()
    if (/\bdo$/i.test(entete)) return tout // bloc DO : exécuté à l'application → on le contrôle
    return balise + corps.replace(/[^\n]/g, ' ') + balise
  })
}

/* Renvoie la liste des problèmes (tableau de textes). Vide = tout est bon. */
export function verifierMigrations(dossier) {
  const problemes = []
  if (!fs.existsSync(dossier)) return [`Dossier introuvable : ${dossier}`]

  const fichiers = fs.readdirSync(dossier).filter((f) => /\.sql$/i.test(f)).sort()
  const controles = fichiers.filter((f) => f !== FICHIER_EXCEPTION)

  // 1. Format des noms
  const numeros = new Map() // numéro → fichiers
  for (const f of controles) {
    const m = f.match(FORMAT_NOM)
    if (!m) {
      problemes.push(`${f} : le nom doit être au format NN_nom-en-minuscules.sql (deux chiffres, puis lettres minuscules, chiffres et tirets)`)
      continue
    }
    const n = Number(m[1])
    numeros.set(n, [...(numeros.get(n) || []), f])
  }

  // 2. Doublons et numéros manquants
  for (const [n, liste] of numeros) {
    if (liste.length > 1) problemes.push(`Numéro ${String(n).padStart(2, '0')} en double : ${liste.join(' et ')}`)
  }
  const tries = [...numeros.keys()].sort((a, b) => a - b)
  for (let i = 1; i < tries.length; i++) {
    for (let manquant = tries[i - 1] + 1; manquant < tries[i]; manquant++) {
      problemes.push(`Numéro manquant dans la suite : ${String(manquant).padStart(2, '0')} (entre ${String(tries[i - 1]).padStart(2, '0')} et ${String(tries[i]).padStart(2, '0')})`)
    }
  }

  // 3 et 4. Contenu de chaque fichier
  for (const f of controles) {
    const sql = fs.readFileSync(path.join(dossier, f), 'utf8').replace(/\r\n/g, '\n')
    const lignes = sql.split('\n')
    const lignesControlees = sansCorpsDeFonctions(sql).split('\n')

    lignesControlees.forEach((ligne, i) => {
      if (ligne.trim().startsWith('--')) return // commentaire
      const trouve = ligne.match(DESTRUCTIF)
      if (!trouve) return
      const dessus = (lignes[i - 1] || '').trim()
      if (dessus !== MARQUEUR_DESTRUCTIF) {
        problemes.push(`${f}, ligne ${i + 1} : « ${trouve[0].toUpperCase()} » sans le commentaire « ${MARQUEUR_DESTRUCTIF} » sur la ligne juste au-dessus`)
      }
    })

    lignes.forEach((ligne, i) => {
      for (const { motif, raison } of SECRETS) {
        if (motif.test(ligne)) problemes.push(`${f}, ligne ${i + 1} : ${raison}`)
      }
    })
  }

  return problemes
}

/* ─── Exécution en ligne de commande ─── */
const lance = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (lance) {
  const dossier = path.resolve(process.argv[2] || 'supabase/migrations')
  const problemes = verifierMigrations(dossier)
  if (problemes.length > 0) {
    console.error(`❌ ${problemes.length} problème(s) dans ${path.relative(process.cwd(), dossier) || dossier} :\n`)
    problemes.forEach((p) => console.error(`  - ${p}`))
    process.exit(1)
  }
  const fichiers = fs.readdirSync(dossier).filter((f) => /\.sql$/i.test(f) && f !== FICHIER_EXCEPTION).sort()
  console.log(`✅ ${fichiers.length} migration(s) vérifiée(s) : ${fichiers[0] || '—'} → ${fichiers.at(-1) || '—'}`)
}
