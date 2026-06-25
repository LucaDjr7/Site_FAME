import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'

const LABS = ['paris', 'montreal'] as const
const LAB_PAGES = ['', '/publications', '/team', '/propose'] as const // public only

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const now = new Date()
  const entries: MetadataRoute.Sitemap = []
  for (const locale of routing.locales) {
    entries.push({ url: `${BASE}/${locale}`, lastModified: now, changeFrequency: 'monthly', priority: 1 })
    for (const lab of LABS) {
      for (const page of LAB_PAGES) {
        entries.push({ url: `${BASE}/${locale}/${lab}${page}`, lastModified: now, changeFrequency: 'weekly', priority: page === '' ? 0.8 : 0.6 })
      }
    }
  }
  return entries
}
