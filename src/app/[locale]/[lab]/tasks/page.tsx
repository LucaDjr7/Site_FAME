import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { flattenTasks } from '@/components/tasks/kanban-shared'
import type { Lab, Subject, MemberRef } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = { params: Promise<{ locale: string; lab: string }> }

export default async function TasksPage({ params }: Props) {
  const { locale, lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()

  const service = await createServiceClient()
  const [{ data: subjects }, { data: members }, { data: tasksRaw }, session] = await Promise.all([
    service.from('subjects').select('*').eq('labo', lab).order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
    service.from('tasks')
      .select('*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)')
      .eq('labo', lab).order('date_creation', { ascending: false }),
    getSession(),
  ])

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
