import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
const getSession = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember(), getSession: () => getSession() }
})
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/tasks/translate', () => ({ buildTaskI18n: vi.fn().mockResolvedValue({ en: {}, fr: {} }) }))

let singleResult: { data: unknown; error: unknown } = { data: null, error: null }
let subjResult: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => ({
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve(singleResult) }) }) }),
      select: () => ({ eq: () => ({ single: () => Promise.resolve(table === 'subjects' ? subjResult : singleResult) }) }),
    }),
  }),
}))

import { GET, PATCH } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/x', { method: 'PATCH', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: { user: { id: 'u1' } }, member: { prenom: 'A', nom: 'B', labo: 'paris', is_admin: false } })
  getSession.mockReset()
  getSession.mockResolvedValue(null)
  singleResult = { data: null, error: null }
  subjResult = { data: null, error: null }
})

describe('GET /api/tasks/[id] — confidentiel gating', () => {
  it('renvoie 404 si la tâche appartient à un sujet confidentiel (visiteur)', async () => {
    singleResult = { data: { id: 'x', sujet_id: 's1' }, error: null }
    subjResult = { data: { confidentiel: true }, error: null }
    getSession.mockResolvedValue(null)
    expect((await GET(new NextRequest('http://localhost/api/tasks/x'), { params: Promise.resolve({ id: 'x' }) })).status).toBe(404)
  })
  it('renvoie 200 si la tâche appartient à un sujet confidentiel (membre)', async () => {
    singleResult = { data: { id: 'x', sujet_id: 's1' }, error: null }
    subjResult = { data: { confidentiel: true }, error: null }
    getSession.mockResolvedValue({ user: { id: 'u' }, member: { id: 'u' } })
    expect((await GET(new NextRequest('http://localhost/api/tasks/x'), { params: Promise.resolve({ id: 'x' }) })).status).toBe(200)
  })
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
