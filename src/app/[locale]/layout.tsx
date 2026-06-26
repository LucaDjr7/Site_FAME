import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { ToastProvider } from '@/components/ui/Toast'
import { getSession } from '@/lib/auth'
import { ChatWidget } from '@/components/assistant/ChatWidget'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const t = await getTranslations({ locale, namespace: 'meta' })
  return {
    metadataBase: new URL(base),
    title: { default: t('homeTitle'), template: `%s · ${t('siteName')}` },
    description: t('homeDesc'),
    alternates: { languages: { en: '/en', fr: '/fr' } },
    openGraph: { title: t('homeTitle'), description: t('homeDesc'), type: 'website', locale, siteName: t('siteName') },
  }
}

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!routing.locales.includes(locale as 'en' | 'fr')) {
    notFound()
  }

  const messages = await getMessages()
  const session = await getSession()
  const isMember = !!session?.member

  return (
    <html lang={locale}>
      <head>
        {/* P2: preconnect to Google Fonts CDN to reduce font load latency */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            {children}
            <ChatWidget locale={locale} isMember={isMember} />
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
