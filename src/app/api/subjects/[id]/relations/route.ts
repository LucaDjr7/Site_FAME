import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { normalizeAssocPair, wouldCreateCycle } from '@/lib/subjects/inheritance'
import { buildLabelI18n } from '@/lib/subjects/relation-label'
import { isOverBudget } from '@/lib/rag/usage'
import type { RelationKind } from '@/types'

type Params = { params: Promise<{ id: string }> }

export function parseRelationBody(body: unknown): { error?: string; value?: { kind: RelationKind; otherId: string; direction: 'child' | 'mother'; label: string; locale: 'en' | 'fr' } } {
  const b = (body ?? {}) as Record<string, unknown>
  const kind = b.kind
  if (kind !== 'parent' && kind !== 'assoc') return { error: 'invalid kind' }
  const otherId = typeof b.otherId === 'string' ? b.otherId : ''
  if (!otherId) return { error: 'otherId required' }
  const direction = b.direction === 'mother' ? 'mother' : 'child'
  const label = typeof b.label === 'string' ? b.label : ''
  const locale = b.locale === 'fr' ? 'fr' : 'en'
  return { value: { kind, otherId, direction, label, locale } }
}

/** Pour 'parent' : qui est mère (source) / fille (target) selon la direction depuis `id`. */
export function resolveParentEnds(id: string, otherId: string, direction: 'child' | 'mother'): { source_id: string; target_id: string } {
  return direction === 'mother' ? { source_id: otherId, target_id: id } : { source_id: id, target_id: otherId }
}

export async function POST(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const parsed = parseRelationBody(await req.json())
  if (parsed.error || !parsed.value) return NextResponse.json({ error: parsed.error ?? 'bad request' }, { status: 400 })
  const { kind, otherId, direction, label, locale } = parsed.value
  if (otherId === id) return NextResponse.json({ error: 'self link' }, { status: 409 })

  const service = await createServiceClient()

  if (kind === 'parent') {
    const { source_id, target_id } = resolveParentEnds(id, otherId, direction)
    const { data: edges } = await service.from('subject_relations').select('source_id,target_id').eq('kind', 'parent')
    if (wouldCreateCycle(source_id, target_id, edges ?? [])) {
      return NextResponse.json({ error: 'cycle' }, { status: 409 })
    }
    const { data, error } = await service.from('subject_relations')
      .insert({ source_id, target_id, kind: 'parent', label: '', label_i18n: {} }).select().single()
    if (error?.code === '23505') return NextResponse.json({ error: 'duplicate' }, { status: 409 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Mitigation TOCTOU : deux insertions concurrentes peuvent chacune passer le
    // check ci-dessus puis former un cycle. Re-vérifier APRÈS l'insert contre les
    // autres arêtes désormais visibles ; si un cycle est apparu, annuler l'insert.
    const { data: edgesAfter } = await service.from('subject_relations').select('id,source_id,target_id').eq('kind', 'parent')
    const otherEdges = (edgesAfter ?? []).filter((e: { id: string }) => e.id !== data.id)
    if (wouldCreateCycle(source_id, target_id, otherEdges)) {
      await service.from('subject_relations').delete().eq('id', data.id)
      return NextResponse.json({ error: 'cycle' }, { status: 409 })
    }
    return NextResponse.json({ relation: data }, { status: 201 })
  }

  // assoc : non orienté, normalisé
  const { source_id, target_id } = normalizeAssocPair(id, otherId)
  const label_i18n = await buildLabelI18n(label, locale, {
    disabled: process.env.ASSISTANT_DISABLED === '1', overBudget: await isOverBudget(),
  })
  const { data, error } = await service.from('subject_relations')
    .insert({ source_id, target_id, kind: 'assoc', label: label.trim(), label_i18n }).select().single()
  if (error?.code === '23505') return NextResponse.json({ error: 'duplicate' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ relation: data }, { status: 201 })
}
