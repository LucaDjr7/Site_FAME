import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getSession = vi.fn()
const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, getSession: () => getSession(), requireMember: () => requireMember() }
})

let confIds: string[] = []
let notCalls: Array<[string, string, string]> = []
let taskData: unknown[] = []
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'subjects') {
        return { select: () => ({ eq: () => Promise.resolve({ data: confIds.map((id) => ({ id })), error: null }) }) }
      }
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.order = () => b
      b.eq = () => b
      b.not = (col: string, op: string, val: string) => { notCalls.push([col, op, val]); return b }
      b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: taskData, error: null }).then(resolve)
      return b
    },
  }),
}))

import { GET, POST } from './route'

function req(qs = 'lab=paris') {
  return new NextRequest(`http://localhost/api/tasks?${qs}`)
}
function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/tasks', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  confIds = []
  notCalls = []
  taskData = []
  getSession.mockReset()
  getSession.mockResolvedValue(null)
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { id: 'm', labo: 'paris' } })
})

describe('POST /api/tasks — validation du slug labo', () => {
  it('refuse un labo invalide (400)', async () => {
    const res = await POST(postReq({ labo: 'berlin', titre: 'T', sujet_id: 's1' }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/tasks — confidentiel gating', () => {
  it('exclut les tâches des sujets confidentiels pour un visiteur', async () => {
    confIds = ['s1', 's2']
    getSession.mockResolvedValue(null)
    await GET(req())
    expect(notCalls).toContainEqual(['sujet_id', 'in', '(s1,s2)'])
  })

  it("n'applique aucune exclusion s'il n'y a aucun sujet confidentiel", async () => {
    confIds = []
    getSession.mockResolvedValue(null)
    await GET(req())
    expect(notCalls).toHaveLength(0)
  })

  it("n'exclut rien pour un membre", async () => {
    confIds = ['s1']
    getSession.mockResolvedValue({ user: { id: 'u' }, member: { id: 'u' } })
    await GET(req())
    expect(notCalls).toHaveLength(0)
  })
})
