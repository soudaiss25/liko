/* ─────────── components/commande/InstructionsAvance.js ───────────
   "Comment payer l'avance" : espèces, Huri Money, MVola + bouton WhatsApp avec le message prêt.
   Utilisé par la page de confirmation et par la page de suivi.

   <InstructionsAvance montant={3000} reference="CMD-0012" />
*/

import { MessageCircle } from 'lucide-react'
import Icone from '@/components/ui/Icone'
import { numeroPaiement, messageAvanceWhatsApp } from '@/lib/avance'
import { WHATSAPP_SERVICE } from '@/lib/config'
import { lienWhatsApp, MOYENS_PAIEMENT } from '@/lib/commandes'
import { formatKMF } from '@/lib/produit'
import { C } from '@/lib/theme'

export default function InstructionsAvance({ montant, reference }) {
  return (
    <div className="ia">
      <style href="instructions-avance" precedence="default">{css}</style>
      <h3 className="ia-titre">Comment payer</h3>
      <ul className="ia-liste">
        <li><b>{MOYENS_PAIEMENT.especes}</b> : auprès de notre équipe aux Comores</li>
        <li><b>{MOYENS_PAIEMENT.huri_money}</b> : {numeroPaiement('huri_money')}</li>
        <li><b>{MOYENS_PAIEMENT.mvola}</b> : {numeroPaiement('mvola')}</li>
      </ul>
      {WHATSAPP_SERVICE && (
        <a className="ia-wa" target="_blank" rel="noopener noreferrer"
          href={lienWhatsApp(WHATSAPP_SERVICE, messageAvanceWhatsApp(montant, reference, formatKMF))}>
          <Icone icone={MessageCircle} taille={18} /> Écrire sur WhatsApp
        </a>
      )}
    </div>
  )
}

const css = `
  .ia-titre { font-size: 16px; font-weight: 800; margin: 0 0 8px; color: ${C.inkDeep}; }
  .ia-liste { margin: 0 0 12px; padding-left: 20px; font-size: 15px; line-height: 1.6; color: ${C.inkDeep}; }
  .ia-wa {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px;
    padding: 0 16px; border-radius: 8px; border: 1.5px solid ${C.ink}; color: ${C.ink};
    background: ${C.white}; font-weight: 700; font-size: 15px; text-decoration: none; font-family: inherit;
  }
  .ia-wa:hover { background: ${C.sand}; }
`
