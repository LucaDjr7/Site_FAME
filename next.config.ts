import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// CSP déployée en Report-Only : elle NE bloque RIEN (aucun risque visuel/fonctionnel), elle
// remonte seulement les violations en console. Objectif : valider le périmètre avant de passer
// à `Content-Security-Policy` (enforce) avec des nonces générés dans proxy.ts (M16).
// Origines réellement chargées par le navigateur : Supabase (connect/img — upload direct Storage),
// Google Fonts (style/font), jsdelivr (fetch topojson du globe). OpenAI/Resend/Dropbox = server-only.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        // Isolation de la fenêtre + des ressources (anti-inclusion cross-site). Sans effet
        // fonctionnel ici (pas de popup OAuth, pas de SharedArrayBuffer).
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        // HSTS : force HTTPS pendant 2 ans (sans risque fonctionnel ; Vercel sert en HTTPS).
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        // CSP en observation (ne bloque pas) — cf. CSP_REPORT_ONLY ci-dessus.
        { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
      ],
    }]
  },
}

export default withNextIntl(nextConfig)
