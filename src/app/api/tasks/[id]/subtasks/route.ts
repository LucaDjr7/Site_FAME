import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { buildTaskI18n } from '@/lib/tasks/translate'
import { isOverBudget } from '@/lib/rag/usage'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id: task_id } = await params
  const { label, ordre = 0, locale = 'en' } = await req.json()
  if (typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'label required' }, { status: 400 })
  }
  const sourceLocale = locale === 'fr' ? 'fr' : 'en'
  const i18nFull = await buildTaskI18n(
    { titre: '', description: '', subtasks: [label] },
    sourceLocale,
    { disabled: process.env.ASSISTANT_DISABLED === '1', overBudget: await isOverBudget() },
  )
  const otherLocale = sourceLocale === 'en' ? 'fr' : 'en'
  const subI18n = {
    [sourceLocale]: { label },
    [otherLocale]: { label: (i18nFull[otherLocale]?.subtasks ?? [])[0] ?? label },
  }
  const service = await createServiceClient()
  const { data, error } = await service.from('subtasks').insert({ task_id, label, ordre, i18n: subI18n }).select().single()
  if (error?.code === '23503') return NextResponse.json({ error: 'Task not found' }, { status: 404 })
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
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
