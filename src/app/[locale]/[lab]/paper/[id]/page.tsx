import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { PaperView } from '@/components/paper/PaperView'
import type { Lab, Subject, MemberRef, TaskWithRelations, Comment, DropboxLink } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = { params: Promise<{ locale: string; lab: string; id: string }> }

export default async function PaperPage({ params }: Props) {
  const { locale, lab, id } = await params
  if (!LABS.includes(lab as Lab)) notFound()

  const service = await createServiceClient()
  const [{ data: subject }, { data: navRows }, { data: members }, { data: tasksRaw },
    { data: comments }, { data: links }, session] = await Promise.all([
    service.from('subjects').select('*').eq('id', id).single(),
    service.from('subjects').select('id,titre,statut,ordre').eq('labo', lab).order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
    service.from('tasks')
      .select('*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)')
      .eq('sujet_id', id).order('date_creation', { ascending: true }),
    service.from('comments').select('*').eq('sujet_id', id).order('created_at', { ascending: true }),
    service.from('dropbox_links').select('*').eq('subject_id', id),
    getSession(),
  ])

  // Not found, or belongs to a different lab → 404 (lab-scoped URL integrity).
  if (!subject || subject.labo !== lab) notFound()

  // Flatten nested task_assignees(members(...)) → assignees: MemberRef[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: TaskWithRelations[] = (tasksRaw ?? []).map((t: any) => {
    const ta = (t.task_assignees as { members: MemberRef | null }[] | null) ?? []
    const assignees = ta.map((a: { members: MemberRef | null }) => a.members).filter((m): m is MemberRef => !!m)
    const { task_assignees, ...rest } = t
    void task_assignees
    return { ...rest, assignees, subtasks: t.subtasks ?? [] } as TaskWithRelations
  })

  return (
    <PaperView
      locale={locale}
      lab={lab as Lab}
      subject={subject as Subject}
      navSubjects={(navRows ?? []) as Pick<Subject, 'id' | 'titre' | 'statut' | 'ordre'>[]}
      members={(members ?? []) as MemberRef[]}
      tasks={tasks}
      initialComments={(comments ?? []) as Comment[]}
      links={(links ?? []) as DropboxLink[]}
      isMember={!!session?.member}
    />
  )
}
