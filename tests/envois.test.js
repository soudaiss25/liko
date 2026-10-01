import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  referenceEnvoi, dateLocale, estEnRetard, totalPieces, labelMotif,
  messageErreur, erreurNecessiteRechargement,
} from '@/lib/envois'

afterEach(() => vi.useRealTimers())

describe('Référence lisible', () => {
  it('formate le numéro sur 4 chiffres', () => {
    expect(referenceEnvoi({ numero: 7 })).toBe('ENV-0007')
    expect(referenceEnvoi({ numero: 12345 })).toBe('ENV-12345')
  })
})

describe('Dates "2026-09-23" (champ date du navigateur)', () => {
  it('sont lues en heure LOCALE, sans décalage d\u2019un jour', () => {
    const d = dateLocale('2026-09-23')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 23])
  })
  it('renvoient null si vides', () => {
    expect(dateLocale('')).toBeNull()
  })
})

describe('Envoi en retard', () => {
  it('est en retard si la date d\u2019arrivée prévue est dépassée', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 25, 12))
    expect(estEnRetard({ statut: 'en_route', date_arrivee_estimee: '2026-09-20' })).toBe(true)
  })
  it('n\u2019est PAS en retard le jour même de l\u2019arrivée prévue', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 25, 18))
    expect(estEnRetard({ statut: 'en_route', date_arrivee_estimee: '2026-09-25' })).toBe(false)
  })
  it('n\u2019est jamais en retard une fois reçu, ou sans date prévue', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 25))
    expect(estEnRetard({ statut: 'recu', date_arrivee_estimee: '2026-09-01' })).toBe(false)
    expect(estEnRetard({ statut: 'en_route', date_arrivee_estimee: null })).toBe(false)
  })
})

describe('Total des pièces', () => {
  it('additionne les quantités (envoyées par défaut, ou reçues)', () => {
    const lignes = [{ quantite_envoyee: 10, quantite_recue: 8 }, { quantite_envoyee: 5, quantite_recue: 5 }]
    expect(totalPieces(lignes)).toBe(15)
    expect(totalPieces(lignes, 'quantite_recue')).toBe(13)
  })
  it('compte 0 pour une quantité vide et supporte une liste vide', () => {
    expect(totalPieces([{ quantite_recue: null }], 'quantite_recue')).toBe(0)
    expect(totalPieces()).toBe(0)
  })
})

describe('Motifs d\u2019écart', () => {
  it('traduit le code en libellé', () => {
    expect(labelMotif('abime')).toBe('Abîmé')
  })
})

describe('Messages d\u2019erreur des guichets', () => {
  it('traduit un code de la base en phrase qui dit quoi faire', () => {
    expect(messageErreur({ message: 'ENVOI_VIDE' })).toMatch(/Ajoute au moins un produit/)
  })
  it('reconnaît une coupure réseau', () => {
    expect(messageErreur({ message: 'TypeError: Failed to fetch' })).toMatch(/connexion internet/)
  })
  it('ne plante pas sur une erreur inconnue ou vide', () => {
    expect(messageErreur({ message: 'BIZARRE' })).toMatch(/BIZARRE/)
    expect(messageErreur(null)).toMatch(/inconnue/)
  })
  it('demande un rechargement quand un collègue a agi entre-temps', () => {
    expect(erreurNecessiteRechargement({ message: 'DEJA_RECU' })).toBe(true)
    expect(erreurNecessiteRechargement({ message: 'MOTIF_OBLIGATOIRE' })).toBe(false)
  })
})
