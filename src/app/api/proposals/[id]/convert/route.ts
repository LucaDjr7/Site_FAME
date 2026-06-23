import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST (admin) — convert an accepted/pending proposal into a subject.
// Creates a subject pre-filled from the proposal, marks the proposal accepted,
// returns { subject_id } so the client can redirect to the new paper.
export async function POST(_req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireAdmin()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()

  const { data: proposal, error: pErr } = await service
    .from('proposals').select('*').eq('id', id).single()
  if (pErr || !proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (proposal.statut === 'rejected') {
    return NextResponse.json({ error: 'Cannot convert a rejected proposal' }, { status: 409 })
  }

  // Next ordre for the lab
  const { data: last } = await service
    .from('subjects').select('ordre').eq('labo', proposal.labo)
    .order('ordre', { ascending: false }).limit(1).maybeSingle()
  const ordre = (last?.ordre ?? -1) + 1

  const { data: subject, error: sErr } = await service.from('subjects').insert({
    labo: proposal.labo,
    difficulte: proposal.difficulte,
    titre: proposal.titre,
    kicker: '',
    statut: 'active',
    context: proposal.description,
    method: '',
    results: '',
    keywords: [proposal.domaine],
    auteurs: [],
    dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre,
  }).select().single()
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  await service.from('proposals').update({
    statut: 'accepted',
    traitee_at: new Date().toISOString(),
    traitee_par: member.id,
  }).eq('id', id)

  return NextResponse.json({ subject_id: subject.id }, { status: 201 })
}
