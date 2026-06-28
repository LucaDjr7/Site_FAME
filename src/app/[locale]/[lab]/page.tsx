import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { SubjectGrid } from '@/components/lab/SubjectGrid'
import type { Lab, Subject, MemberRef } from '@/types'
import { VALID_LABS, LAB_LABELS } from '@/lib/constants'

type Props = { params: Promise<{ locale: string; lab: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab } = await params
  const labLabel = LAB_LABELS[lab as Lab] ?? lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  return { title: t('labTitle', { lab: labLabel }), description: t('labDesc', { lab: labLabel }) }
}

export default async function LabPage({ params }: Props) {
  const { lab } = await params
  if (!VALID_LABS.includes(lab as Lab)) notFound()

  const session = await getSession()
  const isMember = !!session?.member
  const service = await createServiceClient()

  // Visiteur : ne jamais charger les sujets confidentiels (grille, recherche, filtres).
  let subjectsQuery = service.from('subjects').select('*').or(`labo.eq.${lab},is_transversal.eq.true`)
  if (!isMember) subjectsQuery = subjectsQuery.eq('confidentiel', false)

  const [{ data: subjects }, { data: members }] = await Promise.all([
    subjectsQuery.order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
  ])
  const canEdit = isMember

  return (
    <SubjectGrid
      lab={lab as Lab}
      initialSubjects={(subjects ?? []) as Subject[]}
      members={(members ?? []) as MemberRef[]}
      canEdit={canEdit}
    />
  )
}
