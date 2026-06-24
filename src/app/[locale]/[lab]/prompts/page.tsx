import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { PromptLibrary } from '@/components/prompts/PromptLibrary'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = { params: Promise<{ locale: string; lab: string }> }

export default async function PromptsPage({ params }: Props) {
  const { locale, lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()
  const session = await getSession()
  if (!session?.member) redirect(`/${locale}/auth/login`)
  return <PromptLibrary lab={lab as Lab} />
}
