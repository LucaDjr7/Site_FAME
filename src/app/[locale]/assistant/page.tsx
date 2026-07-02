import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { AssistantFullPage } from '@/components/assistant/AssistantFullPage'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'assistant' })
  return { title: t('title'), description: t('welcomeBody') }
}

export default async function AssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <AssistantFullPage locale={locale} />
}
