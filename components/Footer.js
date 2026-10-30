/* ─────────── components/Footer.js ───────────
   Footer partagé : uniquement des liens qui mènent à une vraie page.
*/

import { MessageCircle } from 'lucide-react'
import Icone from '@/components/ui/Icone'
import { C } from '@/lib/theme'
import { NOM_BOUTIQUE, WHATSAPP_SERVICE, WHATSAPP_CHIFFRES } from '@/lib/config'

export default function Footer() {
  return (
    <footer className="site-footer">
      <style>{css}</style>

      <div className="footer-inner">
        <div className="footer-col footer-brand">
          <img src="/logo.png" alt={NOM_BOUTIQUE} className="footer-logo" />
          <p className="footer-tagline">
            Des produits venus de Chine, livrés sur les 3 îles et payés à la réception.
          </p>
          {WHATSAPP_SERVICE && (
            <a href={`https://wa.me/${WHATSAPP_CHIFFRES}`} className="footer-wa">
              <Icone icone={MessageCircle} taille={18} /> Écrire sur WhatsApp
            </a>
          )}
        </div>

        <div className="footer-col">
          <h4>Boutique</h4>
          <a href="/">Tous les produits</a>
          <a href="/panier">Mon panier</a>
          <a href="/commandes">Suivre une commande</a>
        </div>

        <div className="footer-col">
          <h4>Mon compte</h4>
          <a href="/login">Se connecter</a>
          <a href="/register">Créer un compte</a>
          <a href="/commandes">Mes commandes</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>{NOM_BOUTIQUE}, {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}

const css = `
  .site-footer { background: ${C.inkDeep}; color: ${C.white}; }
  .footer-inner {
    max-width: 1280px; margin: 0 auto; padding: 32px 16px 24px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
  }
  .footer-brand { grid-column: 1 / -1; }
  .footer-logo {
    width: 48px; height: 48px; object-fit: contain;
    background: ${C.white}; border-radius: 8px; padding: 4px; margin-bottom: 12px;
  }
  .footer-tagline {
    font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.75);
    max-width: 340px; margin: 0 0 16px;
  }
  .footer-wa {
    display: inline-flex; align-items: center; gap: 8px; min-height: 44px;
    border: 1.5px solid rgba(255,255,255,0.4); color: ${C.white}; text-decoration: none;
    padding: 0 16px; border-radius: 8px; font-size: 14px; font-weight: 700;
  }
  .footer-wa:hover { border-color: ${C.white}; }
  .footer-col h4 { font-size: 14px; font-weight: 700; margin: 0 0 8px; color: ${C.white}; }
  .footer-col a {
    display: block; font-size: 14px; color: rgba(255,255,255,0.75);
    text-decoration: none; padding: 12px 0;
  }
  .footer-col a:hover { color: ${C.white}; text-decoration: underline; }
  .footer-bottom {
    border-top: 1px solid rgba(255,255,255,0.15); max-width: 1280px; margin: 0 auto;
    padding: 16px; font-size: 13px; color: rgba(255,255,255,0.7);
  }

  @media (min-width: 700px) {
    .footer-inner { grid-template-columns: 2fr 1fr 1fr; }
    .footer-brand { grid-column: auto; }
  }
`
