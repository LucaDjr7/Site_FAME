import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { PublicationList } from '@/components/publications/PublicationList'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = {
  params: Promise<{ locale: string; lab: string }>
}

export default async function PublicationsPage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()

  const session = await getSession()
  const isMember = !!session?.member

  return <PublicationList lab={lab as Lab} isMember={isMember} />
}
