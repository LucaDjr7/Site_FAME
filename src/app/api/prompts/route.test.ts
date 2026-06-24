import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

const orCalls: string[] = []
const eqCalls: [string, unknown][] = []
vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    select: () => chain,
    eq: (c: string, v: unknown) => { eqCalls.push([c, v]); return chain },
    or: (s: string) => { orCalls.push(s); return chain },
    order: () => Promise.resolve({ data: [], error: null }),
  })
  return { createServiceClient: async () => ({ from: () => chain }) }
})

import { GET } from './route'

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris' } })
  orCalls.length = 0; eqCalls.length = 0
})

describe('GET /api/prompts', () => {
  it('inclut les prompts transversaux via .or', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompts?lab=paris'))
    expect(res.status).toBe(200)
    expect(orCalls).toContain('labo.eq.paris,is_transversal.eq.true')
    expect(eqCalls.find(([c]) => c === 'labo')).toBeUndefined()
  })
})
