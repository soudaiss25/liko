import { describe, it, expect, vi, afterEach } from 'vitest'
import { cheminDepuisUrl, supprimerPhotosProduit, compresserImage, envoyerPhotoProduit } from '@/lib/photos'

const URL_PHOTO = 'https://xyz.supabase.co/storage/v1/object/public/produits/1790-abc.webp'

afterEach(() => vi.restoreAllMocks())

/* ─── Faux navigateur pour la compression ───
   Les tests n'ont pas de vrai "canvas" : on en simule un qui note ce qu'on lui demande.
   formatsSupportes = les formats que le faux navigateur sait produire. */
function simulerNavigateur({ largeur, hauteur, formatsSupportes = ['image/webp', 'image/jpeg'] }) {
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
    toBlob: (rappel, type) => {
      if (formatsSupportes.length === 0) return rappel(null)
      // Un navigateur qui ne sait pas faire le format demandé renvoie du PNG
      rappel(new Blob(['x'], { type: formatsSupportes.includes(type) ? type : 'image/png' }))
    },
  }
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: largeur, height: hauteur, close: vi.fn() }))
  const creerOriginal = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag) => (tag === 'canvas' ? canvas : creerOriginal(tag)))
  return canvas
}

describe('Compression des photos avant envoi', () => {
  it('réduit une grande photo à 1200 px sur son plus grand côté, en gardant les proportions', async () => {
    const canvas = simulerNavigateur({ largeur: 4000, hauteur: 3000 })
    await compresserImage(new Blob())
    expect([canvas.width, canvas.height]).toEqual([1200, 900])
  })
  it('n\u2019agrandit JAMAIS une petite photo', async () => {
    const canvas = simulerNavigateur({ largeur: 800, hauteur: 600 })
    await compresserImage(new Blob())
    expect([canvas.width, canvas.height]).toEqual([800, 600])
  })
  it('produit du WebP (le plus léger) quand le navigateur le permet', async () => {
    simulerNavigateur({ largeur: 100, hauteur: 100 })
    expect((await compresserImage(new Blob())).type).toBe('image/webp')
  })
  it('se replie sur du JPEG sur un vieux navigateur sans WebP (jamais de PNG lourd)', async () => {
    simulerNavigateur({ largeur: 100, hauteur: 100, formatsSupportes: ['image/jpeg'] })
    expect((await compresserImage(new Blob())).type).toBe('image/jpeg')
  })
  it('signale clairement un échec de compression', async () => {
    simulerNavigateur({ largeur: 100, hauteur: 100, formatsSupportes: [] })
    await expect(compresserImage(new Blob())).rejects.toThrow('Compression impossible')
  })
})

describe('Envoi d\u2019une photo dans le stockage', () => {
  const fauxSupabase = (erreur = null) => {
    const upload = vi.fn().mockResolvedValue({ error: erreur })
    const getPublicUrl = vi.fn((chemin) => ({ data: { publicUrl: `https://x.co/storage/v1/object/public/produits/${chemin}` } }))
    return { upload, client: { storage: { from: vi.fn(() => ({ upload, getPublicUrl })) } } }
  }

  it('envoie la photo compressée et renvoie son adresse publique', async () => {
    simulerNavigateur({ largeur: 100, hauteur: 100 })
    const { client, upload } = fauxSupabase()
    const url = await envoyerPhotoProduit(client, new Blob())
    const [chemin, , options] = upload.mock.calls[0]
    expect(chemin).toMatch(/^\d+-[a-z0-9]+\.webp$/)            // nom unique, extension cohérente
    expect(options.cacheControl).toBe('31536000')              // mise en cache 1 an
    expect(url).toMatch(/\/produits\/\d+-[a-z0-9]+\.webp$/)
  })
  it('donne un nom de fichier .jpg quand la photo est en JPEG', async () => {
    simulerNavigateur({ largeur: 100, hauteur: 100, formatsSupportes: ['image/jpeg'] })
    const { client, upload } = fauxSupabase()
    await envoyerPhotoProduit(client, new Blob())
    expect(upload.mock.calls[0][0]).toMatch(/\.jpg$/)
  })
  it('remonte l\u2019erreur si le stockage refuse (ex : pas les droits admin)', async () => {
    simulerNavigateur({ largeur: 100, hauteur: 100 })
    const { client } = fauxSupabase(new Error('new row violates row-level security policy'))
    await expect(envoyerPhotoProduit(client, new Blob())).rejects.toThrow(/row-level security/)
  })
})

describe('Chemin d\u2019une photo dans le stockage', () => {
  it('retrouve le nom du fichier depuis son adresse publique', () => {
    expect(cheminDepuisUrl(URL_PHOTO)).toBe('1790-abc.webp')
  })
  it('renvoie null pour une adresse qui n\u2019est pas dans notre stockage', () => {
    expect(cheminDepuisUrl('https://autre-site.com/photo.jpg')).toBeNull()
    expect(cheminDepuisUrl(undefined)).toBeNull()
  })
})

describe('Suppression des photos d\u2019un produit', () => {
  const fauxSupabase = () => {
    const remove = vi.fn().mockResolvedValue({})
    return { remove, client: { storage: { from: vi.fn(() => ({ remove })) } } }
  }

  it('supprime tous les fichiers d\u2019un coup', async () => {
    const { client, remove } = fauxSupabase()
    await supprimerPhotosProduit(client, [URL_PHOTO, URL_PHOTO.replace('abc', 'def')])
    expect(client.storage.from).toHaveBeenCalledWith('produits')
    expect(remove).toHaveBeenCalledWith(['1790-abc.webp', '1790-def.webp'])
  })
  it('ignore les adresses étrangères et ne fait rien s\u2019il n\u2019y a rien à supprimer', async () => {
    const { client, remove } = fauxSupabase()
    await supprimerPhotosProduit(client, ['https://autre-site.com/x.jpg'])
    await supprimerPhotosProduit(client)
    expect(remove).not.toHaveBeenCalled()
  })
})
