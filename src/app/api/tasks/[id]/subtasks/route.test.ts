import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/tasks/translate', () => ({ buildTaskI18n: vi.fn().mockResolvedValue({ en: { subtasks: [] }, fr: { subtasks: [] } }) }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 's1' }, error: null }) }) }),
    }),
  }),
}))

import { POST } from './route'

const params = { params: Promise.resolve({ id: 't1' }) }
function req(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/t1/subtasks', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { id: 'm' } })
})

describe('POST /api/tasks/[id]/subtasks — validation du label', () => {
  it('refuse un label vide (400)', async () => {
    expect((await POST(req({ label: '   ' }), params)).status).toBe(400)
  })
  it('refuse un label absent (400)', async () => {
    expect((await POST(req({}), params)).status).toBe(400)
  })
  it('accepte un label valide (201)', async () => {
    expect((await POST(req({ label: 'Faire X' }), params)).status).toBe(201)
  })
})
