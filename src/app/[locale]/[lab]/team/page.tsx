import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { MemberGrid } from '@/components/team/MemberGrid'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = {
  params: Promise<{ locale: string; lab: string }>
}

export default async function TeamPage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()

  const session = await getSession()

  return (
    <MemberGrid
      lab={lab as Lab}
      currentMemberId={session?.member?.id ?? null}
      isAdmin={session?.member?.is_admin ?? false}
    />
  )
}
