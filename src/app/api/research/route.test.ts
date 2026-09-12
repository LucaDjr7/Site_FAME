import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  authErrorResponse: (e: unknown) => new Response(JSON.stringify({ error: String(e) }), { status: 403 }) as never,
}))
const insertSingle = vi.fn(async () => ({ data: { id: 'new-id' }, error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: insertSingle }) }),
    }),
  }),
}))

import { GET, POST } from './route'
import { requireAdmin } from '@/lib/auth'

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/research', () => {
  it('requires admin', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no'))
    const res = await GET(new NextRequest('http://localhost/api/research'))
    expect(res.status).toBe(403)
  })

  it('returns the list for an admin', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await GET(new NextRequest('http://localhost/api/research'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/research (manual add)', () => {
  it('requires title and url', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await POST(new NextRequest('http://localhost/api/research', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(400)
  })

  it('inserts a manual paper, published, with manual_override true', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await POST(new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'A manually added paper', url: 'https://example.com/x', authors: ['Z'] }),
    }))
    expect(res.status).toBe(201)
    expect(insertSingle).toHaveBeenCalled()
  })
})
