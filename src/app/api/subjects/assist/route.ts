import { NextRequest, NextResponse } from 'next/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { generateField } from '@/lib/subjects/generate-field'
import { isAssistField, type FieldDraft } from '@/lib/subjects/field-prompts'
import { isOverBudget } from '@/lib/rag/usage'
import { retrieveSubjectFiles } from '@/lib/rag/retrieve'
import { checkRateLimitDb } from '@/lib/rag/rate-limit-db'

// Routes longues (LLM/SSE, extraction+embedding) : éviter la coupure au défaut Vercel (~10-15 s).
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let memberId: string
  try { const { member } = await requireMember(); memberId = member.id } catch (e) { return authErrorResponse(e) }

  if (process.env.ASSISTANT_DISABLED === '1') {
    return NextResponse.json({ error: 'assistant disabled' }, { status: 503 })
  }

  // Génération LLM payante : rate-limit par membre (comme /api/assistant/chat) pour qu'un
  // compte négligent ou compromis ne puisse pas épuiser le budget mensuel en boucle.
  if (!(await checkRateLimitDb(`assist:${memberId}`, 30, 10 * 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { field, draft = {}, locale = 'en', subjectId } = body as { field?: string; draft?: FieldDraft; locale?: string; subjectId?: string }

  if (!field || !isAssistField(field)) {
    return NextResponse.json({ error: 'invalid field' }, { status: 400 })
  }
  if (await isOverBudget()) {
    return NextResponse.json({ error: 'budget exceeded' }, { status: 503 })
  }

  try {
    let context: string | undefined
    if (subjectId && typeof subjectId === 'string') {
      const query = `${draft.titre ?? ''} ${draft.question ?? ''} ${field}`.trim() || field
      const chunks = await retrieveSubjectFiles(query, subjectId, { matchCount: 4 })
      if (chunks.length) context = chunks.map((c) => c.content).join('\n\n')
    }
    const text = await generateField(field, draft, locale === 'fr' ? 'fr' : 'en', {}, context)
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
