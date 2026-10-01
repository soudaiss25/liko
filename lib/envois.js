/* ─────────── lib/envois.js ───────────
   Tout ce qui est partagé entre l'espace étranger, l'espace Comores
   (et plus tard l'admin) à propos des envois.
*/

import { ORIGINES } from '@/lib/produit'

/* Pays d'où un collaborateur peut envoyer : les mêmes que les origines produits */
export const PAYS_ENVOI = ORIGINES

/* Les 4 étapes de la vie d'un envoi */
export const STATUTS_ENVOI = {
  brouillon: { label: 'Brouillon', ton: 'gris' },
  en_route: { label: 'En route', ton: 'or' },
  recu: { label: 'Reçu', ton: 'vert' },
  recu_avec_ecarts: { label: 'Reçu avec écarts', ton: 'rouge' },
}

/* Raisons possibles d'un écart entre envoyé et reçu */
export const MOTIFS_ECART = [
  { id: 'manquant', label: 'Manquant' },
  { id: 'abime', label: 'Abîmé' },
  { id: 'erreur_fournisseur', label: 'Erreur du fournisseur' },
  { id: 'surplus', label: 'Surplus (reçu en trop)' },
  { id: 'autre', label: 'Autre' },
]
export const labelMotif = (id) => MOTIFS_ECART.find((m) => m.id === id)?.label || id

/* Suggestions pour le champ transporteur (on peut aussi écrire autre chose) */
export const TRANSPORTEURS_SUGGERES = ['Fret aérien', 'Fret maritime', 'GP (voyageur)', 'DHL', 'Colis postal']

/* 7 → "ENV-0007" */
export const referenceEnvoi = (envoi) => `ENV-${String(envoi?.numero ?? 0).padStart(4, '0')}`

/* "2026-09-23" → vraie date en heure locale (sans décalage d'un jour) */
export function dateLocale(valeur) {
  if (!valeur) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    const [a, m, j] = valeur.split('-').map(Number)
    return new Date(a, m - 1, j)
  }
  return new Date(valeur)
}

/* → "23 sept." ou "—" */
export const formatDateCourte = (valeur) =>
  valeur ? dateLocale(valeur).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'

/* Un envoi en route dont la date d'arrivée prévue est dépassée */
export function estEnRetard(envoi) {
  if (envoi?.statut !== 'en_route' || !envoi.date_arrivee_estimee) return false
  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)
  return dateLocale(envoi.date_arrivee_estimee) < aujourdhui
}

/* Somme des pièces d'une liste de lignes */
export const totalPieces = (lignes = [], cle = 'quantite_envoyee') =>
  lignes.reduce((somme, l) => somme + (Number(l[cle]) || 0), 0)

/* ─────────── Messages d'erreur ───────────
   La base renvoie des codes courts (ex : ENVOI_VIDE).
   On les traduit ici en phrases qui disent QUOI FAIRE. */
const MESSAGES = {
  ACCES_REFUSE: 'Ton compte n\u2019a pas le droit de faire cette action.',
  PAYS_MANQUANT: 'Choisis le pays d\u2019où part l\u2019envoi.',
  DATES_INCOHERENTES: 'La date d\u2019arrivée prévue est avant la date de départ.',
  ENVOI_INTROUVABLE: 'Cet envoi n\u2019existe plus. Actualise la page.',
  ENVOI_VERROUILLE: 'Cet envoi est déjà parti : il ne peut plus être modifié.',
  ENVOI_VIDE: 'Ajoute au moins un produit avant de marquer l\u2019envoi comme parti.',
  TRANSPORTEUR_MANQUANT: 'Indique le transporteur avant de marquer l\u2019envoi comme parti.',
  QUANTITE_INVALIDE: 'Une quantité n\u2019est pas valide (nombre entier, au moins 1).',
  PRIX_INVALIDE: 'Un prix d\u2019achat n\u2019est pas valide.',
  PRODUIT_EN_DOUBLE: 'Un produit apparaît deux fois : regroupe les quantités sur une seule ligne.',
  PRODUIT_INTROUVABLE: 'Un produit de la liste n\u2019existe plus dans le catalogue.',
  DEJA_RECU: 'Cet envoi a déjà été réceptionné (peut-être par un collègue). La liste va se mettre à jour.',
  PAS_EN_ROUTE: 'Cet envoi n\u2019est pas encore parti : il ne peut pas être réceptionné.',
  LIGNE_MANQUANTE: 'Il manque un produit dans le comptage. Actualise la page et recommence.',
  MOTIF_OBLIGATOIRE: 'Pour chaque quantité différente de l\u2019envoi, choisis un motif.',
}

export function messageErreur(error) {
  const texte = error?.message || ''
  const code = Object.keys(MESSAGES).find((c) => texte.includes(c))
  if (code) return MESSAGES[code]
  if (/fetch|network/i.test(texte)) return 'Pas de connexion internet. Réessaie dans un instant.'
  return `Erreur inattendue : ${texte || 'inconnue'}`
}

/* Vrai si l'erreur signifie "quelqu'un d'autre a déjà agi" → il faut recharger */
export const erreurNecessiteRechargement = (error) =>
  /DEJA_RECU|ENVOI_VERROUILLE|ENVOI_INTROUVABLE|LIGNE_MANQUANTE/.test(error?.message || '')