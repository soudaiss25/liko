import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/* Garde-fou : le prix d'achat est PRIVÉ. Ce test lit le code source et échoue
   si une lecture publique de la table "produits" pourrait le laisser fuir. */

const RACINE = process.cwd()
const DOSSIERS = ['app', 'components', 'lib']

/* Endroits où le mot "prix_achat" a le droit d'apparaître :
   l'admin, l'espace étranger, et les deux fichiers de calcul qui lui sont réservés
   (lib/ventes.js pour la marge, lib/achats.js pour l'onglet "À acheter" de l'étranger). */
const AUTORISES_PRIX_ACHAT = [
  'app/admin/',
  'components/admin/',
  'app/espace/etranger/',
  'components/espace/',
  'lib/ventes.js',
  'lib/achats.js',
]

function fichiersSource(dossier) {
  const complet = path.join(RACINE, dossier)
  if (!fs.existsSync(complet)) return []
  return fs.readdirSync(complet, { withFileTypes: true }).flatMap((e) => {
    const relatif = `${dossier}/${e.name}`
    if (e.isDirectory()) return fichiersSource(relatif)
    return /\.(js|jsx|mjs)$/.test(e.name) ? [relatif] : []
  })
}

const FICHIERS = DOSSIERS.flatMap(fichiersSource)
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8')

/* from('produits') puis .select('*') : espaces, retours à la ligne et commentaires tolérés entre les deux */
const ENTRE = '(?:\\s|//[^\\n]*\\n|/\\*[\\s\\S]*?\\*/)*'
const SELECT_ETOILE = new RegExp(`from\\(\\s*['"\`]produits['"\`]\\s*\\)${ENTRE}\\.select\\(\\s*['"\`]\\*['"\`]`)

describe('Sécurité : le prix d’achat reste privé', () => {
  it('trouve bien des fichiers à contrôler', () => {
    expect(FICHIERS.length).toBeGreaterThan(20)
  })

  it('aucun fichier ne fait from(\'produits\').select(\'*\')', () => {
    const fautifs = FICHIERS
      .filter((f) => SELECT_ETOILE.test(lire(f)))
      .map((f) => `${f} : select('*') sur la table produits (cela enverrait prix_achat au navigateur ; liste les colonnes une par une)`)
    expect(fautifs, fautifs.join('\n')).toEqual([])
  })

  it('le mot prix_achat n’apparaît que dans l’admin, l’espace étranger et les calculs réservés', () => {
    const fautifs = FICHIERS
      .filter((f) => !AUTORISES_PRIX_ACHAT.some((ok) => f.startsWith(ok)))
      .filter((f) => lire(f).includes('prix_achat'))
      .map((f) => `${f} : contient "prix_achat" alors que ce fichier est accessible aux visiteurs ou aux Comores`)
    expect(fautifs, fautifs.join('\n')).toEqual([])
  })
})
