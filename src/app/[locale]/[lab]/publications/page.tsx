import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth'
import { PublicationList } from '@/components/publications/PublicationList'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = {
  params: Promise<{ locale: string; lab: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab } = await params
  const labLabel = lab === 'paris' ? 'Paris' : lab === 'montreal' ? 'Montréal' : lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  return { title: t('publicationsTitle', { lab: labLabel }), description: t('publicationsDesc', { lab: labLabel }) }
}

export default async function PublicationsPage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()

  const session = await getSession()
  const isMember = !!session?.member

  return <PublicationList lab={lab as Lab} isMember={isMember} />
}
