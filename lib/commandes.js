/* ─────────── lib/commandes.js ───────────
   Tout ce qui est partagé autour des commandes : les étapes, les libellés,
   les messages d'erreur, les liens de suivi et les messages WhatsApp.
   Utilisé par la page de commande, le suivi, "Mes commandes" et l'admin.
*/

import { formatKMF } from '@/lib/produit'

/* ─────────── Étapes du parcours, dans l'ordre ───────────
   titre  = ce que voit le client
   detail = ce que ça veut dire pour lui, en une phrase */
export const ETAPES = [
  { id: 'recue', titre: 'Commande reçue', detail: 'Nous allons t\u2019appeler pour la confirmer.' },
  { id: 'confirmee', titre: 'Confirmée', detail: 'Ta commande est validée, l\u2019achat va commencer.' },
  { id: 'en_achat', titre: 'Achat en cours', detail: 'Nous achetons tes produits chez le fournisseur.' },
  { id: 'expediee', titre: 'Expédiée', detail: 'Tes produits voyagent vers les Comores.' },
  { id: 'arrivee', titre: 'Arrivée aux Comores', detail: 'Nous préparons ta livraison.' },
  { id: 'en_livraison', titre: 'En livraison', detail: 'Le livreur est en route. Garde ton téléphone près de toi.' },
  { id: 'livree', titre: 'Livrée', detail: 'Merci pour ta commande !' },
]

export const STATUTS_COMMANDE = {
  recue: { label: 'À confirmer', ton: 'or' },
  confirmee: { label: 'Confirmée', ton: 'bleu' },
  en_achat: { label: 'Achat en cours', ton: 'bleu' },
  expediee: { label: 'Expédiée', ton: 'bleu' },
  arrivee: { label: 'Arrivée aux Comores', ton: 'bleu' },
  en_livraison: { label: 'En livraison', ton: 'bleu' },
  livree: { label: 'Livrée', ton: 'vert' },
  echec_livraison: { label: 'Livraison ratée', ton: 'rouge' },
  annulee: { label: 'Annulée', ton: 'gris' },
}

/* Index de l'étape atteinte (pour colorer la frise). Les statuts "hors parcours"
   (échec, annulée) sont positionnés sur la dernière étape réellement atteinte. */
export function indexEtape(statut, etapesDatees = {}) {
  const i = ETAPES.findIndex((e) => e.id === statut)
  if (i >= 0) return i
  if (statut === 'echec_livraison') return ETAPES.findIndex((e) => e.id === 'en_livraison')
  // Annulée : on remonte à la dernière étape qui a une date
  let dernier = 0
  ETAPES.forEach((e, idx) => { if (etapesDatees[e.id]) dernier = idx })
  return dernier
}

export const ILES = [
  { valeur: 'Grande Comore', label: 'Grande Comore', aussi: 'Ngazidja' },
  { valeur: 'Anjouan', label: 'Anjouan', aussi: 'Ndzuani' },
  { valeur: 'Moheli', label: 'Mohéli', aussi: 'Mwali' },
]
export const labelIle = (v) => ILES.find((i) => i.valeur === v)?.label || v

/* Indicatifs proposés (le plus courant en premier) */
export const INDICATIFS = [
  { code: '+269', pays: 'Comores' },
  { code: '+262', pays: 'Mayotte / La Réunion' },
  { code: '+33', pays: 'France' },
  { code: '+255', pays: 'Tanzanie' },
  { code: '+261', pays: 'Madagascar' },
]

/* Moyens de paiement acceptés pour une avance (ou un remboursement) */
export const MOYENS_PAIEMENT = {
  especes: 'Espèces',
  huri_money: 'Huri Money',
  mvola: 'MVola',
}

/* "CMD-0012" */
export const referenceCommande = (numero) => `CMD-${String(numero ?? 0).padStart(4, '0')}`

export const formatDate = (valeur, avecHeure = false) =>
  valeur
    ? new Date(valeur).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric',
        ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : ''

/* ─────────── Délais ─────────── */
const MS_PAR_JOUR = 86400000

/* Nombre de jours entiers écoulés depuis une date (jamais négatif), ou null si pas de date */
export function joursDepuis(date, maintenant = new Date()) {
  if (!date) return null
  return Math.max(0, Math.floor((maintenant - new Date(date)) / MS_PAR_JOUR))
}

/* "aujourd'hui" · "hier" · "il y a 6 jours" ('' si pas de date) */
export function texteDepuis(date, maintenant = new Date()) {
  const jours = joursDepuis(date, maintenant)
  if (jours === null) return ''
  if (jours === 0) return 'aujourd’hui'
  if (jours === 1) return 'hier'
  return `il y a ${jours} jours`
}

