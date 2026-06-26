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

  // 7bis. Boucle d'outils (max 3 tours), GÉNÉRATION UNIQUE.
  // La complétion qui ROMPT la boucle (toolCalls vides) porte le content final :
  // on l'émet directement comme un seul delta, AU LIEU de re-générer via stream().
  // stream() ne sert plus que de fallback (boucle épuisée ou complétion sans content).
  // Tradeoff assumé : sur le chemin sans-outil la réponse arrive en un seul delta
  // (plus de streaming token-par-token) — priorité produit « garde-fous/budget > UX RAG » ;
  // le streaming-avec-outils est une amélioration P4. Le contrat SSE reste respecté.
  // Comptabilité (tokens ≈ chars/4) : on compte TOUTES les complétions de la boucle
  // (in à chaque tour) + la sortie des tours-à-outils, et la réponse finale via outChars.
  const service = await createServiceClient()
  const toolCtx: ToolContext = { tier, service: service as unknown as ToolContext['service'] }
  const defs = toolDefs()
  let finalContent: string | null = null
  let loopTokensIn = 0
  let loopTokensOut = 0
  for (let i = 0; i < 3; i++) {
    loopTokensIn += Math.ceil(chatMessages.reduce((n, m) => n + (m.content ?? '').length, 0) / 4)
    const completion = await provider.complete(chatMessages, { tools: defs, maxTokens: 600 })
    if (completion.toolCalls.length === 0) {
      // Réponse finale : son content sera compté via outChars (pas ici → pas de double comptage).
      finalContent = completion.content
      break
    }
    // Tour produisant des outils : compter content + tool_calls sérialisés en sortie.
    loopTokensOut += Math.ceil(((completion.content ?? '').length + JSON.stringify(completion.toolCalls).length) / 4)
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
      if (finalContent && finalContent.trim()) {
        // Chemin résolu : émettre la réponse finale en un seul delta masqué.
        const safe = maskPII(finalContent)
        outChars = safe.length
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta: safe })}\n\n`))
      } else {
        // Fallback : la boucle a épuisé ses tours sans réponse, ou content vide.
        try {
          for await (const delta of provider.stream(chatMessages, { maxTokens: 600 })) {
            const safe = maskPII(delta)
            outChars += safe.length
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta: safe })}\n\n`))
          }
        } catch {
          controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ text: 'generation failed' })}\n\n`))
        }
      }
      controller.enqueue(enc.encode('event: done\ndata: {}\n\n'))
      controller.close()
      // Comptabilité hors flux : in = toutes les complétions ; out = tours-à-outils + réponse émise.
      void recordUsage(loopTokensIn, loopTokensOut + Math.ceil(outChars / 4))
    },
  })
  return sse(stream)
}
