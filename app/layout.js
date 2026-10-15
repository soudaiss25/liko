import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Chargée UNE seule fois pour tout le site (pas de clignotement du texte)
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "Salut — La marketplace des Comores",
  description:
    "Des produits venus de Chine, livrés sur les 3 îles des Comores. Payez à la livraison.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
