/* ─────────── scripts/centraliser-couleurs.mjs ───────────
   Remplace la palette recopiée dans chaque fichier ("const C = { … }")
   par un import unique : import { C } from '@/lib/theme'

   1. Aperçu (ne modifie RIEN) :   node scripts/centraliser-couleurs.mjs
   2. Application :                node scripts/centraliser-couleurs.mjs --appliquer

   Sécurités :
   - par défaut, simple aperçu : tu vois ce qui va changer avant
   - un fichier qui utilise une couleur absente de lib/theme.js est laissé tel quel
   - les couleurs légèrement différentes du thème sont listées (elles seront harmonisées)
*/

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const APPLIQUER = process.argv.includes('--appliquer')
const DOSSIERS = ['app', 'components']

// La palette officielle, lue directement dans lib/theme.js
const theme = Object.fromEntries(
  [...readFileSync('lib/theme.js', 'utf8').matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2].toUpperCase()])
)

function fichiersJS(dossier) {
  let liste = []
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) liste = liste.concat(fichiersJS(chemin))
    else if (/\.(js|jsx)$/.test(nom)) liste.push(chemin)
  }
  return liste
}

const BLOC = /^const C = \{\n[\s\S]*?\n\}\n\n?/m
const IMPORT = /^import[\s\S]*?from\s+['"][^'"]+['"]\s*\n/gm

let modifies = 0
const ignores = []
const differences = []

for (const dossier of DOSSIERS) {
  let liste
  try { liste = fichiersJS(dossier) } catch { continue }

  for (const fichier of liste) {
    // Les fichiers peuvent être en fins de ligne Windows (CRLF) : on travaille en LF, puis on remet l'original
    const brut = readFileSync(fichier, 'utf8')
    const crlf = brut.includes('\r\n')
    const texte = brut.replace(/\r\n/g, '\n')
    const bloc = texte.match(BLOC)
    if (!bloc) continue
    if (texte.includes("from '@/lib/theme'")) continue

    // Couleurs du fichier
    const couleurs = [...bloc[0].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => [m[1], m[2].toUpperCase()])
    const inconnues = couleurs.filter(([cle]) => !theme[cle]).map(([cle]) => cle)
    if (inconnues.length) {
      ignores.push(`${relative('.', fichier)} (couleurs absentes du thème : ${inconnues.join(', ')})`)
      continue
    }
    couleurs.filter(([cle, val]) => theme[cle] !== val)
      .forEach(([cle, val]) => differences.push(`${relative('.', fichier)} : ${cle} ${val} → ${theme[cle]}`))

    // On enlève le bloc et on ajoute l'import après le dernier import existant
    let nouveau = texte.replace(BLOC, '')
    const imports = [...nouveau.matchAll(IMPORT)]
    if (!imports.length) {
      ignores.push(`${relative('.', fichier)} (aucun import trouvé)`)
      continue
    }
    const fin = imports.at(-1).index + imports.at(-1)[0].length
    nouveau = nouveau.slice(0, fin) + "import { C } from '@/lib/theme'\n" + nouveau.slice(fin)

    if (APPLIQUER) writeFileSync(fichier, crlf ? nouveau.replace(/\n/g, '\r\n') : nouveau)
    console.log(`${APPLIQUER ? '✅ modifié ' : '•  à modifier'}  ${relative('.', fichier)}`)
    modifies++
  }
}

console.log(`\n${modifies} fichier(s) ${APPLIQUER ? 'modifié(s)' : 'à modifier'}.`)
if (differences.length) {
  console.log('\nCouleurs harmonisées avec le thème (léger changement visuel) :')
  differences.forEach((d) => console.log('   ' + d))
}
if (ignores.length) {
  console.log('\nLaissés tels quels :')
  ignores.forEach((d) => console.log('   ' + d))
}
if (!APPLIQUER && modifies) console.log('\nPour appliquer : node scripts/centraliser-couleurs.mjs --appliquer')
