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

  // Idempotency: already converted — return the existing subject without re-inserting.
  if (proposal.subject_id) {
    return NextResponse.json({ subject_id: proposal.subject_id }, { status: 200 })
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

  // Update GARDÉ : ne lie la proposition que si `subject_id` est encore null.
  // Ferme la course (double-clic / requêtes admin concurrentes) sans migration :
  // une seule requête « gagne » le passage null→subject ; les autres ne touchent
  // aucune ligne et nettoient leur sujet orphelin.
  const { data: updatedRows, error: updErr } = await service.from('proposals').update({
    statut: 'accepted',
    traitee_at: new Date().toISOString(),
    traitee_par: member.id,
    subject_id: subject.id,
  }).eq('id', id).is('subject_id', null).select('id')

  if (updErr) {
    // Compensation : la proposition n'a pas pu être liée au sujet → on supprime
    // le sujet pour éviter un orphelin (sinon un retry recréerait un doublon).
    await service.from('subjects').delete().eq('id', subject.id)
    console.error('proposal convert: rolled back orphan subject after proposal update failure', { id, subjectId: subject.id, error: updErr.message })
    return NextResponse.json({ error: 'Conversion failed; rolled back' }, { status: 500 })
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Course perdue : une autre requête a déjà converti. On supprime notre sujet
    // orphelin et on renvoie le gagnant (idempotence).
    await service.from('subjects').delete().eq('id', subject.id)
    const { data: winner } = await service.from('proposals').select('subject_id').eq('id', id).maybeSingle()
    return NextResponse.json({ subject_id: winner?.subject_id ?? null }, { status: 200 })
  }

  return NextResponse.json({ subject_id: subject.id }, { status: 201 })
}
