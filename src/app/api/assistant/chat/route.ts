import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { clientIp } from '@/lib/rate-limit'
import { isAssistantEnabled } from '@/lib/rag/settings'
import { isOverBudget, recordUsage } from '@/lib/rag/usage'
import { checkRateLimitDb } from '@/lib/rag/rate-limit-db'
import { hashIp } from '@/lib/rag/ip-hash'
import { moderateInput } from '@/lib/rag/moderation'
import { detectInjection, maskPII } from '@/lib/rag/guardrails'
import { retrieve, type Tier } from '@/lib/rag/retrieve'
import { buildSystemPrompt } from '@/lib/rag/system-prompt'
import { logFlagged, logUnanswered } from '@/lib/rag/flagged-log'
import { getChatProvider, type ChatMessage } from '@/lib/llm'
import { createServiceClient } from '@/lib/supabase/server'
import { toolDefs, runTool } from '@/lib/rag/tools'
import type { ToolContext } from '@/lib/rag/tools/types'

const MAX_TURNS = 8
const MAX_QUESTION_LEN = 2000

function sse(body: ReadableStream): NextResponse {
  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

function singleMessageStream(event: string, payload: unknown): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      controller.close()
    },
  })
}

export async function POST(req: NextRequest) {
  // 1. Kill-switch + budget → mode dégradé
  if (!(await isAssistantEnabled()) || (await isOverBudget())) {
    return NextResponse.json({ degraded: true }, { status: 503 })
  }

  // 2. Corps
  let body: { messages?: ChatMessage[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }) }
  const messages = Array.isArray(body.messages) ? body.messages : null
  const lastUser = messages?.filter(m => m.role === 'user').at(-1)
  if (!messages || !lastUser || !lastUser.content?.trim()) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }
  const question = (lastUser.content ?? '').slice(0, MAX_QUESTION_LEN)

  // 3. Tier + rate-limit persistant
  const session = await getSession()
  const tier: Tier = session?.member ? 'member' : 'visitor'
  const ip = clientIp(req)
  const ipHash = hashIp(ip)
  const rlKey = tier === 'member' ? `member:${session!.member!.id}` : `ip:${ipHash}`
  const limit = tier === 'member' ? 60 : 12
  if (!(await checkRateLimitDb(rlKey, limit, 10 * 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  // 4. Modération + anti-injection → refus poli streamé
  const injection = detectInjection(question)
  const moderation = await moderateInput(question)
  if (moderation.flagged || injection.flagged) {
    await logFlagged(question, injection.reason ?? ((moderation.categories ?? []).join(',') || 'moderation'), ipHash)
    return sse(singleMessageStream('refusal', { text: "I can only help with questions about FAME's research. Could you rephrase your question about our work?" }))
  }

  // 5. Retrieve (filtre permissions en SQL)
  const chunks = await retrieve(question, tier)

  // 6. Court-circuit : rien d'ancré → non traité + CTA propose
  if (chunks.length === 0) {
    await logUnanswered(question, (lastUser.content ?? '').match(/[à-ÿ]/i) ? 'fr' : 'en', ipHash)
    return sse(singleMessageStream('unanswered', {
      text: "This topic isn't covered in FAME's content yet. You can propose it to the team.",
      proposeQuestion: question,
    }))
  }

  // 7. Génération streamée (N derniers tours seulement)
  const trimmed = messages.slice(-MAX_TURNS)
  const provider = getChatProvider()
  const chatMessages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(tier, chunks) },
    ...trimmed,
  ]
  const sources = chunks.map(c => ({ source_type: c.source_type, source_id: c.source_id, labo: c.labo }))

  // 7bis. Boucle d'outils (max 3 tours) avant le stream final.
  const service = await createServiceClient()
  const toolCtx: ToolContext = { tier, service: service as unknown as ToolContext['service'] }
  const defs = toolDefs()
  for (let i = 0; i < 3; i++) {
    const completion = await provider.complete(chatMessages, { tools: defs, maxTokens: 600 })
    if (completion.toolCalls.length === 0) break
    chatMessages.push({ role: 'assistant', content: completion.content, tool_calls: completion.toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })) })
    for (const call of completion.toolCalls) {
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(call.arguments) as Record<string, unknown> } catch { parsed = {} }
      const result = await runTool(call.name, parsed, toolCtx)
      chatMessages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify(result) })
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      controller.enqueue(enc.encode(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`))
      let outChars = 0
      try {
        for await (const delta of provider.stream(chatMessages, { maxTokens: 600 })) {
          const safe = maskPII(delta)
          outChars += safe.length
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta: safe })}\n\n`))
        }
      } catch {
        controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ text: 'generation failed' })}\n\n`))
      }
      controller.enqueue(enc.encode('event: done\ndata: {}\n\n'))
      controller.close()
      // Comptabilité approximative (tokens ≈ chars/4) hors flux pour ne pas bloquer.
      const tokensIn = Math.ceil(chatMessages.reduce((n, m) => n + (m.content ?? '').length, 0) / 4)
      void recordUsage(tokensIn, Math.ceil(outChars / 4))
    },
  })
  return sse(stream)
}
