/* ─────────── lib/photos.js ───────────
   Tout ce qui concerne les photos produits dans Supabase Storage.
   Sorti de l'admin pour pouvoir le réutiliser plus tard
   (ex : un espace vendeur qui ajoute ses propres photos).
*/

export const BUCKET_PRODUITS = 'produits'

/* Réduit la photo à 1200 px max et la convertit en WebP (ou JPEG si le
   navigateur ne sait pas faire de WebP).
   Une photo de téléphone de ~4 Mo passe à ~150 Ko → rapide à charger
   même avec une petite connexion. */
export async function compresserImage(fichier, tailleMax = 1200, qualite = 0.8) {
  const bitmap = await createImageBitmap(fichier)
  const ratio = Math.min(1, tailleMax / Math.max(bitmap.width, bitmap.height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  if (bitmap.close) bitmap.close()

  const versBlob = (type) =>
    new Promise((resolve) => canvas.toBlob(resolve, type, qualite))

  let blob = await versBlob('image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await versBlob('image/jpeg')
  if (!blob) throw new Error('Compression impossible')
  return blob
}

/* Compresse puis envoie une photo dans le bucket.
   Renvoie son adresse publique (à stocker dans produits.images). */
export async function envoyerPhotoProduit(supabase, fichier) {
  const blob = await compresserImage(fichier)
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const chemin = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

  const { error } = await supabase.storage.from(BUCKET_PRODUITS).upload(chemin, blob, {
    contentType: blob.type,
    cacheControl: '31536000', // la photo ne change jamais → le navigateur la garde en cache
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET_PRODUITS).getPublicUrl(chemin)
  return data.publicUrl
}

/* Retrouve le chemin du fichier dans le bucket à partir de son adresse publique.
   ".../storage/v1/object/public/produits/abc.webp" → "abc.webp" */
export function cheminDepuisUrl(url) {
  const repere = `/object/public/${BUCKET_PRODUITS}/`
  const i = (url || '').indexOf(repere)
  return i === -1 ? null : url.slice(i + repere.length)
}

/* Supprime du bucket les photos d'une liste d'adresses */
export async function supprimerPhotosProduit(supabase, urls = []) {
  const chemins = urls.map(cheminDepuisUrl).filter(Boolean)
  if (chemins.length > 0) await supabase.storage.from(BUCKET_PRODUITS).remove(chemins)
}