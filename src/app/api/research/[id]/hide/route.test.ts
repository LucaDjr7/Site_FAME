import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ member: { is_admin: true } }),
  authErrorResponse: () => new Response(null, { status: 403 }) as never,
}))
const single = vi.fn()
const update = vi.fn(() => ({ eq: () => ({ select: () => ({ single }) }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }), update }),
  }),
}))

import { POST } from './route'
import { requireAdmin } from '@/lib/auth'

beforeEach(() => vi.clearAllMocks())

describe('POST /api/research/[id]/hide', () => {
  // No RLS backstop: requireAdmin() IS the authorization boundary for this
  // state transition. This is the case that fails if the guard is removed.
  it('403s a non-admin caller, without touching the paper', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('not admin'))
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
    expect(update).not.toHaveBeenCalled()
    expect(single).not.toHaveBeenCalled()
  })

  it('404s when the paper does not exist', async () => {
    single.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('409s when the paper is not currently published', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'rejected' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(409)
  })

  it('hides a published paper and sets manual_override', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'published' }, error: null })
    single.mockResolvedValueOnce({ data: { id: '1', status: 'hidden' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'hidden', manual_override: true }))
  })
})
