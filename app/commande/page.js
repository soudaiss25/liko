'use client'

/* ─────────── app/commande/page.js ───────────
   Tunnel de commande : AVEC ou SANS compte.

   Principes :
   - tunnel "fermé" : pas de menu ni de catalogue ici, rien qui distrait du paiement
   - une seule page, 3 blocs courts : coordonnées → livraison → paiement
   - le récapitulatif reste visible (colonne de droite sur ordinateur,
     repliable en haut sur téléphone) et le bouton de validation aussi
   - le navigateur n'envoie QUE "quels produits, combien" : les prix sont
     recalculés par la base (guichet passer_commande)
*/

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { getPanier, viderPanier, retirerDuPanier } from '@/lib/cart'
import { Check, ArrowLeft, ShoppingCart } from 'lucide-react'
import ProduitImage from '@/components/ProduitImage'
import Icone from '@/components/ui/Icone'
import EtatVide from '@/components/ui/EtatVide'
import { ChargementListe } from '@/components/ui/Squelette'
import { formatKMF } from '@/lib/produit'
import {
  ILES, INDICATIFS, referenceCommande, lienSuivi, lienWhatsApp,
  memoriserSuivi, messageErreurCommande,
} from '@/lib/commandes'
import { DELAI_LIVRAISON } from '@/lib/config'

import { C } from '@/lib/theme'
/* "+269 333 44 55" → { indicatif: '+269', numero: '333 44 55' } */
function decouperTelephone(tel) {
  if (!tel) return { indicatif: '+269', numero: '' }
  const connu = INDICATIFS.find((i) => tel.startsWith(i.code))
  return connu
    ? { indicatif: connu.code, numero: tel.slice(connu.code.length).trim() }
    : { indicatif: 'autre', numero: tel }
}

/* Reconstitue le numéro complet. On enlève le 0 de tête que beaucoup de gens
   tapent par habitude (06… en France) : +33 06… serait un numéro faux. */
function telephoneComplet(indicatif, numero) {
  const chiffres = String(numero).replace(/[^\d+]/g, '')
  if (indicatif === 'autre') return chiffres.startsWith('+') ? chiffres : `+${chiffres}`
  return indicatif + chiffres.replace(/^\+/, '').replace(/^0+/, '')
}

