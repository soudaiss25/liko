'use client'

/* ─────────── components/admin/FormulaireProduit.js ───────────
   Formulaire d'ajout / de modification d'un produit (photos comprises).

   Utilisation :
     <FormulaireProduit produit={null} … />   → nouveau produit
     <FormulaireProduit produit={p} … />      → modification de p
     onAnnuler()      → appelé quand on quitte sans enregistrer
     onEnregistre()   → appelé après un enregistrement réussi

   Prix de gros :
   - dans le formulaire, on saisit le prix d'UNE pièce quand on achète le lot
   - en base, on enregistre le prix TOTAL du lot (prix_gros = pièce × nb)
*/

import { useState } from 'react'
import { ArrowLeft, X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import Icone from '@/components/ui/Icone'
import { envoyerPhotoProduit } from '@/lib/photos'
import { CATEGORIES, ORIGINES, formatKMF, prixPieceEnLot } from '@/lib/produit'

import { C } from '@/lib/theme'
const MAX_PHOTOS = 5

/* Transforme un produit de la base en valeurs de formulaire */
function versFormulaire(p) {
  if (!p) {
    return {
      nom: '', description: '', categorie: CATEGORIES[0], origine: ORIGINES[0],
      prix_detail: '', avecGros: false, prix_piece_lot: '', qte_min_gros: '',
      prix_achat: '', actif: true, images: [],
    }
  }
  return {
    nom: p.nom || '',
    description: p.description || '',
    categorie: p.categorie || CATEGORIES[0],
    origine: p.origine || ORIGINES[0],
    prix_detail: p.prix_detail ?? '',
    avecGros: !!p.prix_gros,
    // En base on a le total du lot → on le repasse en prix par pièce pour le formulaire
    prix_piece_lot: prixPieceEnLot(p) ?? '',
    qte_min_gros: p.qte_min_gros ?? '',
    prix_achat: p.prix_achat ?? '',
    actif: p.actif,
    images: p.images || [],
  }
}

export default function FormulaireProduit({ produit, onAnnuler, onEnregistre }) {
  const supabase = createClient()

  const [form, setForm] = useState(() => versFormulaire(produit))
  const [erreur, setErreur] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [uploadEnCours, setUploadEnCours] = useState(0) // nb de photos en cours d'envoi

  /* ── Calculs du lot, refaits à chaque frappe (affichage en direct) ── */
  const prixUnite = Number(form.prix_detail) || 0
  const nbLot = Number(form.qte_min_gros) || 0
  const pieceLot = Number(form.prix_piece_lot) || 0
  const totalLot = nbLot * pieceLot
  const economieLot = nbLot * prixUnite - totalLot
  const lotIncoherent = pieceLot > 0 && prixUnite > 0 && pieceLot >= prixUnite

  /* ── Photos : ajout (compressée puis envoyée tout de suite) ── */
  const ajouterPhotos = async (e) => {
    const fichiers = Array.from(e.target.files || [])
    e.target.value = '' // permet de re-choisir la même photo plus tard
    if (fichiers.length === 0) return

    const placesRestantes = MAX_PHOTOS - form.images.length
    const aEnvoyer = fichiers.slice(0, placesRestantes)
    if (fichiers.length > placesRestantes) {
      setErreur(`${MAX_PHOTOS} photos maximum par produit : seules les ${placesRestantes} premières sont ajoutées.`)
    } else {
      setErreur('')
    }

    for (const fichier of aEnvoyer) {
      setUploadEnCours((n) => n + 1)
      try {
        const url = await envoyerPhotoProduit(supabase, fichier)
        // forme "fonction" de setForm : on part toujours de la dernière version du formulaire
        setForm((f) => ({ ...f, images: [...f.images, url] }))
      } catch (err) {
        setErreur(`La photo « ${fichier.name} » n'a pas pu être envoyée : ${err.message}`)
      } finally {
        setUploadEnCours((n) => n - 1)
      }
    }
  }

  /* On retire seulement l'adresse (pas le fichier) : si tu annules,
     le produit garde ses photos intactes. */
  const retirerPhoto = (url) => {
    setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }))
  }

  const mettrePrincipale = (url) => {
    setForm((f) => ({ ...f, images: [url, ...f.images.filter((u) => u !== url)] }))
  }

  /* ── Enregistrement ── */
  const enregistrer = async () => {
    if (!form.nom.trim()) { setErreur('Le nom du produit est requis.'); return }
    if (prixUnite <= 0) { setErreur('Indique un prix à l\u2019unité valide.'); return }
    if (form.avecGros) {
      if (nbLot < 2) { setErreur('Un lot contient au moins 2 pièces.'); return }
      if (pieceLot <= 0) { setErreur('Indique le prix d\u2019une pièce quand on achète le lot.'); return }
      if (lotIncoherent) {
        setErreur('Le prix par pièce en lot doit être plus bas que le prix à l\u2019unité, sinon le lot n\u2019a aucun intérêt pour le client.')
        return
      }
    }
    if (uploadEnCours > 0) { setErreur('Attends la fin de l\u2019envoi des photos.'); return }

    setEnvoi(true)
    setErreur('')

    const payload = {
      nom: form.nom.trim(),
      description: form.description.trim() || null,
      categorie: form.categorie,
      origine: form.origine,
      prix_detail: prixUnite,
      prix_gros: form.avecGros ? totalLot : null,       // TOTAL du lot en base
      qte_min_gros: form.avecGros ? nbLot : null,
      prix_achat: form.prix_achat ? Number(form.prix_achat) : null,
      actif: form.actif,
      images: form.images,
    }

    const { error } = produit
      ? await supabase.from('produits').update(payload).eq('id', produit.id)
      : await supabase.from('produits').insert(payload)

    if (error) {
      setErreur("Erreur lors de l'enregistrement : " + error.message)
      setEnvoi(false)
      return
    }

    setEnvoi(false)
    onEnregistre()
  }

  return (
    <section className="fp-wrap" aria-labelledby="titre-form">
      <style href="admin-formulaire" precedence="default">{css}</style>

      <div className="page-head">
        <h1 id="titre-form" className="page-title">{produit ? 'Modifier le produit' : 'Nouveau produit'}</h1>
        <button onClick={onAnnuler} className="btn-secondary"><Icone icone={ArrowLeft} taille={18} /> Retour à la liste</button>
      </div>

      <div className="fp-card">

        {/* ── Photos ── en premier : c'est ce que le client voit d'abord */}
        <div className="field">
          <span className="label">
            Photos <span className="optional">— {form.images.length}/{MAX_PHOTOS}, la 1re est affichée dans le catalogue</span>
          </span>

          <div className="fp-photos">
            {form.images.map((url, i) => (
              <div key={url} className={`fp-photo ${i === 0 ? 'fp-photo-principale' : ''}`}>
                <img src={url} alt={`Photo ${i + 1} du produit`} />
                {i === 0 ? (
                  <span className="fp-photo-badge">Principale</span>
                ) : (
                  <button type="button" onClick={() => mettrePrincipale(url)} className="fp-photo-star">
                    Mettre en 1re
                  </button>
                )}
                <button type="button" onClick={() => retirerPhoto(url)} className="fp-photo-remove"
                  aria-label={`Retirer la photo ${i + 1}`}>
                  <Icone icone={X} taille={18} />
                </button>
              </div>
            ))}

            {Array.from({ length: uploadEnCours }).map((_, i) => (
              <div key={`up-${i}`} className="fp-photo fp-photo-loading" aria-live="polite">Envoi…</div>
            ))}

            {/* Un <label> qui déclenche l'input fichier caché.
                Sur téléphone, il propose l'appareil photo ou la galerie. */}
            {form.images.length + uploadEnCours < MAX_PHOTOS && (
              <label className="fp-photo fp-photo-add">
                <input type="file" accept="image/*" multiple onChange={ajouterPhotos} className="visually-hidden" />
                <span className="fp-photo-plus"><Icone icone={Plus} taille={24} /></span>
                <span>Ajouter</span>
              </label>
            )}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="nom">Nom du produit</label>
          <input id="nom" className="input" value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            placeholder="Robe d'été fleurie" />
        </div>

        <div className="field">
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" className="input textarea" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Quelques lignes pour décrire le produit…" rows={3} />
        </div>

        <div className="row">
          <div className="field">
            <label className="label" htmlFor="categorie">Catégorie</label>
            <select id="categorie" className="input" value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="origine">Origine</label>
            <select id="origine" className="input" value={form.origine}
              onChange={(e) => setForm({ ...form, origine: e.target.value })}>
              {ORIGINES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="prix_detail">Prix à l'unité (KMF)</label>
          <input id="prix_detail" className="input" type="number" value={form.prix_detail}
            onChange={(e) => setForm({ ...form, prix_detail: e.target.value })}
            placeholder="2500" />
        </div>

        <div className="field">
          <label className="checkbox-row">
            <input type="checkbox" checked={form.avecGros}
              onChange={(e) => setForm({ ...form, avecGros: e.target.checked })} />
            <span>Ce produit est aussi vendu par lot</span>
          </label>
        </div>

        {form.avecGros && (
          <div className="fp-gros">
            <div className="row">
              <div className="field">
                <label className="label" htmlFor="qte_min_gros">Nombre de pièces dans le lot</label>
                <input id="qte_min_gros" className="input" type="number" value={form.qte_min_gros}
                  onChange={(e) => setForm({ ...form, qte_min_gros: e.target.value })}
                  placeholder="10" />
              </div>
              <div className="field">
                <label className="label" htmlFor="prix_piece_lot">Prix d'une pièce dans le lot (KMF)</label>
                <input id="prix_piece_lot" className="input" type="number" value={form.prix_piece_lot}
                  onChange={(e) => setForm({ ...form, prix_piece_lot: e.target.value })}
                  placeholder="1800" />
              </div>
            </div>

            {/* Résumé calculé en direct : on voit tout de suite si c'est cohérent */}
            {nbLot > 0 && pieceLot > 0 && (
              <p className={`fp-gros-resume ${lotIncoherent ? 'fp-gros-err' : ''}`} aria-live="polite">
                {lotIncoherent ? (
                  <>{formatKMF(pieceLot)} KMF la pièce en lot, c'est plus cher ou égal au prix à l'unité ({formatKMF(prixUnite)} KMF).</>
                ) : (
                  <>
                    Lot de {nbLot} × {formatKMF(pieceLot)} KMF = <b>{formatKMF(totalLot)} KMF le lot</b>
                    {economieLot > 0 && <> · le client économise {formatKMF(economieLot)} KMF</>}
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="prix_achat">Prix d'achat <span className="optional">— usage interne, sert à calculer ta marge</span></label>
          <input id="prix_achat" className="input" type="number" value={form.prix_achat}
            onChange={(e) => setForm({ ...form, prix_achat: e.target.value })}
            placeholder="1200" />
        </div>

        <div className="field">
          <label className="checkbox-row">
            <input type="checkbox" checked={form.actif}
              onChange={(e) => setForm({ ...form, actif: e.target.checked })} />
            <span>Visible sur le site immédiatement</span>
          </label>
        </div>

        {erreur && <p role="alert" className="err">{erreur}</p>}

        <div className="fp-actions">
          <button onClick={onAnnuler} className="btn-secondary">Annuler</button>
          <button onClick={enregistrer} disabled={envoi || uploadEnCours > 0} className="btn-primary">
            {uploadEnCours > 0
              ? 'Envoi des photos…'
              : envoi
                ? 'Enregistrement…'
                : produit ? 'Enregistrer les modifications' : 'Créer le produit'}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ─────────── CSS (préfixe fp-) ─────────── */
const css = `
  .fp-wrap { max-width: 700px; }
  .fp-card { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 24px; }

  /* ── Photos ── */
  .fp-photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 12px; }
  .fp-photo {
    position: relative; aspect-ratio: 1 / 1; border-radius: 8px; overflow: hidden;
    background: ${C.sand}; border: 1.5px solid ${C.line};
  }
  .fp-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fp-photo-principale { border-color: ${C.ink}; border-width: 2px; }
  .fp-photo-badge {
    position: absolute; left: 4px; bottom: 4px;
    background: ${C.ink}; color: ${C.white}; font-size: 13px; font-weight: 700;
    padding: 4px 8px; border-radius: 6px;
  }
  .fp-photo-star {
    position: absolute; left: 4px; bottom: 4px; min-height: 32px;
    background: ${C.white}; color: ${C.inkDeep}; border: none; cursor: pointer;
    font-size: 13px; font-weight: 700; font-family: inherit; padding: 0 8px; border-radius: 6px;
  }
  .fp-photo-remove {
    position: absolute; top: 0; right: 0;
    width: 44px; height: 44px; border: none; cursor: pointer; background: transparent; color: ${C.white};
    display: flex; align-items: flex-start; justify-content: flex-end; padding: 6px;
  }
  .fp-photo-remove svg { background: rgba(20,58,75,0.8); border-radius: 50%; padding: 3px; width: 26px; height: 26px; }
  .fp-photo-remove:hover { background: ${C.clay}; }
  .fp-photo-loading {
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; color: ${C.inkSoft};
  }
  .fp-photo-add {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    border-style: dashed; border-color: ${C.inkSoft}; cursor: pointer;
    font-size: 14px; font-weight: 700; color: ${C.ink};
  }
  .fp-photo-add:hover { background: ${C.white}; border-color: ${C.ink}; }
  .fp-photo-add:focus-within { outline: 2px solid ${C.ink}; outline-offset: 2px; }
  .fp-photo-plus { display: flex; }

  /* ── Bloc lot ── */
  .fp-gros { background: ${C.bgGrey}; border: 1px solid ${C.line}; border-radius: 8px; padding: 16px 16px 4px; margin: 0 0 16px; }
  .fp-gros-resume { font-size: 15px; color: #2c6e4d; font-weight: 600; line-height: 1.5; margin: 0 0 16px; }
  .fp-gros-resume b { font-weight: 800; }
  .fp-gros-err { color: ${C.clay}; }

  .fp-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; flex-wrap: wrap; }

  @media (max-width: 700px) {
    .fp-card { padding: 16px; }
    .fp-photos { grid-template-columns: repeat(3, 1fr); }
  }
`