/* ─────────── lib/achats.js ───────────
   Espace étranger, onglet "À acheter" : on regroupe les lignes de commande
   par PRODUIT, pour acheter "20 robes" d'un coup plutôt que 7 petites lignes.
*/

/* lignes = résultat de lignes_a_acheter().
   Renvoie un groupe par produit_id :
   { produit_id, nom, categorie, images, prix_achat,
     total (somme des quantités), relancee (une ligne au moins a relance_le),
     plusAncienne (plus petite confirmee_le, ou null), lignes }
   Tri : groupes relancés d'abord, puis le plus ancien d'abord
   (sans date = en dernier). */
export function regrouperParProduit(lignes = []) {
  const groupes = new Map()

  for (const ligne of lignes) {
    let groupe = groupes.get(ligne.produit_id)
    if (!groupe) {
      groupe = {
        produit_id: ligne.produit_id,
        nom: ligne.nom,
        categorie: ligne.categorie,
        images: ligne.images,
        prix_achat: ligne.prix_achat,
        total: 0,
        relancee: false,
        plusAncienne: null,
        lignes: [],
      }
      groupes.set(ligne.produit_id, groupe)
    }

    groupe.total += Number(ligne.quantite) || 0
    if (ligne.relance_le) groupe.relancee = true
    if (ligne.confirmee_le && (!groupe.plusAncienne || new Date(ligne.confirmee_le) < new Date(groupe.plusAncienne))) {
      groupe.plusAncienne = ligne.confirmee_le
    }
    groupe.lignes.push(ligne)
  }

  const temps = (g) => (g.plusAncienne ? new Date(g.plusAncienne).getTime() : Infinity)
  return [...groupes.values()].sort((a, b) => {
    if (a.relancee !== b.relancee) return a.relancee ? -1 : 1
    if (temps(a) === temps(b)) return 0
    return temps(a) < temps(b) ? -1 : 1
  })
}
