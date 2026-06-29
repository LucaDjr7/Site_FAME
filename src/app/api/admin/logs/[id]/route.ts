import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const { resolved } = await req.json().catch(() => ({}))
  if (typeof resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved boolean required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { error } = await service.from('chat_unanswered').update({ resolved }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
