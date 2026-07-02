import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string; relId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id, relId } = await params
  const service = await createServiceClient()

  // Récupérer la relation pour purger l'héritage si c'était un parent.
  const { data: rel } = await service.from('subject_relations').select('*').eq('id', relId).single()
  // Intégrité d'URL : la relation doit appartenir au sujet du chemin (cohérence
  // avec files/[fileId] ; empêche de supprimer la relation d'un autre sujet).
  if (!rel || (rel.source_id !== id && rel.target_id !== id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (rel.kind === 'parent') {
    // fille = target_id ; retirer du `inherits` les clés pointant vers la mère = source_id.
    const { data: child } = await service.from('subjects').select('inherits').eq('id', rel.target_id).single()
    const inh = (child?.inherits ?? {}) as Record<string, string>
    const cleaned = Object.fromEntries(Object.entries(inh).filter(([, motherId]) => motherId !== rel.source_id))
    await service.from('subjects').update({ inherits: cleaned }).eq('id', rel.target_id)
  }
  const { error } = await service.from('subject_relations').delete().eq('id', relId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
