import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth'
import { DataExplorer } from '@/components/data/DataExplorer'
import type { Lab } from '@/types'
import { VALID_LABS, LAB_LABELS } from '@/lib/constants'

type Props = { params: Promise<{ locale: string; lab: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab } = await params
  const labLabel = LAB_LABELS[lab as Lab] ?? lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  return { title: t('dataTitle', { lab: labLabel }) }
}

export default async function DataPage({ params }: Props) {
  const { locale, lab } = await params
  if (!VALID_LABS.includes(lab as Lab)) notFound()
  const session = await getSession()
  if (!session?.member) redirect(`/${locale}/auth/login`)
  return <DataExplorer lab={lab as Lab} />
}
