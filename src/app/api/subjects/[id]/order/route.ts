import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, assertLabAccess, authErrorResponse } from '@/lib/auth'

// Body: { orderedIds: string[] } — full ordered array of subject IDs for a lab
export async function PATCH(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }

  const body = await req.json().catch(() => null)
  const orderedIds = body?.orderedIds
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 ||
      !orderedIds.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'orderedIds must be a non-empty string array' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Cross-lab : tous les sujets réordonnés doivent appartenir à un labo accessible.
  const { data: rows, error: readErr } = await service
    .from('subjects').select('labo').in('id', orderedIds)
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  const labos = [...new Set((rows ?? []).map((r: { labo: string }) => r.labo))]
  try {
    for (const labo of labos) assertLabAccess(member, labo as 'paris' | 'montreal')
  } catch (e) { return authErrorResponse(e) }

  // Mise à jour ordonnée — on remonte la première erreur.
  const results = await Promise.all(
    orderedIds.map((id, ordre) => service.from('subjects').update({ ordre }).eq('id', id))
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
