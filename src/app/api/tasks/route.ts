import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, getSession, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'
import { VALID_LABS } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab')
  const subjectId = req.nextUrl.searchParams.get('subject_id')

  if (lab !== null && !VALID_LABS.includes(lab as Lab)) {
    return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  }
  const validLab = lab as Lab | null

  const isMember = !!(await getSession())?.member
  const service = await createServiceClient()

  let query = service
    .from('tasks')
    .select(`*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)`)
    .order('date_creation', { ascending: false })

  if (validLab) query = query.eq('labo', validLab)
  if (subjectId) query = query.eq('sujet_id', subjectId)

  // Visiteur : exclure les tâches rattachées à un sujet confidentiel.
  if (!isMember) {
    const { data: confRows } = await service.from('subjects').select('id').eq('confidentiel', true)
    const confIds = (confRows ?? []).map((r: { id: string }) => r.id)
    if (confIds.length) query = query.not('sujet_id', 'in', `(${confIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const body = await req.json()
  const { labo, titre, sujet_id, description = '', statut = 'to-do',
    difficulte = 'easy', assignee_ids = [], subtask_labels = [] } = body

  if (!VALID_LABS.includes(labo as Lab) || !titre?.trim() || !sujet_id) {
    return NextResponse.json({ error: 'labo, titre, sujet_id required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: task, error } = await service
    .from('tasks')
    .insert({ labo, titre, sujet_id, description, statut, difficulte })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert assignees
  if (assignee_ids.length > 0) {
    const { error: assigneeError } = await service.from('task_assignees').insert(assignee_ids.map((mid: string) => ({ task_id: task.id, member_id: mid })))
    if (assigneeError) return NextResponse.json({ error: assigneeError.message }, { status: 500 })
  }

  // Insert subtasks (inherit assignees)
  if (subtask_labels.length > 0) {
    const { data: subs, error: subtaskError } = await service.from('subtasks')
      .insert(subtask_labels.map((label: string, i: number) => ({ task_id: task.id, label, ordre: i })))
      .select()
    if (subtaskError) return NextResponse.json({ error: subtaskError.message }, { status: 500 })
    if (subs && assignee_ids.length > 0) {
      const subAssignees = subs.flatMap((s: { id: string }) =>
        assignee_ids.map((mid: string) => ({ subtask_id: s.id, member_id: mid }))
      )
      const { error: subAssigneeError } = await service.from('subtask_assignees').insert(subAssignees)
      if (subAssigneeError) return NextResponse.json({ error: subAssigneeError.message }, { status: 500 })
    }
  }

  return NextResponse.json(task, { status: 201 })
}
