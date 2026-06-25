import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { SubjectGrid } from '@/components/lab/SubjectGrid'
import type { Lab, Subject, MemberRef } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = { params: Promise<{ locale: string; lab: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab } = await params
  const labLabel = lab === 'paris' ? 'Paris' : lab === 'montreal' ? 'Montréal' : lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  return { title: t('labTitle', { lab: labLabel }), description: t('labDesc', { lab: labLabel }) }
}

export default async function LabPage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()

  const service = await createServiceClient()
  const [{ data: subjects }, { data: members }, session] = await Promise.all([
    service.from('subjects').select('*').or(`labo.eq.${lab},is_transversal.eq.true`).order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
    getSession(),
  ])
  const canEdit = !!session?.member

  return (
    <SubjectGrid
      lab={lab as Lab}
      initialSubjects={(subjects ?? []) as Subject[]}
      members={(members ?? []) as MemberRef[]}
      canEdit={canEdit}
    />
  )
}
