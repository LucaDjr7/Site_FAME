import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

// Body: { orderedIds: string[] } — full ordered array of subject IDs for a lab
export async function PATCH(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { orderedIds }: { orderedIds: string[] } = await req.json()
  const service = await createServiceClient()
  const updates = orderedIds.map((id, ordre) =>
    service.from('subjects').update({ ordre }).eq('id', id)
  )
  await Promise.all(updates)
  return NextResponse.json({ ok: true })
}
