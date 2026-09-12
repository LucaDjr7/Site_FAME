import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  authErrorResponse: () => new Response(null, { status: 403 }) as never,
}))
const limit = vi.fn(async () => ({ data: [{ id: '1', source: 'arxiv', added: 3, skipped: 1, errors: 0, message: null, run_at: '2026-09-01T06:00:00Z' }], error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({ from: () => ({ select: () => ({ order: () => ({ limit }) }) }) }),
}))

import { GET } from './route'
import { requireAdmin } from '@/lib/auth'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/research/fetch-log', () => {
  it('requires admin', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no'))
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(403)
  })

  it('returns the last 20 runs for an admin', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(200)
    expect(limit).toHaveBeenCalledWith(20)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})