export default function PageCommande() {
  const supabase = createClient()

  const [chargement, setChargement] = useState(true)
  const [panier, setPanier] = useState([])       // [{ id, mode, quantite }]
  const [produits, setProduits] = useState({})   // { id: produit }
  const [frais, setFrais] = useState({})         // { Moheli: 1500, … }
  const [compte, setCompte] = useState(null)     // profil si connecté

  const [form, setForm] = useState({
    prenom: '', nom: '', indicatif: '+269', numero: '', email: '', ile: '', adresse: '',
  })
  const [erreurs, setErreurs] = useState({})     // erreurs par champ
  const [erreurGlobale, setErreurGlobale] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [resumeOuvert, setResumeOuvert] = useState(false)
  const [confirmation, setConfirmation] = useState(null) // réponse du guichet
  const [copie, setCopie] = useState(false)

  /* ── Chargement : panier, produits à jour, frais, compte ── */
  useEffect(() => {
    const charger = async () => {
      const lignes = getPanier()
      setPanier(lignes)

      const ids = [...new Set(lignes.map((l) => l.id))]
      const [resProduits, resFrais, resUser] = await Promise.all([
        ids.length
          ? supabase.from('produits').select('id, nom, categorie, images, prix_detail, prix_gros, qte_min_gros, actif').in('id', ids)
          : Promise.resolve({ data: [] }),
        supabase.rpc('frais_livraison_iles'),
        supabase.auth.getUser(),
      ])

      setProduits(Object.fromEntries((resProduits.data || []).map((p) => [p.id, p])))
      setFrais(resFrais.data || {})

      const user = resUser.data?.user
      if (user) {
        const { data } = await supabase.from('users').select('prenom, nom, telephone').eq('id', user.id).single()
        if (data) {
          setCompte(data)
          const tel = decouperTelephone(data.telephone)
          setForm((f) => ({ ...f, prenom: data.prenom || '', nom: data.nom || '', ...tel }))
        }
      }
      setChargement(false)
    }
    charger()
  }, [])

  const changer = (cle, valeur) => {
    setForm({ ...form, [cle]: valeur })
    if (erreurs[cle]) setErreurs({ ...erreurs, [cle]: '' }) // l'erreur disparaît dès qu'on corrige
  }

  /* ── Calculs d'affichage (la base refait le calcul officiel) ── */
  const lignes = panier.map((l) => {
    const p = produits[l.id]
    const indispo = !p || !p.actif || (l.mode === 'lot' && (!p.prix_gros || !p.qte_min_gros))
    const total = !p ? 0 : l.mode === 'lot' ? l.quantite * (p.prix_gros || 0) : l.quantite * p.prix_detail
    return { ...l, produit: p, indispo, total }
  })
  const lignesIndispo = lignes.filter((l) => l.indispo)
  const sousTotal = lignes.filter((l) => !l.indispo).reduce((s, l) => s + l.total, 0)
  const fraisIle = form.ile ? frais[form.ile] : undefined
  const total = sousTotal + (fraisIle || 0)
  const nbArticles = lignes.filter((l) => !l.indispo).reduce((s, l) => s + (l.mode === 'lot' ? l.quantite * (l.produit?.qte_min_gros || 1) : l.quantite), 0)

  const retirer = (l) => {
    retirerDuPanier(l.id, l.mode)
    setPanier(getPanier())
    setErreurGlobale('')
  }

  /* ── Vérification avant envoi : les mêmes règles que la base ── */
  const verifier = () => {
    const e = {}
    if (form.prenom.trim().length < 2) e.prenom = 'Indique ton prénom.'
    const tel = telephoneComplet(form.indicatif, form.numero)
    if (!/^\+\d{8,15}$/.test(tel)) e.numero = 'Numéro incomplet : nous en avons besoin pour confirmer ta commande.'
    if (form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = 'Adresse e-mail invalide (tu peux la laisser vide).'
    if (!form.ile) e.ile = 'Choisis ton île.'
    if (form.adresse.trim().length < 5) e.adresse = 'Précise ton quartier et un repère connu.'
    return e
  }

  const commander = async () => {
    if (envoi) return // anti double-clic
    setErreurGlobale('')

    if (lignesIndispo.length > 0) {
      setErreurGlobale('Retire d\u2019abord les produits qui ne sont plus disponibles.')
      return
    }
    const e = verifier()
    setErreurs(e)
    if (Object.keys(e).length > 0) {
      // On amène l'utilisateur directement sur le premier champ à corriger
      const premier = ['prenom', 'numero', 'email', 'ile', 'adresse'].find((k) => e[k])
      document.getElementById(`champ-${premier}`)?.focus()
      return
    }

    setEnvoi(true)
    const { data, error } = await supabase.rpc('passer_commande', {
      p_lignes: panier.map((l) => ({ produit_id: l.id, mode: l.mode, quantite: l.quantite })),
      p_infos: {
        prenom: form.prenom, nom: form.nom,
        telephone: telephoneComplet(form.indicatif, form.numero),
        email: form.email, ile: form.ile, adresse: form.adresse,
      },
    })
    setEnvoi(false)

    if (error) {
      setErreurGlobale(messageErreurCommande(error))
      return
    }

    viderPanier()
    memoriserSuivi(data.code_suivi)
    setConfirmation({ ...data, telephone: telephoneComplet(form.indicatif, form.numero), prenom: form.prenom.trim() })
    window.scrollTo({ top: 0 })
  }

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(lienSuivi(confirmation.code_suivi))
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      window.prompt('Copie ce lien :', lienSuivi(confirmation.code_suivi))
    }
  }

  /* ═══════════ ÉCRAN DE CONFIRMATION ═══════════ */
  if (confirmation) {
    const lien = lienSuivi(confirmation.code_suivi)
    return (
      <div className="cm-app">
        <style>{css}</style>
        <BarreTunnel />
        <main className="cm-merci">
          <div className="cm-merci-icone" aria-hidden="true"><Icone icone={Check} taille={32} /></div>
          <h1>Merci {confirmation.prenom}, ta commande est reçue</h1>
          <p className="cm-merci-ref">{referenceCommande(confirmation.numero)} · {formatKMF(confirmation.montant_total)} KMF à payer à la livraison</p>

          <div className="cm-bloc cm-prochaine">
            <h2>La suite</h2>
            <p>
              Nous t&apos;appelons au <b>{confirmation.telephone}</b> pour confirmer ta commande.
              Rien n&apos;est acheté avant cet appel.
            </p>
          </div>

          <div className="cm-bloc">
            <h2>Ton lien de suivi</h2>
            <p className="cm-aide">Garde-le : il te permet de suivre ta commande à tout moment, sans compte.</p>
            <div className="cm-lien">{lien}</div>
            <div className="cm-actions-lien">
              <button onClick={copierLien} className="cm-btn-secondaire">{copie ? <><Icone icone={Check} taille={18} /> Lien copié</> : 'Copier le lien'}</button>
              <a className="cm-btn-secondaire" target="_blank" rel="noopener noreferrer"
                href={lienWhatsApp(confirmation.telephone, `Mon suivi de commande ${referenceCommande(confirmation.numero)} : ${lien}`)}>
                M&apos;envoyer le lien sur WhatsApp
              </a>
            </div>
          </div>

          <div className="cm-merci-boutons">
            <a href={`/suivi/${confirmation.code_suivi}`} className="cm-btn-principal">Suivre ma commande</a>
            <a href="/" className="cm-lien-simple">Continuer mes achats</a>
          </div>
        </main>
      </div>
    )
  }

  /* ═══════════ CHARGEMENT / PANIER VIDE ═══════════ */
  if (chargement) {
    return (<div className="cm-app"><style>{css}</style><BarreTunnel /><div className="cm-etat"><ChargementListe nb={3} hauteur={96} /></div></div>)
  }
  if (panier.length === 0) {
    return (
      <div className="cm-app">
        <style>{css}</style>
        <BarreTunnel />
        <EtatVide icone={ShoppingCart} texte="Ton panier est vide." action={{ label: 'Voir le catalogue', href: '/' }} />
      </div>
    )
  }

  /* ═══════════ FORMULAIRE ═══════════ */
  const Resume = (
    <>
      <ul className="cm-lignes">
        {lignes.map((l) => (
          <li key={`${l.id}-${l.mode}`} className={`cm-ligne ${l.indispo ? 'cm-ligne-indispo' : ''}`}>
            <span className="cm-thumb"><ProduitImage produit={l.produit || { nom: '?' }} emojiSize={20} /></span>
            <span className="cm-ligne-info">
              <b>{l.produit?.nom || 'Produit retiré du catalogue'}</b>
              {l.indispo ? (
                <span className="cm-indispo">
                  Plus disponible · <button onClick={() => retirer(l)}>Retirer</button>
                </span>
              ) : (
                <span>
                  {l.mode === 'lot'
                    ? `${l.quantite} lot${l.quantite > 1 ? 's' : ''} de ${l.produit.qte_min_gros}`
                    : `Quantité : ${l.quantite}`}
                </span>
              )}
            </span>
            {!l.indispo && <b className="cm-ligne-prix">{formatKMF(l.total)}</b>}
          </li>
        ))}
      </ul>
      <dl className="cm-totaux">
        <div><dt>Sous-total</dt><dd>{formatKMF(sousTotal)} KMF</dd></div>
        <div>
          <dt>Livraison</dt>
          <dd>
            {!form.ile ? 'Selon ton île' : fraisIle === undefined ? 'Confirmée par téléphone' : fraisIle === 0 ? 'Offerte' : `${formatKMF(fraisIle)} KMF`}
          </dd>
        </div>
        <div className="cm-total"><dt>Total à payer à la livraison</dt><dd>{formatKMF(total)} KMF</dd></div>
      </dl>
    </>
  )

  return (
    <div className="cm-app">
      <style>{css}</style>
      <BarreTunnel />

      <main className="cm-grille">
        {/* ── Récapitulatif repliable (téléphone uniquement) ── */}
        <div className="cm-resume-mobile">
          <button className="cm-resume-bouton" onClick={() => setResumeOuvert(!resumeOuvert)} aria-expanded={resumeOuvert}>
            <span>{resumeOuvert ? 'Masquer' : 'Voir'} le détail · {nbArticles} article{nbArticles > 1 ? 's' : ''}</span>
            <b>{formatKMF(total)} KMF</b>
          </button>
          {resumeOuvert && <div className="cm-resume-contenu">{Resume}</div>}
        </div>

        <div className="cm-colonne-form">
          <h1 className="cm-titre">Finaliser ma commande</h1>
          <p className="cm-sous-titre">Aucun paiement en ligne : tu paies en espèces à la réception.</p>

          {/* ── 1. Coordonnées ── */}
          <section className="cm-bloc" aria-labelledby="t-coord">
            <div className="cm-bloc-tete">
              <h2 id="t-coord">Tes coordonnées</h2>
              {!compte && (
                <a href="/login?suite=/commande" className="cm-lien-simple">J&apos;ai un compte</a>
              )}
            </div>
            {compte && <p className="cm-aide">Connecté : tes informations sont pré-remplies, tu peux les modifier pour cette livraison.</p>}

            <div className="cm-rangee">
              <Champ id="prenom" label="Prénom" erreur={erreurs.prenom}>
                <input id="champ-prenom" className="cm-input" autoComplete="given-name" value={form.prenom}
                  onChange={(e) => changer('prenom', e.target.value)} aria-invalid={!!erreurs.prenom} />
              </Champ>
              <Champ id="nom" label="Nom" optionnel>
                <input id="champ-nom" className="cm-input" autoComplete="family-name" value={form.nom}
                  onChange={(e) => changer('nom', e.target.value)} />
              </Champ>
            </div>

            <Champ id="numero" label="Téléphone (WhatsApp de préférence)" erreur={erreurs.numero}
              aide="Nous t'appelons pour confirmer la commande avant tout achat.">
              <div className="cm-tel">
                <select className="cm-input cm-indicatif" value={form.indicatif} aria-label="Indicatif du pays"
                  onChange={(e) => changer('indicatif', e.target.value)}>
                  {INDICATIFS.map((i) => <option key={i.code} value={i.code}>{i.code} {i.pays}</option>)}
                  <option value="autre">Autre pays</option>
                </select>
                <input id="champ-numero" className="cm-input" type="tel" inputMode="tel" autoComplete="tel-national"
                  placeholder={form.indicatif === 'autre' ? '+… numéro complet' : '333 44 55'}
                  value={form.numero} onChange={(e) => changer('numero', e.target.value)} aria-invalid={!!erreurs.numero} />
              </div>
            </Champ>

            <Champ id="email" label="E-mail" optionnel erreur={erreurs.email} aide="Pour recevoir le suivi de ta commande par e-mail.">
              <input id="champ-email" className="cm-input" type="email" inputMode="email" autoComplete="email"
                value={form.email} onChange={(e) => changer('email', e.target.value)} aria-invalid={!!erreurs.email} />
            </Champ>
          </section>

          {/* ── 2. Livraison ── */}
          <section className="cm-bloc" aria-labelledby="t-livraison">
            <h2 id="t-livraison">Livraison</h2>

            <fieldset className="cm-iles" aria-describedby={erreurs.ile ? 'err-ile' : undefined}>
              <legend className="cm-label">Île</legend>
              <div id="champ-ile" tabIndex={-1} className="cm-iles-grille">
                {ILES.map((ile) => (
                  <label key={ile.valeur} className={`cm-ile ${form.ile === ile.valeur ? 'cm-ile-on' : ''}`}>
                    <input type="radio" name="ile" value={ile.valeur} checked={form.ile === ile.valeur}
                      onChange={() => changer('ile', ile.valeur)} className="cm-radio" />
                    <b>{ile.label}</b>
                    <span>{ile.aussi}</span>
                    <small>
                      {frais[ile.valeur] === undefined ? 'Frais par téléphone' : frais[ile.valeur] === 0 ? 'Livraison offerte' : `Livraison ${formatKMF(frais[ile.valeur])} KMF`}
                    </small>
                  </label>
                ))}
              </div>
              {erreurs.ile && <p id="err-ile" className="cm-erreur-champ">{erreurs.ile}</p>}
            </fieldset>

            <Champ id="adresse" label="Adresse" erreur={erreurs.adresse}
              aide="Quartier, rue et un repère connu : le livreur doit pouvoir te trouver.">
              <textarea id="champ-adresse" className="cm-input cm-textarea" rows={3} autoComplete="street-address"
                placeholder="Ex : Fomboni, quartier Djoiezi, à côté de la boulangerie"
                value={form.adresse} onChange={(e) => changer('adresse', e.target.value)} aria-invalid={!!erreurs.adresse} />
            </Champ>

            <p className="cm-delai">
              <b>Délai estimé : {DELAI_LIVRAISON}.</b> Tes produits sont achetés chez nos fournisseurs après la confirmation
              de ta commande, puis expédiés aux Comores.
            </p>
          </section>

          {/* ── 3. Paiement ── */}
          <section className="cm-bloc" aria-labelledby="t-paiement">
            <h2 id="t-paiement">Paiement</h2>
            <div className="cm-paiement">
              <span className="cm-paiement-coche" aria-hidden="true"><Icone icone={Check} taille={18} /></span>
              <div>
                <b>Paiement à la livraison</b>
                <span>En espèces, quand tu reçois ta commande. Rien à payer aujourd&apos;hui.</span>
              </div>
            </div>
          </section>
        </div>

        {/* ── Colonne récapitulatif (ordinateur) + bouton ── */}
        <aside className="cm-colonne-resume" aria-label="Récapitulatif">
          <div className="cm-resume-bureau">
            <h2>Récapitulatif</h2>
            {Resume}
          </div>

          <div className="cm-validation">
            {erreurGlobale && <p role="alert" className="cm-erreur">{erreurGlobale}</p>}
            <button onClick={commander} disabled={envoi} className="cm-btn-principal cm-btn-commander">
              {envoi ? 'Envoi de ta commande…' : `Confirmer ma commande · ${formatKMF(total)} KMF`}
            </button>
            <p className="cm-rassurance">Tes informations servent uniquement à ta livraison.</p>
          </div>
        </aside>
      </main>
    </div>
  )
}

