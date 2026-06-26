import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const state = { admin: true }
vi.mock('@/lib/auth', () => ({
  requireAdmin: async () => { if (!state.admin) throw { status: 403 } },
  authErrorResponse: (e: { status: number }) => new Response('forbidden', { status: e.status }),
}))
const upsert = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: async () => ({ from: () => ({ upsert }) }) }))

import { POST } from './route'
const post = (b: unknown) => new NextRequest('http://localhost/api/assistant/toggle', { method: 'POST', body: JSON.stringify(b) })
beforeEach(() => { state.admin = true; upsert.mockClear() })

describe('POST /api/assistant/toggle', () => {
  it('admin bascule l’état', async () => {
    const res = await POST(post({ enabled: false }))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ key: 'assistant_enabled', value: false }), expect.anything())
  })
  it('non-admin → 403', async () => {
    state.admin = false
    expect((await POST(post({ enabled: true }))).status).toBe(403)
  })
  it('corps invalide → 400', async () => {
    expect((await POST(post({}))).status).toBe(400)
  })
})
