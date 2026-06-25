import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/en/admin', '/fr/admin', '/en/auth', '/fr/auth'] }],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
