/* ─────────── components/Footer.js ───────────
   Footer partagé, à importer sur toutes les pages.
   Les couleurs sont passées en variables CSS globales
   (voir globals.css) pour ne pas dupliquer la palette
   dans chaque fichier.
*/
export default function Footer() {
  return (
    <footer className="site-footer">
      <style>{css}</style>

      <div className="footer-inner">
        <div className="footer-col footer-brand">
          <img src="/logo.png" alt="Salut" className="footer-logo" />
          <p className="footer-tagline">
            La marketplace des Comores. Le meilleur du monde, livré chez vous
            et payé à la réception.
          </p>
          <a href="https://wa.me/" className="footer-wa">💬 Nous écrire sur WhatsApp</a>
        </div>

        <div className="footer-col">
          <h4>Acheter</h4>
          <a href="/">Tous les produits</a>
          <a href="/">Nouveautés</a>
          <a href="/">Achat en gros</a>
          <a href="/">Meilleures ventes</a>
        </div>

        <div className="footer-col">
          <h4>Mon compte</h4>
          <a href="/login">Se connecter</a>
          <a href="/register">Créer un compte</a>
          <a href="/commandes">Mes commandes</a>
          <a href="/panier">Mon panier</a>
        </div>

        <div className="footer-col">
          <h4>Aide</h4>
          <a href="/">Suivre ma commande</a>
          <a href="/">Livraison</a>
          <a href="/">Retours</a>
          <a href="/">Nous contacter</a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Salut Marketplace — Comores</span>
        <span className="footer-legal">
          <a href="/">Conditions</a> · <a href="/">Confidentialité</a>
        </span>
      </div>
    </footer>
  )
}

const css = `
  .site-footer { background: #143A4B; color: #fff; }
  .footer-inner {
    max-width: 1280px; margin: 0 auto; padding: 40px 20px 30px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 30px;
  }
  .footer-brand { grid-column: 1 / -1; }
  .footer-logo {
    width: 54px; height: 54px; object-fit: contain;
    background: #fff; border-radius: 10px; padding: 4px; margin-bottom: 12px;
  }
  .footer-tagline {
    font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.6);
    max-width: 340px; margin: 0 0 14px;
  }
  .footer-wa {
    display: inline-block; background: #3E9268; color: #fff; text-decoration: none;
    padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 700;
  }
  .footer-col h4 {
    font-size: 13px; font-weight: 700; margin: 0 0 14px; color: #fff; letter-spacing: 0.3px;
  }
  .footer-col a {
    display: block; font-size: 13px; color: rgba(255,255,255,0.6);
    text-decoration: none; margin-bottom: 10px; transition: color .15s;
  }
  .footer-col a:hover { color: #E8A020; }
  .footer-bottom {
    border-top: 1px solid rgba(255,255,255,0.1); max-width: 1280px; margin: 0 auto;
    padding: 18px 20px; display: flex; align-items: center; justify-content: space-between;
    font-size: 12px; color: rgba(255,255,255,0.5); flex-wrap: wrap; gap: 8px;
  }
  .footer-legal a { color: rgba(255,255,255,0.5); text-decoration: none; }
  .footer-legal a:hover { color: #E8A020; }

  @media (min-width: 700px) {
    .footer-inner { grid-template-columns: 2fr 1fr 1fr 1fr; }
    .footer-brand { grid-column: auto; }
  }
`