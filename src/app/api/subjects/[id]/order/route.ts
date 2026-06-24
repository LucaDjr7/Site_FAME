import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

// Body: { orderedIds: string[] } — full ordered array of subject IDs for a lab
export async function PATCH(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }

  const body = await req.json().catch(() => null)
  const orderedIds = body?.orderedIds
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 ||
      !orderedIds.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'orderedIds must be a non-empty string array' }, { status: 400 })
  }

  const service = await createServiceClient()
  // Mise à jour ordonnée — on remonte la première erreur.
  const results = await Promise.all(
    orderedIds.map((id, ordre) => service.from('subjects').update({ ordre }).eq('id', id))
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
