import { describe, it, expect } from 'vitest'
import {
  schemaLogin, schemaRegister, schemaCollaborateurCreation, schemaCollaborateurModification,
  validerCorps, REQUETE_INVALIDE,
} from '@/lib/schemas'

const long = (n) => 'a'.repeat(n)

describe('Schéma de connexion', () => {
  it('accepte un corps valide', () => {
    expect(validerCorps(schemaLogin, { identifiant: '+2693334455', password: 'secret123' }).ok).toBe(true)
  })
  it('refuse un champ inconnu', () => {
    const r = validerCorps(schemaLogin, { identifiant: 'said', password: 'x', role: 'admin' })
    expect(r.ok).toBe(false)
    expect(r.message).toBe(REQUETE_INVALIDE)
  })
  it('refuse un identifiant trop long (50 max) et un mot de passe trop long (128 max)', () => {
    expect(validerCorps(schemaLogin, { identifiant: long(51), password: 'x' }).ok).toBe(false)
    expect(validerCorps(schemaLogin, { identifiant: 'said', password: long(129) }).ok).toBe(false)
    expect(validerCorps(schemaLogin, { identifiant: long(50), password: long(128) }).ok).toBe(true)
  })
  it('refuse un type incorrect', () => {
    expect(validerCorps(schemaLogin, { identifiant: 123, password: 'x' }).ok).toBe(false)
    expect(validerCorps(schemaLogin, { identifiant: 'said', password: null }).ok).toBe(false)
    expect(validerCorps(schemaLogin, 'texte').ok).toBe(false)
    expect(validerCorps(schemaLogin, [1, 2]).ok).toBe(false)
  })
})

describe('Schéma d\u2019inscription', () => {
  const valide = { prenom: 'Said', nom: 'Ali', username: 'said_m', email: 'said@mail.com', adresse: 'Moroni' }

  it('accepte un corps valide, même avec des champs facultatifs absents', () => {
    expect(validerCorps(schemaRegister, valide).ok).toBe(true)
    expect(validerCorps(schemaRegister, { prenom: 'Said', username: 'said_m' }).ok).toBe(true)
  })
  it('refuse un champ inconnu (id, role, téléphone ne viennent jamais du corps)', () => {
    for (const intrus of [{ id: 'x' }, { role: 'admin' }, { telephone: '+2693334455' }, { password: 'x' }]) {
      expect(validerCorps(schemaRegister, { ...valide, ...intrus }).ok).toBe(false)
    }
  })
  it('refuse les textes trop longs, avec un message en français qui nomme le champ', () => {
    const r = validerCorps(schemaRegister, { ...valide, prenom: long(61) })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/prénom/)
    expect(r.message).toMatch(/60/)
    expect(validerCorps(schemaRegister, { ...valide, adresse: long(201) }).ok).toBe(false)
    expect(validerCorps(schemaRegister, { ...valide, email: long(121) }).ok).toBe(false)
    expect(validerCorps(schemaRegister, { ...valide, username: long(26) }).ok).toBe(false)
  })
  it('refuse un type incorrect', () => {
    expect(validerCorps(schemaRegister, { ...valide, prenom: 42 }).ok).toBe(false)
    expect(validerCorps(schemaRegister, { ...valide, adresse: ['Moroni'] }).ok).toBe(false)
  })
  it('ne donne aucun détail technique', () => {
    const r = validerCorps(schemaRegister, { ...valide, prenom: 42 })
    expect(r.message).toBe(REQUETE_INVALIDE)
    expect(r.message).not.toMatch(/zod|expected|string|invalid_type/i)
  })
})

describe('Schémas de gestion des collaborateurs', () => {
  it('acceptent des corps valides', () => {
    expect(validerCorps(schemaCollaborateurCreation, {
      mode: 'nouveau', role: 'collab_comores', prenom: 'Said', nom: '', username: 'said_m',
      telephone: '+2693334455', motDePasse: 'motdepasse1', identifiant: '',
    }).ok).toBe(true)
    expect(validerCorps(schemaCollaborateurModification, { id: 'abc', action: 'role', role: 'client' }).ok).toBe(true)
  })
  it('refusent un champ inconnu', () => {
    expect(validerCorps(schemaCollaborateurCreation, { role: 'collab_comores', admin: true }).ok).toBe(false)
    expect(validerCorps(schemaCollaborateurModification, { id: 'abc', action: 'role', extra: 1 }).ok).toBe(false)
  })
  it('refusent trop long et type incorrect', () => {
    expect(validerCorps(schemaCollaborateurCreation, { motDePasse: long(129) }).ok).toBe(false)
    expect(validerCorps(schemaCollaborateurCreation, { prenom: long(61) }).ok).toBe(false)
    expect(validerCorps(schemaCollaborateurCreation, { telephone: 2693334455 }).ok).toBe(false)
    expect(validerCorps(schemaCollaborateurModification, { id: 12 }).ok).toBe(false)
  })
})
