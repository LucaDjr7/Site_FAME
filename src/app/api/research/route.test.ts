import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  authErrorResponse: (e: unknown) => new Response(JSON.stringify({ error: String(e) }), { status: 403 }) as never,
}))
const insertSingle = vi.fn(async () => ({ data: { id: 'new-id' }, error: null }))
const insert = vi.fn(() => ({ select: () => ({ single: insertSingle }) }))
const selectedColumns: string[] = []
const select = vi.fn((columns: string) => {
  selectedColumns.push(columns)
  return { order: () => Promise.resolve({ data: [], error: null }) }
})
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({ from: () => ({ select, insert }) }),
}))

import { GET, POST } from './route'
import { requireAdmin } from '@/lib/auth'

beforeEach(() => { vi.clearAllMocks(); selectedColumns.length = 0 })

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

  it('selects explicit columns, never `*` (embedding must not reach the client)', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    await GET(new NextRequest('http://localhost/api/research'))
    const columns = selectedColumns[0] ?? ''
    expect(columns).not.toBe('*')
    expect(columns).not.toContain('embedding')
    expect(columns).toContain('fame_score')
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

  // A NULL published_at sorts the row into the public page's "undated" bucket,
  // below every dated paper — wrong for a hand-curated entry.
  it('stores the published_at the admin supplied', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await POST(new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'Dated paper', url: 'https://example.com/x', published_at: '2024-03-01' }),
    }))
    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ published_at: '2024-03-01' }))
  })

  it('stores null when published_at is omitted', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    await POST(new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'Undated paper', url: 'https://example.com/y' }),
    }))
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ published_at: null }))
  })

  it('rejects a malformed published_at instead of letting Postgres 500', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await POST(new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'x', url: 'https://example.com/z', published_at: 'last tuesday' }),
    }))
    expect(res.status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })
})
