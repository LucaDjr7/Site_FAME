import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

let lastSelect = ''
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: (cols: string) => { lastSelect = cols; return { eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) } },
    }),
  }),
}))
import { GET } from './route'

describe('GET /api/members — public (email désormais public)', () => {
  it('répond 200 sans authentification', async () => {
    const res = await GET(new NextRequest('http://localhost/api/members?lab=paris'))
    expect(res.status).toBe(200)
  })
  it('le select inclut email (projection publique) mais jamais "*"', async () => {
    await GET(new NextRequest('http://localhost/api/members?lab=paris'))
    expect(lastSelect).toContain('email')
    expect(lastSelect).not.toBe('*')
  })
  it('refuse un lab invalide (400)', async () => {
    expect((await GET(new NextRequest('http://localhost/api/members?lab=berlin'))).status).toBe(400)
  })
})
