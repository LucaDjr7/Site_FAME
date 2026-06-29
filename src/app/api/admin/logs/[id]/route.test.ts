import { describe, it, expect, vi } from 'vitest'

const updateEq = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/auth', () => ({ requireAdmin: vi.fn().mockResolvedValue({}), authErrorResponse: () => new Response('x', { status: 403 }) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn().mockResolvedValue({ from: () => ({ update: () => ({ eq: updateEq }) }) }) }))

import { PATCH } from './route'
function req(body: unknown) { return new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }) as never }

describe('PATCH /api/admin/logs/[id]', () => {
  it('met à jour resolved', async () => {
    const res = await PATCH(req({ resolved: true }), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(200)
    expect(updateEq).toHaveBeenCalled()
  })
  it('400 si resolved absent', async () => {
    const res = await PATCH(req({}), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(400)
  })
})
