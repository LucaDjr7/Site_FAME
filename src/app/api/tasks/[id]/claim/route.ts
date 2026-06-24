import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST: toggle — if already assigned, remove; otherwise add
export async function POST(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id: task_id } = await params
  const service = await createServiceClient()

  const { data: existing } = await service.from('task_assignees')
    .select('*').eq('task_id', task_id).eq('member_id', member.id).single()

  if (existing) {
    await service.from('task_assignees').delete().eq('task_id', task_id).eq('member_id', member.id)
    return NextResponse.json({ claimed: false })
  } else {
    await service.from('task_assignees').insert({ task_id, member_id: member.id })
    return NextResponse.json({ claimed: true })
  }
}
