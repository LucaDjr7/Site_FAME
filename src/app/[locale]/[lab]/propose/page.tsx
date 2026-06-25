import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth'
import { ProposePageClient } from '@/components/propose/ProposePageClient'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']
type Props = { params: Promise<{ locale: string; lab: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab } = await params
  const labLabel = lab === 'paris' ? 'Paris' : lab === 'montreal' ? 'Montréal' : lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  return { title: t('proposeTitle', { lab: labLabel }) }
}

export default async function ProposePage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()
  const session = await getSession()
  return <ProposePageClient lab={lab as Lab} isMember={!!session?.member} />
}
