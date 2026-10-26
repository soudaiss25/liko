import { describe, it, expect, vi } from 'vitest'
import { ipClient, limiter } from '@/lib/limiteur'

const requete = (entetes = {}) => ({ headers: { get: (n) => entetes[n.toLowerCase()] ?? null } })

describe('Adresse IP du visiteur', () => {
  it('prend le premier élément de x-forwarded-for', () => {
    expect(ipClient(requete({ 'x-forwarded-for': ' 41.79.1.2 , 10.0.0.1' }))).toBe('41.79.1.2')
  })
  it('renvoie "inconnue" sans en-tête ou avec un en-tête vide', () => {
    expect(ipClient(requete())).toBe('inconnue')
    expect(ipClient(requete({ 'x-forwarded-for': '  ' }))).toBe('inconnue')
  })
})

describe('Limiteur de requêtes', () => {
  const faux = (reponse) => ({ rpc: vi.fn().mockResolvedValue(reponse) })

  it('appelle verifier_limite avec la clé, le maximum et la fenêtre', async () => {
    const db = faux({ data: true, error: null })
    await limiter(db, 'login:ip:1.2.3.4', 20, 900)
    expect(db.rpc).toHaveBeenCalledWith('verifier_limite', { p_cle: 'login:ip:1.2.3.4', p_max: 20, p_fenetre_secondes: 900 })
  })
  it('renvoie true quand c\u2019est autorisé et false quand la limite est atteinte', async () => {
    expect(await limiter(faux({ data: true, error: null }), 'k', 5, 60)).toBe(true)
    expect(await limiter(faux({ data: false, error: null }), 'k', 5, 60)).toBe(false)
  })
  it('laisse passer (true) et journalise si la base renvoie une erreur', async () => {
    const espion = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await limiter(faux({ data: null, error: { message: 'panne' } }), 'k', 5, 60)).toBe(true)
    expect(espion).toHaveBeenCalled()
    espion.mockRestore()
  })
  it('laisse passer (true) et journalise si l\u2019appel lui-même plante', async () => {
    const espion = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = { rpc: vi.fn().mockRejectedValue(new Error('réseau')) }
    expect(await limiter(db, 'k', 5, 60)).toBe(true)
    expect(espion).toHaveBeenCalled()
    espion.mockRestore()
  })
})
