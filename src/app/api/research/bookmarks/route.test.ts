import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireMember: vi.fn(),
  authErrorResponse: () => new Response(null, { status: 401 }) as never,
}))
const eqCalls: [string, unknown][] = []
const chain = {
  select: () => chain,
  eq: (c: string, v: unknown) => { eqCalls.push([c, v]); return chain },
  then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
}
const upsert = vi.fn(() => Promise.resolve({ error: null }))
const del = vi.fn(() => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({ from: () => ({ ...chain, upsert, delete: del }) }),
}))

import { GET, POST, DELETE } from './route'
import { requireMember } from '@/lib/auth'

beforeEach(() => { eqCalls.length = 0; vi.clearAllMocks() })

describe('/api/research/bookmarks', () => {
  it('GET requires a member and scopes to their own user_id', async () => {
    (requireMember as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { id: 'u1' } })
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(200)
    expect(eqCalls).toContainEqual(['user_id', 'u1'])
  })

  it('POST upserts a bookmark for the caller', async () => {
    (requireMember as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { id: 'u1' } })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ paper_id: 'p1' }) }))
    expect(res.status).toBe(201)
    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1', paper_id: 'p1' })
  })

  it('DELETE requires paper_id', async () => {
    (requireMember as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { id: 'u1' } })
    const res = await DELETE(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(400)
  })

  // There is no RLS backstop in this repo: requireMember() IS the entire
  // authorization boundary for this route. These three cases are what fails if
  // someone deletes the guard.
  describe('rejects an unauthenticated caller on every verb', () => {
    beforeEach(() => {
      (requireMember as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not signed in'))
    })

    it('GET → 401, and never reaches the database', async () => {
      const res = await GET(new NextRequest('http://localhost/x'))
      expect(res.status).toBe(401)
      expect(eqCalls).toEqual([])
    })

    it('POST → 401, and never writes a bookmark', async () => {
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ paper_id: 'p1' }) }))
      expect(res.status).toBe(401)
      expect(upsert).not.toHaveBeenCalled()
    })

    it('DELETE → 401, and never deletes a bookmark', async () => {
      const res = await DELETE(new NextRequest('http://localhost/x?paper_id=p1'))
      expect(res.status).toBe(401)
      expect(del).not.toHaveBeenCalled()
    })
  })
})
