import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { flattenTasks } from '@/components/tasks/kanban-shared'
import type { Lab, Subject, MemberRef } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = { params: Promise<{ locale: string; lab: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab } = await params
  const labLabel = lab === 'paris' ? 'Paris' : lab === 'montreal' ? 'Montréal' : lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  return { title: t('tasksTitle', { lab: labLabel }) }
}

export default async function TasksPage({ params }: Props) {
  const { locale, lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()

  const service = await createServiceClient()
  const [{ data: subjects }, { data: members }, session] = await Promise.all([
    service.from('subjects').select('*').or(`labo.eq.${lab},is_transversal.eq.true`).order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
    getSession(),
  ])

  // Cascade : les tâches visibles sont celles rattachées aux sujets visibles
  // (sujets du labo + sujets transversaux). Un sujet transversal partage donc ses tâches.
  const visibleSubjectIds = (subjects ?? []).map((s: { id: string }) => s.id)
  const { data: tasksRaw } = visibleSubjectIds.length > 0
    ? await service.from('tasks')
        .select('*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)')
        .in('sujet_id', visibleSubjectIds)
        .order('date_creation', { ascending: false })
    : { data: [] }

  return (
    <KanbanBoard
      lab={lab as Lab}
      locale={locale}
      subjects={(subjects ?? []) as Subject[]}
      initialTasks={flattenTasks(tasksRaw ?? [])}
      members={(members ?? []) as MemberRef[]}
      isMember={!!session?.member}
      currentMemberId={session?.member?.id ?? null}
    />
  )
}
