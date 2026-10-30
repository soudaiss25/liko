/* ─────────── lib/config.js ───────────
   Réglages de la boutique, à un seul endroit.
*/

/* Numéro WhatsApp du service client, au format international (le "+" est facultatif ici :
   les liens wa.me utilisent WHATSAPP_CHIFFRES, sans le "+"). Laisse vide pour cacher
   automatiquement les boutons "Écrire au service client". */
export const WHATSAPP_SERVICE = '+2693797674'

/* Le même numéro, chiffres seulement : c'est le format qu'attend wa.me ("2693797674") */
export const WHATSAPP_CHIFFRES = WHATSAPP_SERVICE.replace(/\D/g, '')

export const NOM_BOUTIQUE = 'Salut Marketplace'

/* Délai affiché au client (tous les produits sont achetés après commande) */
export const DELAI_LIVRAISON = '15 à 30 jours'

/* Numéros où le client envoie son avance (mobile money). Vides pour l'instant : l'interface
   affiche alors "numéro communiqué par notre équipe sur WhatsApp". */
export const NUMEROS_PAIEMENT = { huri_money: '', mvola: '' }
