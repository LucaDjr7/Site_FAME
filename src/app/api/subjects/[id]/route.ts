import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { scheduleReindex } from '@/lib/rag/schedule'
import { buildSubjectI18n } from '@/lib/subjects/translate'
import { isOverBudget } from '@/lib/rag/usage'
import type { SubjectI18nFields } from '@/types'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const service = await createServiceClient()
  const { data, error } = await service.from('subjects').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
  const { error } = await service.from('subjects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  scheduleReindex('subject', id)
  return NextResponse.json({ ok: true })
}
