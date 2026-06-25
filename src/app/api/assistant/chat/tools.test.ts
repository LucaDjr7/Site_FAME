import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getSession: async () => ({ member: { id: 'm1' } }) }))
vi.mock('@/lib/rate-limit', () => ({ clientIp: () => '1.2.3.4' }))
vi.mock('@/lib/rag/settings', () => ({ isAssistantEnabled: async () => true }))
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: async () => false, recordUsage: async () => {} }))
vi.mock('@/lib/rag/rate-limit-db', () => ({ checkRateLimitDb: async () => true }))
vi.mock('@/lib/rag/ip-hash', () => ({ hashIp: (s: string) => s }))
vi.mock('@/lib/rag/moderation', () => ({ moderateInput: async () => ({ flagged: false }) }))
vi.mock('@/lib/rag/guardrails', () => ({ detectInjection: () => ({ flagged: false }), maskPII: (s: string) => s }))
vi.mock('@/lib/rag/retrieve', () => ({ retrieve: async () => [{ id: '1', source_type: 'subject', source_id: 's1', content: 'c', labo: 'paris', lang: 'en', similarity: 0.9 }] }))
vi.mock('@/lib/rag/system-prompt', () => ({ buildSystemPrompt: () => 'sys' }))
vi.mock('@/lib/rag/flagged-log', () => ({ logFlagged: async () => {}, logUnanswered: async () => {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: async () => ({ from: () => ({}) }) }))

// vi.hoisted: vi.mock factories are hoisted above const declarations, so the
// spy they reference must be hoisted too (else "Cannot access before initialization").
const runTool = vi.hoisted(() => vi.fn(async () => ({ tasks: [] })))
vi.mock('@/lib/rag/tools', () => ({
  toolDefs: () => [{ type: 'function', function: { name: 'find_tasks' } }],
  runTool,
}))

const provider = {
  // 1er complete → demande un outil ; 2e → plus d'outils
  complete: vi.fn()
    .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'find_tasks', arguments: '{"labo":"paris"}' }] })
    .mockResolvedValueOnce({ content: null, toolCalls: [] }),
  async *stream() { yield 'final answer' },
}
vi.mock('@/lib/llm', () => ({ getChatProvider: () => provider }))

import { POST } from './route'
const post = (b: unknown) => new NextRequest('http://localhost/api/assistant/chat', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => { runTool.mockClear() })

describe('boucle d’outils', () => {
  it('exécute l’outil puis streame la réponse finale', async () => {
    const res = await POST(post({ messages: [{ role: 'user', content: 'tasks in paris?' }] }))
    expect(res.status).toBe(200)
    expect(runTool).toHaveBeenCalledWith('find_tasks', { labo: 'paris' }, expect.objectContaining({ tier: 'member' }))
  })
})
