import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireMember: vi.fn().mockResolvedValue({}), authErrorResponse: () => new Response('x', { status: 401 }) }))
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/tasks/generate-field', () => ({ generateTaskField: vi.fn().mockResolvedValue('Generated') }))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x/api/tasks/assist', { method: 'POST', body: JSON.stringify(body) }) as never
}

describe('POST /api/tasks/assist', () => {
  beforeEach(() => { delete process.env.ASSISTANT_DISABLED })
  it('renvoie le texte généré', async () => {
    const res = await POST(req({ field: 'titre', draft: { subjectTitre: 'S' }, locale: 'en' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Generated' })
  })
  it('400 si champ invalide', async () => {
    const res = await POST(req({ field: 'bogus' }))
    expect(res.status).toBe(400)
  })
  it('503 si ASSISTANT_DISABLED', async () => {
    process.env.ASSISTANT_DISABLED = '1'
    const res = await POST(req({ field: 'titre' }))
    expect(res.status).toBe(503)
  })
})
