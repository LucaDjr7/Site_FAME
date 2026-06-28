import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { scheduleReindex } from '@/lib/rag/schedule'
import type { Lab } from '@/types'
import { VALID_LABS } from '@/lib/constants'
import { buildSubjectI18n } from '@/lib/subjects/translate'
import { isOverBudget } from '@/lib/rag/usage'
import type { SubjectI18nFields } from '@/types'

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  if (!VALID_LABS.includes(lab)) {
    return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data, error } = await service
    .from('subjects')
    .select('*')
    .eq('labo', lab)
    .order('ordre', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    await requireMember()
  } catch (e) { return authErrorResponse(e) }

  const body = await req.json()
  const { labo, titre, kicker = '', question = '', accroche = '', periode = '',
    statut = 'active', difficulte = 'intermediate',
    context = '', method = '', results = '', keywords = [], auteurs = [], dimensions,
    is_transversal = false, confidentiel = false } = body

  if (!VALID_LABS.includes(labo) || !titre?.trim()) {
    return NextResponse.json({ error: 'labo and titre required' }, { status: 400 })
  }

  const service = await createServiceClient()
  // Get current max ordre for this lab
  const { data: last } = await service
    .from('subjects')
    .select('ordre')
    .eq('labo', labo)
    .order('ordre', { ascending: false })
    .limit(1)
    .single()

  const ordre = (last?.ordre ?? -1) + 1

  const safeKeywords = Array.isArray(keywords) ? keywords : []
  const dims = dimensions ?? { method: '', data: '', theory: '', writing: '' }
  const sourceLocale = body.locale === 'fr' ? 'fr' : 'en'
  const srcFields: SubjectI18nFields = { titre, question, accroche, context, method, results, keywords: safeKeywords, dimensions: dims }
  const i18n = await buildSubjectI18n(srcFields, sourceLocale, {
    disabled: process.env.ASSISTANT_DISABLED === '1',
    overBudget: await isOverBudget(),
  })

  const { data, error } = await service
    .from('subjects')
    .insert({ labo, titre, kicker, question, accroche, periode, statut, difficulte,
      context, method, results, keywords: safeKeywords, auteurs,
      dimensions: dims, ordre, i18n,
      is_transversal: !!is_transversal, confidentiel: !!confidentiel })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  scheduleReindex('subject', data.id)
  return NextResponse.json(data, { status: 201 })
}
