import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, getSession, authErrorResponse } from '@/lib/auth'
import { scheduleReindex, scheduleDeleteSubjectFiles } from '@/lib/rag/schedule'
import { buildSubjectI18n } from '@/lib/subjects/translate'
import { isOverBudget } from '@/lib/rag/usage'
import { isInheritableField } from '@/lib/subjects/inheritance'
import type { SubjectI18nFields } from '@/types'

type Params = { params: Promise<{ id: string }> }

export function sanitizeInherits(raw: unknown, validMotherIds: Set<string>): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isInheritableField(k) && typeof v === 'string' && validMotherIds.has(v)) out[k] = v
  }
  return out
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const isMember = !!(await getSession())?.member
  const service = await createServiceClient()
  const { data, error } = await service.from('subjects').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Visiteur : un sujet confidentiel n'existe pas (404, pas 403 → on ne révèle rien).
  if (data.confidentiel && !isMember) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json()
  const allowed = ['titre', 'kicker', 'question', 'accroche', 'periode', 'statut', 'difficulte', 'context', 'method', 'results', 'keywords', 'auteurs', 'dimensions', 'is_transversal', 'confidentiel']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if ('is_transversal' in updates) updates.is_transversal = !!updates.is_transversal
  if ('confidentiel' in updates) updates.confidentiel = !!updates.confidentiel
  // L'éditeur envoie le payload complet (avec `titre`) ; on (re)génère i18n depuis
  // la langue source = locale de l'éditeur. Les màj partielles sans `titre` ne touchent pas i18n.
  if ('titre' in body) {
    // body.locale is routing metadata (source language), never written to a column — not in `allowed`.
    const sourceLocale = body.locale === 'fr' ? 'fr' : 'en'
    const srcFields: SubjectI18nFields = {
      titre: body.titre ?? '', question: body.question ?? '', accroche: body.accroche ?? '',
      context: body.context ?? '', method: body.method ?? '', results: body.results ?? '',
      keywords: Array.isArray(body.keywords) ? body.keywords : [],
      dimensions: body.dimensions ?? { method: '', data: '', theory: '', writing: '' },
    }
    updates.i18n = await buildSubjectI18n(srcFields, sourceLocale, {
      disabled: process.env.ASSISTANT_DISABLED === '1',
      overBudget: await isOverBudget(),
    })
  }
  const service = await createServiceClient()
  if ('inherits' in body) {
    // mères réelles = sources des relations 'parent' dont la fille est `id`.
    const { data: parents } = await service.from('subject_relations').select('source_id').eq('kind', 'parent').eq('target_id', id)
    const motherIds = new Set((parents ?? []).map((p: { source_id: string }) => p.source_id))
    updates.inherits = sanitizeInherits(body.inherits, motherIds)
  }
  const { data, error } = await service.from('subjects').update(updates).eq('id', id).select().single()
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  scheduleReindex('subject', id)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()
  // Purger les `inherits` des filles qui héritaient de cette mère : le FK cascade
  // supprime les lignes `subject_relations` mais pas la map jsonb sur les filles.
  const { data: childRels } = await service.from('subject_relations').select('target_id').eq('kind', 'parent').eq('source_id', id)
  for (const cid of new Set((childRels ?? []).map((r: { target_id: string }) => r.target_id))) {
    const { data: child } = await service.from('subjects').select('inherits').eq('id', cid).single()
    const inh = (child?.inherits ?? {}) as Record<string, string>
    const cleaned = Object.fromEntries(Object.entries(inh).filter(([, m]) => m !== id))
    if (Object.keys(cleaned).length !== Object.keys(inh).length) {
      await service.from('subjects').update({ inherits: cleaned }).eq('id', cid)
    }
  }
  // Lire les chemins Storage AVANT le delete : le FK `on delete cascade` supprime
  // les lignes `subject_files`, donc les `storage_path` seraient introuvables après.
  const { data: filesToPurge } = await service.from('subject_files').select('storage_path').eq('subject_id', id)
  const storagePaths = ((filesToPurge ?? []) as Array<{ storage_path: string }>).map(f => f.storage_path)

  const { error } = await service.from('subjects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  scheduleReindex('subject', id)
  scheduleDeleteSubjectFiles(id, storagePaths)
  return NextResponse.json({ ok: true })
}
