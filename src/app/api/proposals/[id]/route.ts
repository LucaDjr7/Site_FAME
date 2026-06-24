import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// PATCH (admin) — accept/reject with optional admin comment.
// Body: { statut: 'accepted' | 'rejected', commentaire_admin?: string }
export async function PATCH(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireAdmin()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const { statut, commentaire_admin = null } = await req.json()

  if (statut !== 'accepted' && statut !== 'rejected') {
    return NextResponse.json({ error: 'statut must be accepted or rejected' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data, error } = await service.from('proposals').update({
    statut, commentaire_admin, traitee_at: new Date().toISOString(), traitee_par: member.id,
  }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // TODO Part 3 (Task 16): if data.proposant_email, send decision feedback email via Resend.
  return NextResponse.json(data)
}
