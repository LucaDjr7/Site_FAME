import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireMember: vi.fn().mockResolvedValue({ member: { id: 'u1' } }),
  authErrorResponse: () => new Response(null, { status: 401 }) as never,
}))
const maybeSingle = vi.fn(async () => ({ data: null, error: null }))
const upsert = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }), upsert }),
  }),
}))

import { GET, PUT } from './route'
import { requireMember } from '@/lib/auth'

beforeEach(() => vi.clearAllMocks())

describe('/api/research/notes', () => {
  it('GET requires paper_id', async () => {
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(400)
  })

  it('GET returns null when the caller has no note on that paper', async () => {
    const res = await GET(new NextRequest('http://localhost/x?paper_id=p1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('PUT upserts content scoped to the caller + paper', async () => {
    const res = await PUT(new NextRequest('http://localhost/x', { method: 'PUT', body: JSON.stringify({ paper_id: 'p1', content: 'interesting result' }) }))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1', paper_id: 'p1', content: 'interesting result', updated_at: expect.any(String) })
  })

  it('PUT rejects an empty content', async () => {
    const res = await PUT(new NextRequest('http://localhost/x', { method: 'PUT', body: JSON.stringify({ paper_id: 'p1', content: '  ' }) }))
    expect(res.status).toBe(400)
  })

  // Notes are private per-member data and this repo has no RLS backstop:
  // requireMember() IS the authorization boundary. These are the cases that
  // fail if the guard is removed.
  it('GET → 401 when the caller is not signed in, without touching the database', async () => {
    (requireMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not signed in'))
    const res = await GET(new NextRequest('http://localhost/x?paper_id=p1'))
    expect(res.status).toBe(401)
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it('PUT → 401 when the caller is not signed in, without writing a note', async () => {
    (requireMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not signed in'))
    const res = await PUT(new NextRequest('http://localhost/x', { method: 'PUT', body: JSON.stringify({ paper_id: 'p1', content: 'x' }) }))
    expect(res.status).toBe(401)
    expect(upsert).not.toHaveBeenCalled()
  })
})