/* ─────────── Liens ─────────── */
export const lienSuivi = (code) =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/suivi/${code}`

/* Lien qui ouvre WhatsApp avec le message déjà écrit.
   Le numéro doit être au format international : "+269 333 44 55" → "2693334455" */
export function lienWhatsApp(telephone, texte) {
  const numero = String(telephone || '').replace(/\D/g, '')
  return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`
}

/* Message WhatsApp prêt à envoyer au client, adapté à l'étape de sa commande */
export function messageWhatsAppClient(commande) {
  const prenom = (commande.client?.nom || '').split(' ')[0] || ''
  const ref = referenceCommande(commande.numero)
  const suivi = commande.code_suivi ? `\n\nSuis ta commande ici : ${lienSuivi(commande.code_suivi)}` : ''
  const bonjour = `Bonjour ${prenom},`.replace(' ,', ',')

  const corps = {
    recue: `${bonjour} merci pour ta commande ${ref} (${formatKMF(commande.montant_total)} KMF). Nous t'appelons pour la confirmer : es-tu disponible ?`,
    confirmee: `${bonjour} ta commande ${ref} est confirmée. Nous lançons l'achat de tes produits.`,
    en_achat: `${bonjour} l'achat de ta commande ${ref} est en cours.`,
    expediee: `${bonjour} ta commande ${ref} est expédiée vers les Comores.`,
    arrivee: `${bonjour} bonne nouvelle : ta commande ${ref} est arrivée aux Comores ! Nous te contactons pour la livraison.`,
    en_livraison: `${bonjour} ta commande ${ref} est en route. Prépare ${formatKMF(commande.montant_total)} KMF, paiement à la réception.`,
    livree: `${bonjour} merci pour ton achat ! Ta commande ${ref} est livrée.`,
    echec_livraison: `${bonjour} nous n'avons pas pu livrer ta commande ${ref}. Quand es-tu disponible ?`,
    annulee: `${bonjour} ta commande ${ref} a été annulée.`,
  }[commande.statut] || `${bonjour} au sujet de ta commande ${ref}.`

  return corps + suivi
}

/* ─────────── Commandes suivies sur CET appareil ───────────
   Un client sans compte retrouve ses commandes sur le même téléphone,
   même s'il a perdu son lien de suivi. */
const CLE_SUIVIS = 'salut_mes_suivis'

export function memoriserSuivi(code) {
  try {
    const liste = JSON.parse(localStorage.getItem(CLE_SUIVIS) || '[]')
    if (!liste.includes(code)) localStorage.setItem(CLE_SUIVIS, JSON.stringify([code, ...liste].slice(0, 30)))
  } catch { /* stockage indisponible (mode privé…) : pas grave */ }
}

export function suivisMemorises() {
  try { return JSON.parse(localStorage.getItem(CLE_SUIVIS) || '[]') } catch { return [] }
}

/* ─────────── Messages d'erreur ───────────
   La base renvoie des codes courts ; on les traduit en phrases qui disent quoi faire. */
