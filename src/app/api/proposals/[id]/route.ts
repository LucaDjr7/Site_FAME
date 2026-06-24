import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import { sendProposalResultEmail } from '@/lib/resend/send-proposal-result'

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

  if (data?.proposant_email) {
    try {
      await sendProposalResultEmail({
        to: data.proposant_email,
        proposantPrenom: data.proposant_prenom,
        titreProposal: data.titre,
        statut,
        commentaire: data.commentaire_admin,
      })
    } catch (emailErr) {
      // Non-fatal: the decision is persisted regardless of email delivery.
      console.error('Failed to send proposal result email:', emailErr)
    }
  }
  return NextResponse.json(data)
}
