import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { VALID_LABS } from '@/lib/constants'
const LAB_PAGES = ['', '/publications', '/team', '/propose', '/tasks'] as const // public only

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []
  for (const locale of routing.locales) {
    entries.push({ url: `${BASE}/${locale}`, lastModified: now, changeFrequency: 'monthly', priority: 1 })
    // Pages publiques hors [lab] (lecture publique) : graphe des relations, assistant.
    entries.push({ url: `${BASE}/${locale}/graph`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 })
    entries.push({ url: `${BASE}/${locale}/assistant`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 })
    for (const lab of VALID_LABS) {
      for (const page of LAB_PAGES) {
        entries.push({ url: `${BASE}/${locale}/${lab}${page}`, lastModified: now, changeFrequency: 'weekly', priority: page === '' ? 0.8 : 0.6 })
      }
    }
  }
  return entries
}
