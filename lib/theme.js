/* ─────────── lib/theme.js ───────────
   La palette officielle du site : UNE seule source de vérité.
   Règle 60-30-10 : fonds neutres (white, bgGrey), bleu pétrole (ink) pour la
   structure, or (gold) UNIQUEMENT pour l'action principale d'un écran.
   clay = prix et erreurs, leaf = succès.
*/
export const C = {
  ink: '#1D4E63',       // principal (structure, liens, boutons secondaires pleins)
  inkDeep: '#143A4B',   // texte
  inkSoft: '#6E8A97',   // texte secondaire
  sand: '#F4F1EA',      // fonds de champs
  line: '#E4DED2',      // bordures
  gold: '#E8A020',      // action d'achat
  goldDeep: '#C6851A',
  leaf: '#3E9268',      // succès
  clay: '#C2574A',      // prix, erreurs
  white: '#FFFFFF',
  bgGrey: '#F2F3F5',    // fond des pages
}
