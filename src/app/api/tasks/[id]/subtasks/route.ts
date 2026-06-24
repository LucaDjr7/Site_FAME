import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, assertLabAccess, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id: task_id } = await params
  const { label, ordre = 0 } = await req.json()
  const service = await createServiceClient()
  const { data: task } = await service.from('tasks').select('labo').eq('id', task_id).single()
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try { assertLabAccess(member, task.labo) } catch (e) { return authErrorResponse(e) }
  const { data, error } = await service.from('subtasks').insert({ task_id, label, ordre }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/tasks/[id]/subtasks — body: { subtask_id, done }
export async function PATCH(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { subtask_id, done } = await req.json()
  if (!subtask_id || typeof done !== 'boolean') {
    return NextResponse.json({ error: 'subtask_id and boolean done required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data: subtask } = await service.from('subtasks').select('task_id').eq('id', subtask_id).single()
  if (!subtask) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: task } = await service.from('tasks').select('labo').eq('id', subtask.task_id).single()
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try { assertLabAccess(member, task.labo) } catch (e) { return authErrorResponse(e) }
  const { data, error } = await service.from('subtasks').update({ done }).eq('id', subtask_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
