import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock next-intl/server so the test runs without the full Next.js runtime
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const en: Record<string, Record<string, string>> = {
      meta: {
        siteName: 'FAME',
        homeTitle: 'FAME — Financial and Monetary Economics',
        homeDesc: 'Independent research labs in Paris and Montréal.',
      },
    }
    const fr: Record<string, Record<string, string>> = {
      meta: {
        siteName: 'FAME',
        homeTitle: 'FAME — Économie financière et monétaire',
        homeDesc: 'Laboratoires de recherche indépendants à Paris et Montréal.',
      },
    }
    const messages = locale === 'fr' ? fr : en
    const ns = messages[namespace] ?? {}
    return (key: string) => ns[key] ?? key
  },
  getMessages: async () => ({}),
}))

// Also mock next/navigation (notFound) used in the layout
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('not-found') } }))

// Mock @/i18n/routing — must be present for the layout import to resolve
vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'fr'], defaultLocale: 'en' },
}))

// Mock React (ToastProvider) — layout imports a client component
vi.mock('@/components/ui/Toast', () => ({ ToastProvider: ({ children }: { children: unknown }) => children }))

import { generateMetadata } from './layout'

beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://fame.example' })

describe('root generateMetadata', () => {
  it('pose metadataBase, le template de titre et les alternates hreflang', async () => {
    const m = await generateMetadata({ params: Promise.resolve({ locale: 'fr' }) })
    expect(String(m.metadataBase)).toContain('https://fame.example')
    expect((m.title as { template?: string }).template).toContain('%s')
    expect(m.alternates?.languages).toMatchObject({ en: '/en', fr: '/fr' })
    expect(m.openGraph?.locale).toBe('fr')
  })
})
