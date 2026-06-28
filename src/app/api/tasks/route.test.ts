import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getSession = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, getSession: () => getSession() }
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

import { GET } from './route'

function req(qs = 'lab=paris') {
  return new NextRequest(`http://localhost/api/tasks?${qs}`)
}

beforeEach(() => {
  confIds = []
  notCalls = []
  taskData = []
  getSession.mockReset()
  getSession.mockResolvedValue(null)
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
