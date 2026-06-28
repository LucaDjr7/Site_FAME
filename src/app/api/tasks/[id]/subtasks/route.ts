import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id: task_id } = await params
  const { label, ordre = 0 } = await req.json()
  if (typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'label required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data, error } = await service.from('subtasks').insert({ task_id, label, ordre }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/tasks/[id]/subtasks — body: { subtask_id, done }
export async function PATCH(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { subtask_id, done } = await req.json()
  if (!subtask_id || typeof done !== 'boolean') {
    return NextResponse.json({ error: 'subtask_id and boolean done required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data, error } = await service.from('subtasks').update({ done }).eq('id', subtask_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
