/* ─────────── scripts/verif-cle.js ───────────
   Dit QUEL TYPE de clé se trouve dans SUPABASE_SERVICE_ROLE_KEY,
   sans jamais afficher la clé elle-même (elle reste secrète).

   Lancer depuis la racine du projet :   node scripts/verif-cle.js
*/
const fs = require('fs')

const env = fs.readFileSync('.env.local', 'utf8')
const ligne = env.split(/\r?\n/).find((l) => l.startsWith('SUPABASE_SERVICE_ROLE_KEY='))

if (!ligne) {
  console.log('❌ Aucune ligne SUPABASE_SERVICE_ROLE_KEY= dans .env.local')
  process.exit(0)
}

const cle = ligne.slice('SUPABASE_SERVICE_ROLE_KEY='.length).trim().replace(/^["']|["']$/g, '')

if (cle.startsWith('sb_secret_')) {
  console.log('✅ Clé "secret" (nouveau format) : c\'est la bonne.')
} else if (cle.startsWith('sb_publishable_')) {
  console.log('❌ Clé "publishable" : c\'est la clé PUBLIQUE, pas la bonne.')
} else {
  try {
    // Les anciennes clés sont des jetons JWT : leur partie centrale indique le rôle
    const role = JSON.parse(Buffer.from(cle.split('.')[1], 'base64url').toString()).role
    console.log(role === 'service_role'
      ? '✅ Clé "service_role" : c\'est la bonne.'
      : `❌ Clé de rôle "${role}" : c'est la clé PUBLIQUE, pas la bonne.`)
  } catch {
    console.log('❌ Format de clé non reconnu (clé tronquée ou mal copiée ?)')
  }
}