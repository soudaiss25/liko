/* ─────────── En-têtes de sécurité ───────────
   Posés sur TOUTES les routes. L'hôte Supabase est déduit de NEXT_PUBLIC_SUPABASE_URL,
   donc rien n'est écrit en dur. */

const enDeveloppement = process.env.NODE_ENV !== 'production'

function hoteSupabase() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  } catch {
    return null // variable absente ou invalide : on n'autorise alors que le site lui-même
  }
}

function politiqueContenu() {
  const hote = hoteSupabase()
  const supabaseHttp = hote ? ` https://${hote}` : ''
  const supabaseWs = hote ? ` wss://${hote}` : ''

  const directives = [
    `default-src 'self'`,
    `img-src 'self' data: blob:${supabaseHttp}`,
    // En développement, Next utilise un WebSocket local pour recharger la page
    `connect-src 'self'${supabaseHttp}${supabaseWs}${enDeveloppement ? ' ws://localhost:* http://localhost:*' : ''}`,
    // 'unsafe-inline' : Next injecte de petits scripts dans la page. 'unsafe-eval' seulement en développement.
    `script-src 'self' 'unsafe-inline'${enDeveloppement ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ]
  return directives.join('; ')
}

// Mode de la politique : "Content-Security-Policy-Report-Only" = signale sans bloquer ;
// "Content-Security-Policy" = bloque.
const NOM_EN_TETE_CSP = 'Content-Security-Policy'

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: NOM_EN_TETE_CSP, value: politiqueContenu() },
        ],
      },
    ]
  },
}

export default nextConfig
