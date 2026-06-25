import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { ToastProvider } from '@/components/ui/Toast'

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

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
