import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { PaperView } from '@/components/paper/PaperView'
import { flattenTasks } from '@/components/tasks/kanban-shared'
import type { Lab, Subject, SubjectRelation, MemberRef, Comment, DropboxLink, SubjectFile } from '@/types'
import { VALID_LABS, LAB_LABELS } from '@/lib/constants'
import { toLocale2 } from '@/lib/subjects/localized'

type Props = { params: Promise<{ locale: string; lab: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, lab, id } = await params
  if (!VALID_LABS.includes(lab as Lab)) return { title: '' }
  const labLabel = LAB_LABELS[lab as Lab] ?? lab
  const t = await getTranslations({ locale, namespace: 'meta' })
  const service = await createServiceClient()
  const { data: subject } = await service.from('subjects').select('titre,confidentiel,i18n').eq('id', id).single()
  // Ne pas divulguer le titre d'un sujet confidentiel à un non-membre via les metadata.
  const isMember = !!(await getSession())?.member
  const localizedTitre = (subject?.i18n as Subject['i18n'] | undefined)?.[toLocale2(locale)]?.titre ?? subject?.titre
  const title = subject && !(subject.confidentiel && !isMember) ? (localizedTitre ?? id) : labLabel
  return { title: t('paperTitle', { title, lab: labLabel }) }
}

export default async function PaperPage({ params }: Props) {
  const { locale, lab, id } = await params
  if (!VALID_LABS.includes(lab as Lab)) notFound()
  // `id` est interpolé dans un filtre PostgREST `.or(...)` plus bas — exiger un UUID
  // strict ferme toute injection de clause de filtre via le segment d'URL.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()

  const session = await getSession()
  const isMember = !!session?.member
  const service = await createServiceClient()

  // Nav (prev/next) : masquer les sujets confidentiels au visiteur.
  let navQuery = service.from('subjects').select('id,titre,statut,ordre,i18n').eq('labo', lab)
  if (!isMember) navQuery = navQuery.eq('confidentiel', false)

  // All subjects for the relations panel link picker (members see all; visitors see public only).
  let allSubjectsQuery = service.from('subjects').select('id,titre,i18n')
  if (!isMember) allSubjectsQuery = allSubjectsQuery.eq('confidentiel', false)

  const [{ data: subject }, { data: navRows }, { data: members }, { data: tasksRaw },
    { data: comments }, { data: links }, { data: files }, { data: relRows }, { data: allSubjectsRows }] = await Promise.all([
    service.from('subjects').select('*').eq('id', id).single(),
    navQuery.order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
    service.from('tasks')
      .select('*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)')
      .eq('sujet_id', id).order('date_creation', { ascending: true }),
    service.from('comments').select('*').eq('sujet_id', id).order('created_at', { ascending: true }),
    service.from('dropbox_links').select('*').eq('subject_id', id),
    service.from('subject_files').select('*').eq('subject_id', id).order('created_at', { ascending: true }),
    service.from('subject_relations').select('*').or(`source_id.eq.${id},target_id.eq.${id}`),
    allSubjectsQuery.order('ordre', { ascending: true }),
  ])

  // Charger les sujets liés (avec gate confidentiel visiteur).
  const relatedIds = Array.from(new Set(
    (relRows ?? []).flatMap((r: SubjectRelation) => [r.source_id, r.target_id]).filter(x => x !== id)
  ))
  let related: Subject[] = []
  if (relatedIds.length) {
    let rq = service.from('subjects').select('*').in('id', relatedIds)
    if (!isMember) rq = rq.eq('confidentiel', false)
    related = ((await rq).data ?? []) as Subject[]
  }

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
      navSubjects={(navRows ?? []) as Pick<Subject, 'id' | 'titre' | 'statut' | 'ordre' | 'i18n'>[]}
      members={(members ?? []) as MemberRef[]}
      tasks={tasks}
      initialComments={(comments ?? []) as Comment[]}
      links={(links ?? []) as DropboxLink[]}
      files={(files ?? []) as SubjectFile[]}
      isMember={isMember}
      relations={(relRows ?? []) as SubjectRelation[]}
      relatedSubjects={related}
      allSubjects={(allSubjectsRows ?? []) as Pick<Subject, 'id' | 'titre' | 'i18n'>[]}
    />
  )
}
