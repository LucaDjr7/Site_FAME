import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST: toggle d'assignation. S'appuie sur la PK (task_id, member_id) de
// task_assignees pour l'atomicité : une violation d'unicité (23505) lors de
// l'insert signifie « déjà réclamé » (course gagnée par une autre requête).
export async function POST(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }

  const { id: task_id } = await params
  const service = await createServiceClient()

  // Lecture avec maybeSingle (pas de throw si absent)
  const { data: existing } = await service.from('task_assignees')
    .select('*').eq('task_id', task_id).eq('member_id', member.id).maybeSingle()

  if (existing) {
    const { error } = await service.from('task_assignees')
      .delete().eq('task_id', task_id).eq('member_id', member.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ claimed: false })
  }

  const { error } = await service.from('task_assignees').insert({ task_id, member_id: member.id })
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ claimed: true })
}
