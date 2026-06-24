import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let updateVals: Record<string, unknown> = {}
let singleResult: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      update: (vals: Record<string, unknown>) => { updateVals = vals; return {
        eq: () => ({ select: () => ({ single: () => Promise.resolve(singleResult) }) }) } },
    }),
  }),
}))

import { PATCH } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/subjects/x', { method: 'PATCH', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris', is_admin: false } })
  updateVals = {}
  singleResult = { data: null, error: null }
})

describe('PATCH /api/subjects/[id]', () => {
  it('renvoie 404 si la ligne est introuvable (PGRST116)', async () => {
    singleResult = { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(404)
  })
  it('renvoie 500 sur autre erreur DB', async () => {
    singleResult = { data: null, error: { code: '08006', message: 'db down' } }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(500)
  })
  it('renvoie 200 en cas de succès', async () => {
    singleResult = { data: { id: 'x', titre: 'x' }, error: null }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(200)
  })
  it('whiteliste is_transversal dans l\'update', async () => {
    singleResult = { data: { id: 'x', is_transversal: true }, error: null }
    await PATCH(req({ is_transversal: true }), { params: Promise.resolve({ id: 'x' }) })
    expect(updateVals.is_transversal).toBe(true)
  })
})
