import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted ensures the spy is created before vi.mock factories are evaluated
// (vi.mock calls are hoisted to the top of the file by Vitest's transformer,
//  so any variable they close over must be hoisted too).
const streamSpy = vi.hoisted(() => vi.fn())

const mocks = {
  enabled: true, overBudget: false, rateOk: true, flagged: false, chunks: [] as unknown[],
}
vi.mock('@/lib/auth', () => ({ getSession: async () => null }))
vi.mock('@/lib/rate-limit', () => ({ clientIp: () => '1.2.3.4' }))
vi.mock('@/lib/rag/settings', () => ({ isAssistantEnabled: async () => mocks.enabled }))
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: async () => mocks.overBudget, recordUsage: async () => {} }))
vi.mock('@/lib/rag/rate-limit-db', () => ({ checkRateLimitDb: async () => mocks.rateOk }))
vi.mock('@/lib/rag/ip-hash', () => ({ hashIp: (s: string) => `h:${s}` }))
vi.mock('@/lib/rag/moderation', () => ({ moderateInput: async () => ({ flagged: mocks.flagged }) }))
vi.mock('@/lib/rag/guardrails', () => ({ detectInjection: () => ({ flagged: false }), maskPII: (s: string) => s }))
vi.mock('@/lib/rag/retrieve', () => ({ retrieve: async () => mocks.chunks }))
vi.mock('@/lib/rag/system-prompt', () => ({ buildSystemPrompt: () => 'sys' }))
vi.mock('@/lib/rag/flagged-log', () => ({ logFlagged: async () => {}, logUnanswered: async () => {} }))
vi.mock('@/lib/llm', () => ({
  getChatProvider: () => ({
    stream: streamSpy.mockImplementation(async function* () { yield 'hello' }),
  }),
}))

import { POST } from './route'
const post = (b: unknown) => new NextRequest('http://localhost/api/assistant/chat', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => {
  Object.assign(mocks, { enabled: true, overBudget: false, rateOk: true, flagged: false, chunks: [] })
  streamSpy.mockClear()
  // Re-apply default implementation after clear so nominal tests still get a working generator
  streamSpy.mockImplementation(async function* () { yield 'hello' })
})

describe('POST /api/assistant/chat — gardes', () => {
  it('kill-switch → 503', async () => { mocks.enabled = false; expect((await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))).status).toBe(503) })
  it('budget dépassé → 503', async () => { mocks.overBudget = true; expect((await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))).status).toBe(503) })
  it('rate-limit → 429', async () => { mocks.rateOk = false; expect((await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))).status).toBe(429) })
  it('corps invalide → 400', async () => { expect((await POST(post({}))).status).toBe(400) })
  it("modération flagged → 200 stream (refus poli, pas d'appel modèle)", async () => {
    mocks.flagged = true
    const res = await POST(post({ messages: [{ role: 'user', content: 'bad' }] }))
    expect(res.status).toBe(200)
  })
  it('cas nominal → 200 stream', async () => {
    mocks.chunks = [{ id: '1', source_type: 'kb', source_id: 'kb:x', content: 'c', labo: null, lang: 'en', similarity: 0.9 }]
    const res = await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })
})

describe('POST /api/assistant/chat — invariant pas-d\'appel-modèle sur chemins de garde', () => {
  it('modération flagged : aucun appel au modèle, SSE event:refusal', async () => {
    mocks.flagged = true
    const res = await POST(post({ messages: [{ role: 'user', content: 'bad content' }] }))
    expect(res.status).toBe(200)
    expect(streamSpy).not.toHaveBeenCalled()
    const body = await res.text()
    expect(body).toContain('event: refusal')
  })

  it('retrieval vide (unanswered) : aucun appel au modèle, SSE event:unanswered avec proposeQuestion', async () => {
    // mocks.chunks = [] is the default reset in beforeEach
    const userQuestion = 'What is the dark matter budget?'
    const res = await POST(post({ messages: [{ role: 'user', content: userQuestion }] }))
    expect(res.status).toBe(200)
    expect(streamSpy).not.toHaveBeenCalled()
    const body = await res.text()
    expect(body).toContain('event: unanswered')
    expect(body).toContain('proposeQuestion')
    expect(body).toContain(userQuestion)
  })

  it('rate-limit dépassé : aucun appel au modèle, statut 429', async () => {
    mocks.rateOk = false
    const res = await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(429)
    expect(streamSpy).not.toHaveBeenCalled()
  })

  it('kill-switch désactivé : aucun appel au modèle, statut 503', async () => {
    mocks.enabled = false
    const res = await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(res.status).toBe(503)
    expect(streamSpy).not.toHaveBeenCalled()
  })

  it('contrôle positif — chemin nominal : le modèle est appelé exactement une fois', async () => {
    mocks.chunks = [{ id: '1', source_type: 'kb', source_id: 'kb:x', content: 'relevant content', labo: null, lang: 'en', similarity: 0.9 }]
    const res = await POST(post({ messages: [{ role: 'user', content: 'Tell me about FAME research' }] }))
    // Drain the stream so the async generator inside ReadableStream has time to execute
    await res.text()
    expect(res.status).toBe(200)
    expect(streamSpy).toHaveBeenCalledTimes(1)
  })
})
