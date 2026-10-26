import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { verifierMigrations, MARQUEUR_DESTRUCTIF } from '../scripts/verifier-migrations.mjs'

const dossiers = []
function dossierAvec(fichiers) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))
  dossiers.push(d)
  for (const [nom, contenu] of Object.entries(fichiers)) fs.writeFileSync(path.join(d, nom), contenu)
  return d
}
afterEach(() => { while (dossiers.length) fs.rmSync(dossiers.pop(), { recursive: true, force: true }) })

const OK = 'create table if not exists public.exemple (id int);\n'

describe('Vérification des migrations : le dossier réel', () => {
  it('est valide (suite complète, rien de destructif ni de secret)', () => {
    expect(verifierMigrations(path.resolve('supabase/migrations'))).toEqual([])
  })
})

describe('Noms de fichiers', () => {
  it('accepte NN_nom-en-minuscules.sql', () => {
    expect(verifierMigrations(dossierAvec({ '01_schema.sql': OK, '02_prix-achat-prive.sql': OK }))).toEqual([])
  })
  it('refuse les majuscules, un seul chiffre, les underscores dans le nom et l’absence de numéro', () => {
    for (const nom of ['01_Schema.sql', '1_schema.sql', '01_mon_schema.sql', 'schema.sql', '001_schema.sql']) {
      const p = verifierMigrations(dossierAvec({ [nom]: OK }))
      expect(p.length, nom).toBeGreaterThan(0)
      expect(p[0]).toContain(nom)
      expect(p[0]).toContain('NN_nom-en-minuscules.sql')
    }
  })
  it('ignore les fichiers qui ne sont pas des .sql', () => {
    expect(verifierMigrations(dossierAvec({ '01_schema.sql': OK, 'notes.md': 'texte' }))).toEqual([])
  })
})

describe('Numéros', () => {
  it('refuse deux fichiers avec le même numéro', () => {
    const p = verifierMigrations(dossierAvec({ '01_a.sql': OK, '02_b.sql': OK, '02_c.sql': OK }))
    expect(p.join('\n')).toMatch(/Numéro 02 en double : 02_b\.sql et 02_c\.sql/)
  })
  it('refuse un numéro manquant dans la suite', () => {
    const p = verifierMigrations(dossierAvec({ '01_a.sql': OK, '02_b.sql': OK, '04_d.sql': OK }))
    expect(p.join('\n')).toMatch(/Numéro manquant dans la suite : 03/)
  })
})

describe('Instructions destructives', () => {
  it.each(['drop table public.x;', 'TRUNCATE public.x;', 'delete from public.x where id = 1;'])('refuse « %s » sans commentaire', (sql) => {
    const p = verifierMigrations(dossierAvec({ '01_a.sql': `${sql}\n` }))
    expect(p.length).toBe(1)
    expect(p[0]).toMatch(/01_a\.sql, ligne 1/)
    expect(p[0]).toContain('DESTRUCTIF ASSUMÉ')
  })
  it('accepte avec le commentaire exact sur la ligne juste au-dessus', () => {
    expect(verifierMigrations(dossierAvec({ '01_a.sql': `${MARQUEUR_DESTRUCTIF}\ndrop table public.x;\n` }))).toEqual([])
  })
  it('refuse si le commentaire n’est pas sur la ligne juste au-dessus', () => {
    const p = verifierMigrations(dossierAvec({ '01_a.sql': `${MARQUEUR_DESTRUCTIF}\n\ndrop table public.x;\n` }))
    expect(p.length).toBe(1)
  })
  it('ne se laisse pas tromper par un commentaire qui cite le mot', () => {
    expect(verifierMigrations(dossierAvec({ '01_a.sql': '-- on ne fait jamais drop table ici\n' + OK }))).toEqual([])
  })
  it('ne contrôle pas le corps d’une fonction, mais contrôle un bloc DO', () => {
    const fonction = 'create function f() returns void language sql as $$ delete from public.x; $$;\n'
    expect(verifierMigrations(dossierAvec({ '01_a.sql': fonction }))).toEqual([])
    const bloc = 'do $$ begin drop table public.x; end $$;\n'
    expect(verifierMigrations(dossierAvec({ '01_a.sql': bloc })).length).toBe(1)
  })
})

describe('Secrets', () => {
  it('refuse service_role suivi d’une valeur', () => {
    const p = verifierMigrations(dossierAvec({ '01_a.sql': 'select \'service_role = abcdefghij1234567890\';\n' }))
    expect(p.join('\n')).toMatch(/01_a\.sql, ligne 1.*service_role/)
  })
  it('accepte « to service_role; » (un droit, pas une clé)', () => {
    expect(verifierMigrations(dossierAvec({ '01_a.sql': 'grant execute on function f() to service_role;\n' }))).toEqual([])
  })
  it('refuse un texte qui ressemble à une clé', () => {
    // Fragments assemblés ici pour que ce fichier de test ne ressemble pas à un vrai secret
    const sb = 'sb_' + 'secret_' + 'abcdef'
    const jwt = 'ey' + 'JhbGci' + 'OiJIUzI1NiJ9'
    expect(verifierMigrations(dossierAvec({ '01_a.sql': `-- ${sb}\n` })).join('\n')).toMatch(/sb_secret_/)
    expect(verifierMigrations(dossierAvec({ '01_a.sql': `-- ${jwt}\n` })).join('\n')).toMatch(/eyJhbGci/)
  })
})

describe('Exception du schéma initial', () => {
  it('00_schema-initial.sql n’est pas contrôlé', () => {
    const p = verifierMigrations(dossierAvec({
      '00_schema-initial.sql': 'drop table public.x;\n',
      '01_a.sql': OK,
    }))
    expect(p).toEqual([])
  })
})
