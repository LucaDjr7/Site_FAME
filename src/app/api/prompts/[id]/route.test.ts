import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

// Le hook embed-on-write appelle after() hors scope de requête en test → no-op.
vi.mock('@/lib/rag/schedule', () => ({ scheduleReindex: () => {} }))

let updateVals: Record<string, unknown> = {}
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      update: (vals: Record<string, unknown>) => { updateVals = vals; return {
        eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'x', is_transversal: true }, error: null }) }) }) } },
    }),
  }),
}))

import { PATCH } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/prompts/x', { method: 'PATCH', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris' } })
  updateVals = {}
})

describe('PATCH /api/prompts/[id] is_transversal', () => {
  it('persiste is_transversal=true', async () => {
    await PATCH(req({ is_transversal: true }), { params: Promise.resolve({ id: 'x' }) })
    expect(updateVals.is_transversal).toBe(true)
  })
  it('persiste is_transversal=false (coercition booléenne)', async () => {
    await PATCH(req({ is_transversal: 0 }), { params: Promise.resolve({ id: 'x' }) })
    expect(updateVals.is_transversal).toBe(false)
  })
})
