import { describe, it, expect, beforeEach } from 'vitest'
import {
  indexEtape, referenceCommande, labelIle, lienWhatsApp, messageWhatsAppClient,
  memoriserSuivi, suivisMemorises, messageErreurCommande,
} from '@/lib/commandes'

describe('Position dans la frise de suivi', () => {
  it('place chaque statut du parcours sur son étape', () => {
    expect(indexEtape('recue')).toBe(0)
    expect(indexEtape('livree')).toBe(6)
  })
  it('place un échec de livraison sur l\u2019étape "En livraison"', () => {
    expect(indexEtape('echec_livraison')).toBe(5)
  })
  it('place une commande annulée sur la DERNIÈRE étape réellement atteinte', () => {
    const etapes = { recue: '2026-09-01', confirmee: '2026-09-02' }
    expect(indexEtape('annulee', etapes)).toBe(1)
  })
})

describe('Références et libellés', () => {
  it('formate le numéro de commande', () => {
    expect(referenceCommande(12)).toBe('CMD-0012')
  })
  it('affiche Mohéli avec son accent', () => {
    expect(labelIle('Moheli')).toBe('Mohéli')
    expect(labelIle('Inconnue')).toBe('Inconnue')
  })
})

describe('Lien WhatsApp "un clic"', () => {
  it('ne garde que les chiffres du numéro (format exigé par wa.me)', () => {
    expect(lienWhatsApp('+269 333 44 55', 'Salut')).toBe('https://wa.me/2693334455?text=Salut')
  })
  it('encode le message (accents, espaces, retours à la ligne)', () => {
    const lien = lienWhatsApp('+2693334455', 'Ta commande est arrivée !\nMerci')
    expect(decodeURIComponent(lien.split('text=')[1])).toBe('Ta commande est arrivée !\nMerci')
  })
})

describe('Message WhatsApp adapté à l\u2019étape', () => {
  const base = { numero: 12, montant_total: 44000, client: { nom: 'Fatima Said' }, code_suivi: 'abc' }

  it('salue le client par son prénom et cite la commande', () => {
    const m = messageWhatsAppClient({ ...base, statut: 'confirmee' })
    expect(m).toMatch(/^Bonjour Fatima,/)
    expect(m).toMatch(/CMD-0012/)
  })
  it('rappelle le montant à préparer quand le livreur part', () => {
    expect(messageWhatsAppClient({ ...base, statut: 'en_livraison' })).toMatch(/44\s000 KMF/)
  })
  it('joint le lien de suivi', () => {
    expect(messageWhatsAppClient({ ...base, statut: 'expediee' })).toMatch(/\/suivi\/abc/)
  })
  it('reste poli même sans nom de client', () => {
    expect(messageWhatsAppClient({ ...base, client: null, statut: 'recue' })).toMatch(/^Bonjour,/)
  })
})

describe('Commandes suivies sur cet appareil (client sans compte)', () => {
  beforeEach(() => localStorage.clear())

  it('mémorise un lien de suivi, le plus récent en premier', () => {
    memoriserSuivi('aaa'); memoriserSuivi('bbb')
    expect(suivisMemorises()).toEqual(['bbb', 'aaa'])
  })
  it('ne crée pas de doublon', () => {
    memoriserSuivi('aaa'); memoriserSuivi('aaa')
    expect(suivisMemorises()).toEqual(['aaa'])
  })
  it('garde au maximum 30 commandes', () => {
    for (let i = 0; i < 35; i++) memoriserSuivi(`code${i}`)
    expect(suivisMemorises()).toHaveLength(30)
    expect(suivisMemorises()[0]).toBe('code34')
  })
  it('ne plante pas si le stockage contient n\u2019importe quoi', () => {
    localStorage.setItem('salut_mes_suivis', '{cassé')
    expect(suivisMemorises()).toEqual([])
  })
})

describe('Messages d\u2019erreur de commande', () => {
  it('nomme le produit devenu indisponible', () => {
    expect(messageErreurCommande({ message: 'PRODUIT_INDISPONIBLE:Robe d\u2019été' })).toMatch(/« Robe d’été »/)
  })
  it('explique la limite anti-abus', () => {
    expect(messageErreurCommande({ message: 'TROP_DE_COMMANDES_EN_ATTENTE' })).toMatch(/3 commandes en attente/)
  })
  it('reconnaît une coupure réseau', () => {
    expect(messageErreurCommande({ message: 'fetch failed' })).toMatch(/connexion internet/)
  })
})
