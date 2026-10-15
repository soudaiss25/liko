import { Compass } from 'lucide-react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Icone from '@/components/ui/Icone'
import Bouton from '@/components/ui/Bouton'

export const metadata = { title: 'Page introuvable — Salut' }

export default function NotFound() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 440, margin: '0 auto', padding: '64px 16px', textAlign: 'center', color: '#143a4b' }}>
        <Icone icone={Compass} taille={32} />
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '16px 0 8px' }}>Page introuvable</h1>
        <p style={{ fontSize: 16, color: '#6e8a97', margin: '0 0 24px', lineHeight: 1.5 }}>
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
        <Bouton variante="principal" href="/">Retour à l&apos;accueil</Bouton>
      </main>
      <Footer />
    </>
  )
}