/* ─────────── Petits composants de la page ─────────── */

/* Barre du haut minimaliste : logo + retour panier (tunnel "fermé") */
function BarreTunnel() {
  return (
    <header className="cm-barre">
      <a href="/panier" className="cm-retour" aria-label="Retour au panier"><Icone icone={ArrowLeft} taille={18} /> Panier</a>
      <a href="/" aria-label="Accueil Salut Marketplace"><img src="/logo.png" alt="Salut" className="cm-logo" /></a>
      <span className="cm-barre-droite">Paiement à la réception</span>
    </header>
  )
}

/* Un champ = label + contenu + aide + erreur, toujours dans le même ordre */
function Champ({ id, label, optionnel, aide, erreur, children }) {
  return (
    <div className="cm-champ">
      <label htmlFor={`champ-${id}`} className="cm-label">
        {label} {optionnel && <span className="cm-optionnel">(facultatif)</span>}
      </label>
      {children}
      {erreur ? <p className="cm-erreur-champ">{erreur}</p> : aide && <p className="cm-aide">{aide}</p>}
    </div>
  )
}

/* ─────────── CSS ─────────── */
const css = `
  * { box-sizing: border-box; }

  .cm-app {
    background: ${C.bgGrey}; min-height: 100vh; color: ${C.inkDeep};
    font-family: var(--font-jakarta), system-ui, sans-serif;
    padding-bottom: 110px; /* place pour le bouton collant sur téléphone */
  }

  /* ── Barre du tunnel ── */
  .cm-barre {
    background: ${C.white}; border-bottom: 1px solid ${C.line};
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    padding: 10px 16px; position: sticky; top: 0; z-index: 20;
  }
  .cm-retour { font-size: 15px; font-weight: 700; color: ${C.ink}; text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; gap: 4px; }
  .cm-logo { width: 44px; height: 44px; object-fit: contain; display: block; }
  .cm-barre-droite { justify-self: end; font-size: 13px; font-weight: 600; color: ${C.inkSoft}; text-align: right; }

  .cm-etat { max-width: 560px; margin: 0 auto; padding: 24px 16px; }

  /* ── Grille : 1 colonne sur téléphone, 2 sur ordinateur ── */
  .cm-grille { max-width: 1040px; margin: 0 auto; padding: 16px; display: grid; gap: 16px; }
  .cm-titre { font-size: 24px; font-weight: 800; margin: 8px 0 4px; }
  .cm-sous-titre { font-size: 15px; color: ${C.inkSoft}; margin: 0 0 16px; }

  .cm-bloc { background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .cm-bloc h2 { font-size: 18px; font-weight: 800; margin: 0 0 14px; }
  .cm-bloc-tete { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }

  .cm-rangee { display: grid; grid-template-columns: 1fr; gap: 0 12px; }
  .cm-champ { margin-bottom: 14px; }
  .cm-label { display: block; font-size: 15px; font-weight: 700; margin-bottom: 8px; padding: 0; }
  .cm-optionnel { font-weight: 500; color: ${C.inkSoft}; }
  .cm-aide { font-size: 14px; color: ${C.inkSoft}; margin: 8px 0 0; line-height: 1.45; }
  .cm-erreur-champ { font-size: 14px; color: ${C.clay}; font-weight: 700; margin: 8px 0 0; }

  /* 16 px minimum : sinon l'iPhone zoome tout seul sur le champ */
  .cm-input {
    width: 100%; height: 50px; padding: 0 16px; border-radius: 8px;
    border: 1.5px solid ${C.line}; background: ${C.sand};
    font-size: 16px; font-family: inherit; color: ${C.inkDeep}; outline: none;
  }
  .cm-input:focus { border-color: ${C.ink}; background: #fff; }
  .cm-input[aria-invalid="true"] { border-color: ${C.clay}; background: #FBF0EE; }
  .cm-textarea { height: auto; padding: 12px 14px; resize: vertical; line-height: 1.45; }

  .cm-tel { display: grid; grid-template-columns: 122px 1fr; gap: 8px; }
  .cm-indicatif { padding: 0 8px; font-size: 15px; }

  /* ── Îles : 3 grandes cartes ── */
  .cm-iles { border: none; margin: 0 0 14px; padding: 0; min-width: 0; }
  .cm-iles-grille { display: grid; grid-template-columns: 1fr; gap: 8px; outline: none; }
  .cm-ile {
    position: relative; display: grid; grid-template-columns: 1fr auto; column-gap: 10px; align-items: baseline;
    border: 1.5px solid ${C.line}; border-radius: 8px; padding: 12px 16px; cursor: pointer; background: ${C.white};
    min-height: 44px;
  }
  .cm-ile b { font-size: 15px; }
  .cm-ile span { font-size: 14px; color: ${C.inkSoft}; grid-column: 1; }
  .cm-ile small { grid-column: 2; grid-row: 1 / span 2; align-self: center; font-size: 14px; font-weight: 700; color: ${C.inkSoft}; text-align: right; }
  .cm-ile-on { border-color: ${C.ink}; box-shadow: inset 0 0 0 1px ${C.ink}; }
  .cm-ile-on small { color: ${C.ink}; }
  .cm-radio { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .cm-ile:focus-within { outline: 2px solid ${C.ink}; outline-offset: 2px; }

  .cm-delai { font-size: 14px; color: ${C.inkDeep}; background: ${C.sand}; border-radius: 8px; padding: 12px 16px; margin: 0; line-height: 1.5; }

  .cm-paiement { display: flex; gap: 12px; align-items: center; border: 1.5px solid ${C.ink}; border-radius: 8px; padding: 12px 16px; }
  .cm-paiement-coche {
    width: 26px; height: 26px; border-radius: 50%; background: ${C.ink}; color: #fff;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .cm-paiement b { display: block; font-size: 15px; }
  .cm-paiement span { font-size: 14px; color: ${C.inkSoft}; }

  /* ── Récapitulatif ── */
  .cm-resume-mobile { background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; overflow: hidden; }
  .cm-resume-bouton {
    width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 10px;
    background: none; border: none; padding: 14px 16px; cursor: pointer; font-family: inherit;
    font-size: 15px; font-weight: 700; color: ${C.ink}; min-height: 52px;
  }
  .cm-resume-bouton b { color: ${C.inkDeep}; font-size: 16px; }
  .cm-resume-contenu { padding: 0 16px 14px; border-top: 1px solid ${C.line}; }
  .cm-resume-bureau { display: none; }

  .cm-lignes { list-style: none; margin: 0; padding: 12px 0 0; display: flex; flex-direction: column; gap: 12px; }
  .cm-ligne { display: flex; gap: 12px; align-items: center; }
  .cm-ligne-indispo { opacity: 0.85; }
  .cm-thumb {
    width: 52px; height: 52px; border-radius: 8px; overflow: hidden; flex-shrink: 0;
    background: ${C.sand}; display: flex; align-items: center; justify-content: center;
  }
  .cm-ligne-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .cm-ligne-info b { font-size: 15px; }
  .cm-ligne-info > span { font-size: 14px; color: ${C.inkSoft}; }
  .cm-indispo { color: ${C.clay} !important; font-weight: 700; }
  .cm-indispo button { background: none; border: none; padding: 0; color: ${C.clay}; font: inherit; text-decoration: underline; cursor: pointer; }
  .cm-ligne-prix { font-size: 15px; white-space: nowrap; }

  .cm-totaux { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid ${C.line}; display: flex; flex-direction: column; gap: 8px; }
  .cm-totaux div { display: flex; justify-content: space-between; gap: 12px; font-size: 15px; }
  .cm-totaux dt { color: ${C.inkSoft}; }
  .cm-totaux dd { margin: 0; font-weight: 700; text-align: right; }
  .cm-total { padding-top: 10px; border-top: 1px dashed ${C.line}; }
  .cm-total dt { color: ${C.inkDeep} !important; font-weight: 700; }
  .cm-total dd { font-size: 19px; font-weight: 800 !important; }

  /* ── Bouton de validation : collé en bas de l'écran sur téléphone (zone du pouce) ── */
  .cm-validation {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
    background: ${C.white}; border-top: 1px solid ${C.line}; padding: 12px 16px 16px;
  }
  .cm-erreur {
    font-size: 14px; color: ${C.clay}; background: #FBF0EE; border: 1px solid #F0D9D5;
    border-radius: 8px; padding: 12px; margin: 0 0 12px; line-height: 1.45;
  }
  .cm-rassurance { font-size: 14px; color: ${C.inkSoft}; text-align: center; margin: 8px 0 0; }

  .cm-btn-principal {
    display: flex; align-items: center; justify-content: center; width: 100%; min-height: 54px;
    background: ${C.gold}; color: ${C.inkDeep}; border: none; border-radius: 8px; cursor: pointer;
    font-family: inherit; font-size: 16px; font-weight: 800; text-decoration: none; padding: 0 16px;
  }
  .cm-btn-principal:hover { background: ${C.goldDeep}; }
  .cm-btn-principal:disabled { background: ${C.line}; color: #8A979D; cursor: wait; }
  .cm-btn-secondaire {
    min-height: 48px; padding: 0 16px; border-radius: 8px; cursor: pointer; font-family: inherit;
    background: ${C.white}; border: 1.5px solid ${C.line}; color: ${C.inkDeep}; font-size: 15px; font-weight: 700;
    display: inline-flex; align-items: center; justify-content: center; gap: 4px; text-decoration: none;
  }
  .cm-btn-secondaire:hover { border-color: ${C.inkSoft}; }
  .cm-lien-simple { font-size: 15px; font-weight: 700; min-height: 44px; display: inline-flex; align-items: center; color: ${C.ink}; text-decoration: underline; text-underline-offset: 3px; }

  /* ── Écran de confirmation ── */
  .cm-merci { max-width: 560px; margin: 0 auto; padding: 28px 16px; text-align: center; }
  .cm-merci-icone {
    width: 64px; height: 64px; border-radius: 50%; background: ${C.leaf}; color: #fff;
    display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
  }
  .cm-merci h1 { font-size: 24px; font-weight: 800; margin: 0 0 8px; }
  .cm-merci-ref { font-size: 15px; color: ${C.inkSoft}; margin: 0 0 24px; }
  .cm-merci .cm-bloc { text-align: left; }
  .cm-prochaine { border-color: ${C.ink}; }
  .cm-prochaine p { margin: 0; font-size: 15px; line-height: 1.55; }
  .cm-lien {
    background: ${C.sand}; border-radius: 8px; padding: 12px; font-size: 14px; word-break: break-all;
    font-weight: 600; color: ${C.ink}; margin: 10px 0;
  }
  .cm-actions-lien { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .cm-merci-boutons { display: flex; flex-direction: column; gap: 14px; align-items: center; margin-top: 8px; }

  /* ═══════════ ÉCRANS PLUS LARGES ═══════════ */
  @media (min-width: 560px) {
    .cm-rangee { grid-template-columns: 1fr 1fr; }
    .cm-iles-grille { grid-template-columns: repeat(3, 1fr); }
    .cm-ile { grid-template-columns: 1fr; }
    .cm-ile small { grid-column: 1; grid-row: auto; text-align: left; margin-top: 6px; }
    .cm-actions-lien { grid-template-columns: 1fr 1fr; }
  }

  @media (min-width: 900px) {
    .cm-app { padding-bottom: 40px; }
    .cm-grille { grid-template-columns: minmax(0, 1fr) 360px; align-items: start; gap: 24px; padding: 24px 20px; }
    .cm-resume-mobile { display: none; }
    .cm-colonne-resume { position: sticky; top: 76px; }
    .cm-resume-bureau { display: block; background: ${C.white}; border: 1px solid ${C.line}; border-radius: 12px; padding: 16px; }
    .cm-resume-bureau h2 { font-size: 18px; font-weight: 800; margin: 0; }
    .cm-validation { position: static; border: none; background: none; padding: 16px 0 0; }
  }
`