const MESSAGES = {
  PANIER_VIDE: 'Ton panier est vide.',
  PANIER_TROP_GRAND: 'Ton panier contient trop d\u2019articles différents (50 maximum).',
  PANIER_INVALIDE: 'Ton panier contient un article invalide. Vide-le et ajoute à nouveau tes produits.',
  PRENOM_MANQUANT: 'Indique ton prénom.',
  TELEPHONE_INVALIDE: 'Vérifie ton numéro de téléphone : nous en avons besoin pour confirmer la commande.',
  EMAIL_INVALIDE: 'Cette adresse e-mail n\u2019est pas valide (tu peux aussi la laisser vide).',
  ILE_INVALIDE: 'Choisis ton île de livraison.',
  ADRESSE_MANQUANTE: 'Précise ton adresse : quartier et un repère connu.',
  QUANTITE_INVALIDE: 'Une quantité de ton panier n\u2019est pas valide.',
  TROP_DE_COMMANDES_EN_ATTENTE: 'Tu as déjà 3 commandes en attente de confirmation avec ce numéro. Nous t\u2019appelons très vite pour les valider.',
  COMMANDE_INTROUVABLE: 'Cette commande est introuvable. Vérifie le lien de suivi.',
  ANNULATION_IMPOSSIBLE: 'Cette commande est déjà confirmée : pour l\u2019annuler, contacte-nous.',
  ACCES_REFUSE: 'Ton compte n\u2019a pas le droit de faire cette action.',
  APPEL_NON_CONFIRME: 'Coche « Client joint par téléphone » avant de confirmer.',
  DEJA_TRAITEE: 'Cette commande a déjà été traitée. La liste va se mettre à jour.',
  MOTIF_OBLIGATOIRE: 'Indique la raison.',
  DEJA_LIVREE: 'Cette commande est déjà livrée : elle ne peut plus être annulée.',
  DEJA_ANNULEE: 'Cette commande est déjà annulée.',
  DERNIERE_LIGNE: 'C\u2019est le dernier produit de la commande : annule plutôt la commande entière.',
  LIGNE_EN_ROUTE: 'Ce produit est en route vers les Comores : attends son arrivée pour le retirer.',
  COMMANDE_VERROUILLEE: 'La commande est trop avancée pour cette action.',
  DEJA_RETIREE: 'Ce produit a déjà été retiré.',
  PAS_INDISPONIBLE: 'Ce produit n\u2019est pas marqué indisponible.',
  LIGNE_INTROUVABLE: 'Ce produit n\u2019existe plus dans la commande. Actualise la page.',
  DEJA_EXPEDIEE: 'Un produit de cette commande est d\u00e9j\u00e0 parti vers les Comores : l\u2019annulation n\u2019est plus possible. En cas de refus, utilise \u00ab \u00c9chec de livraison \u00bb.',
  RELANCE_IMPOSSIBLE: 'On ne peut relancer l\u2019achat que pour une commande confirm\u00e9e et pas encore exp\u00e9di\u00e9e.',
  DEJA_RELANCEE: 'Cette commande a d\u00e9j\u00e0 \u00e9t\u00e9 relanc\u00e9e il y a moins de 24 h.',
  PAS_PRETE: 'Cette commande n\u2019est pas encore arriv\u00e9e aux Comores.',
  PAS_EN_LIVRAISON: 'Cette commande n\u2019est pas en cours de livraison. Actualise la page.',
  MONTANT_INVALIDE: 'Indique le montant encaiss\u00e9 (0 si rien n\u2019a \u00e9t\u00e9 pay\u00e9).',
  NOTE_OBLIGATOIRE: 'Le montant encaiss\u00e9 est diff\u00e9rent du total : explique pourquoi.',
  TROP_DE_COMMANDES: 'Trop de commandes \u00e0 la fois (50 maximum).',
  AVANCE_INCOMPLETE: 'L\u2019avance n\u2019est pas encore compl\u00e8te : enregistre-la avant de confirmer.',
  AVANCE_TROP_ELEVEE: 'Ce montant d\u00e9passe l\u2019avance restant due.',
  AVANCE_HORS_DELAI: 'L\u2019avance s\u2019enregistre avant la confirmation de la commande.',
  PAS_D_AVANCE: 'Cette commande ne demande pas d\u2019avance.',
  REFERENCE_OBLIGATOIRE: 'Indique la r\u00e9f\u00e9rence de la transaction mobile money.',
  MOYEN_INVALIDE: 'Choisis un moyen de paiement.',
  AVANCE_DEJA_PAYEE: 'Une avance a d\u00e9j\u00e0 \u00e9t\u00e9 pay\u00e9e : contacte-nous sur WhatsApp pour annuler.',
  RIEN_A_REMBOURSER: 'Il n\u2019y a rien \u00e0 rembourser sur cette commande.',
  REMBOURSEMENT_TROP_ELEVE: 'Ce montant d\u00e9passe ce qui reste \u00e0 rembourser.',
}

export function messageErreurCommande(error) {
  const texte = error?.message || ''
  // Erreurs avec un nom de produit : "PRODUIT_INDISPONIBLE:Robe d'été"
  const produit = texte.match(/PRODUIT_INDISPONIBLE:(.*)$/)
  if (produit) return `« ${produit[1]} » n\u2019est plus disponible. Retire-le de ton panier pour continuer.`
  const lot = texte.match(/LOT_INDISPONIBLE:(.*)$/)
  if (lot) return `« ${lot[1]} » n\u2019est plus vendu par lot. Retire-le de ton panier et ajoute-le à l\u2019unité.`

  const code = Object.keys(MESSAGES).find((c) => texte.includes(c))
  if (code) return MESSAGES[code]
  if (/fetch|network/i.test(texte)) return 'Pas de connexion internet. Vérifie ta connexion et réessaie.'
  return `Une erreur est survenue : ${texte || 'inconnue'}`
}