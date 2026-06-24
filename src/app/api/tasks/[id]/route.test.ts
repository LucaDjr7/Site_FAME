import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let singleResult: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve(singleResult) }) }) }),
    }),
  }),
}))

import { PATCH } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/x', { method: 'PATCH', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: { user: { id: 'u1' } }, member: { prenom: 'A', nom: 'B', labo: 'paris', is_admin: false } })
  singleResult = { data: null, error: null }
})

// body sans 'statut' → évite le precheck oldStatut (qui appelle .select().eq().single())
describe('PATCH /api/tasks/[id]', () => {
  it('renvoie 404 si la tâche est introuvable (PGRST116)', async () => {
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
})
