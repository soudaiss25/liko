import { describe, it, expect } from 'vitest'
import { joursDepuis, texteDepuis } from '@/lib/commandes'

const MAINTENANT = new Date('2026-09-20T12:00:00Z')

describe('Jours écoulés', () => {
  it('compte les jours entiers', () => {
    expect(joursDepuis('2026-09-14T12:00:00Z', MAINTENANT)).toBe(6)
    expect(joursDepuis('2026-09-14T18:00:00Z', MAINTENANT)).toBe(5)
  })
  it('ne renvoie jamais un nombre négatif (date dans le futur)', () => {
    expect(joursDepuis('2026-09-25T12:00:00Z', MAINTENANT)).toBe(0)
  })
  it('renvoie null sans date', () => {
    expect(joursDepuis(null, MAINTENANT)).toBeNull()
    expect(joursDepuis(undefined, MAINTENANT)).toBeNull()
  })
})

describe('Texte "depuis"', () => {
  it('dit aujourd’hui, hier, ou il y a N jours', () => {
    expect(texteDepuis('2026-09-20T08:00:00Z', MAINTENANT)).toBe('aujourd’hui')
    expect(texteDepuis('2026-09-19T08:00:00Z', MAINTENANT)).toBe('hier')
    expect(texteDepuis('2026-09-14T12:00:00Z', MAINTENANT)).toBe('il y a 6 jours')
  })
  it('renvoie un texte vide sans date', () => {
    expect(texteDepuis(null, MAINTENANT)).toBe('')
  })
  it('ne dit jamais "il y a -3 jours"', () => {
    expect(texteDepuis('2026-09-23T12:00:00Z', MAINTENANT)).toBe('aujourd’hui')
  })
})
