import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth'
import { PromptLibrary } from '@/components/prompts/PromptLibrary'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = { params: Promise<{ locale: string; lab: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab } = await params
  const labLabel = lab === 'paris' ? 'Paris' : lab === 'montreal' ? 'Montréal' : lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  return { title: t('promptsTitle', { lab: labLabel }) }
}

export default async function PromptsPage({ params }: Props) {
  const { locale, lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()
  const session = await getSession()
  if (!session?.member) redirect(`/${locale}/auth/login`)
  return <PromptLibrary lab={lab as Lab} />
}
