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

beforeEach(() => vi.clearAllMocks())

describe('POST /api/research/[id]/publish', () => {
  it('409s when the paper is already published', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'published' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(409)
  })

  it('republishes a rejected paper', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'rejected' }, error: null })
    single.mockResolvedValueOnce({ data: { id: '1', status: 'published' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'published', manual_override: true }))
  })

  it('unhides a hidden paper', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'hidden' }, error: null })
    single.mockResolvedValueOnce({ data: { id: '1', status: 'published' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
  })
})
