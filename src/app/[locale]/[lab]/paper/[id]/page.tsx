import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { PaperView } from '@/components/paper/PaperView'
import { flattenTasks } from '@/components/tasks/kanban-shared'
import type { Lab, Subject, MemberRef, Comment, DropboxLink } from '@/types'
import { VALID_LABS, LAB_LABELS } from '@/lib/constants'

type Props = { params: Promise<{ locale: string; lab: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab, id } = await params
  if (!VALID_LABS.includes(lab as Lab)) return { title: '' }
  const labLabel = LAB_LABELS[lab as Lab] ?? lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  const service = await createServiceClient()
  const { data: subject } = await service.from('subjects').select('titre,confidentiel').eq('id', id).single()
  // Ne pas divulguer le titre d'un sujet confidentiel à un non-membre via les metadata.
  const isMember = !!(await getSession())?.member
  const title = subject && !(subject.confidentiel && !isMember) ? (subject.titre ?? id) : labLabel
  return { title: t('paperTitle', { title, lab: labLabel }) }
}

export default async function PaperPage({ params }: Props) {
  const { locale, lab, id } = await params
  if (!VALID_LABS.includes(lab as Lab)) notFound()

  const session = await getSession()
  const isMember = !!session?.member
  const service = await createServiceClient()

  // Nav (prev/next) : masquer les sujets confidentiels au visiteur.
  let navQuery = service.from('subjects').select('id,titre,statut,ordre').eq('labo', lab)
  if (!isMember) navQuery = navQuery.eq('confidentiel', false)

  const [{ data: subject }, { data: navRows }, { data: members }, { data: tasksRaw },
    { data: comments }, { data: links }] = await Promise.all([
    service.from('subjects').select('*').eq('id', id).single(),
    navQuery.order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
    service.from('tasks')
      .select('*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)')
      .eq('sujet_id', id).order('date_creation', { ascending: true }),
    service.from('comments').select('*').eq('sujet_id', id).order('created_at', { ascending: true }),
    service.from('dropbox_links').select('*').eq('subject_id', id),
  ])

  // Introuvable, ou rattaché à un autre lab sans être transversal → 404 (intégrité d'URL).
  if (!subject || (subject.labo !== lab && !subject.is_transversal)) notFound()
  // Visiteur : un sujet confidentiel n'existe pas (contenu, tâches, commentaires, fichiers protégés).
  if (subject.confidentiel && !isMember) notFound()

  // Flatten nested task_assignees(members(...)) → assignees: MemberRef[]
  const tasks = flattenTasks(tasksRaw ?? [])

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
      isMember={isMember}
    />
  )
}
