import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ProposePageClient } from '@/components/propose/ProposePageClient'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']
type Props = { params: Promise<{ locale: string; lab: string }> }

export default async function ProposePage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()
  const session = await getSession()
  return <ProposePageClient lab={lab as Lab} isMember={!!session?.member} />
}
