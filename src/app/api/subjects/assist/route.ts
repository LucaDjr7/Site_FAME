import { NextRequest, NextResponse } from 'next/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { generateField } from '@/lib/subjects/generate-field'
import { isAssistField, type FieldDraft } from '@/lib/subjects/field-prompts'
import { isOverBudget } from '@/lib/rag/usage'

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }

  if (process.env.ASSISTANT_DISABLED === '1') {
    return NextResponse.json({ error: 'assistant disabled' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const { field, draft = {}, locale = 'en' } = body as { field?: string; draft?: FieldDraft; locale?: string }

  if (!field || !isAssistField(field)) {
    return NextResponse.json({ error: 'invalid field' }, { status: 400 })
  }
  if (await isOverBudget()) {
    return NextResponse.json({ error: 'budget exceeded' }, { status: 503 })
  }

  try {
    const text = await generateField(field, draft, locale === 'fr' ? 'fr' : 'en')
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
