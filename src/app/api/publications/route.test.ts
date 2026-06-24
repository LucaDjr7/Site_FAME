import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const eqCalls: [string, unknown][] = []
vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    select: () => chain,
    eq: (c: string, v: unknown) => { eqCalls.push([c, v]); return chain },
    order: () => Promise.resolve({ data: [], error: null }),
  })
  return { createServiceClient: async () => ({ from: () => chain }) }
})

import { GET } from './route'

beforeEach(() => { eqCalls.length = 0 })

describe('GET /api/publications', () => {
  it('ne filtre plus par labo (toujours partagées)', async () => {
    const res = await GET(new NextRequest('http://localhost/api/publications?lab=paris'))
    expect(res.status).toBe(200)
    expect(eqCalls.find(([c]) => c === 'labo')).toBeUndefined()
  })
  it('valide toujours le lab slug (400 si invalide)', async () => {
    const res = await GET(new NextRequest('http://localhost/api/publications?lab=tokyo'))
    expect(res.status).toBe(400)
  })
})
