import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getSession = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, getSession: () => getSession() }
})

// Records the filters applied to the subjects query so we can assert confidentiel gating.
let eqCalls: Array<[string, unknown]> = []
let resultData: unknown[] = []
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => {
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = (col: string, val: unknown) => { eqCalls.push([col, val]); return builder }
      builder.order = () => Promise.resolve({ data: resultData, error: null })
      return builder
    },
  }),
}))

import { GET } from './route'

function req(lab: string) {
  return new NextRequest(`http://localhost/api/subjects?lab=${lab}`)
}

beforeEach(() => {
  eqCalls = []
  resultData = []
  getSession.mockReset()
})

describe('GET /api/subjects — confidentiel gating', () => {
  it('rejette un lab invalide (400)', async () => {
    getSession.mockResolvedValue(null)
    expect((await GET(req('berlin'))).status).toBe(400)
  })

  it('exclut les sujets confidentiels pour un visiteur (non-membre)', async () => {
    getSession.mockResolvedValue(null)
    await GET(req('paris'))
    expect(eqCalls).toContainEqual(['confidentiel', false])
  })

  it('exclut les sujets confidentiels si session sans membre', async () => {
    getSession.mockResolvedValue({ user: { id: 'u' }, member: null })
    await GET(req('paris'))
    expect(eqCalls).toContainEqual(['confidentiel', false])
  })

  it("n'exclut PAS les confidentiels pour un membre", async () => {
    getSession.mockResolvedValue({ user: { id: 'u' }, member: { id: 'u', labo: 'paris' } })
    await GET(req('paris'))
    expect(eqCalls).not.toContainEqual(['confidentiel', false])
  })
})
