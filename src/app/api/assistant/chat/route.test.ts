import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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
vi.mock('@/lib/llm', () => ({ getChatProvider: () => ({ async *stream() { yield 'hello' } }) }))

import { POST } from './route'
const post = (b: unknown) => new NextRequest('http://localhost/api/assistant/chat', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => { Object.assign(mocks, { enabled: true, overBudget: false, rateOk: true, flagged: false, chunks: [] }) })

describe('POST /api/assistant/chat — gardes', () => {
  it('kill-switch → 503', async () => { mocks.enabled = false; expect((await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))).status).toBe(503) })
  it('budget dépassé → 503', async () => { mocks.overBudget = true; expect((await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))).status).toBe(503) })
  it('rate-limit → 429', async () => { mocks.rateOk = false; expect((await POST(post({ messages: [{ role: 'user', content: 'hi' }] }))).status).toBe(429) })
  it('corps invalide → 400', async () => { expect((await POST(post({}))).status).toBe(400) })
  it('modération flagged → 200 stream (refus poli, pas d’appel modèle)', async () => {
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
