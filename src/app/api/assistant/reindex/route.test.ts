import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { state, reindexAll, after } = vi.hoisted(() => ({
  state: { admin: true },
  reindexAll: vi.fn(async () => {}),
  after: vi.fn((fn: () => void) => fn()),
}))
vi.mock('@/lib/auth', () => ({
  requireAdmin: async () => { if (!state.admin) throw { status: 403 } },
  authErrorResponse: (e: { status: number }) => new Response('forbidden', { status: e.status }),
}))
vi.mock('@/lib/rag/index-source', () => ({ reindexAll }))
vi.mock('next/server', async (orig) => ({ ...(await orig() as object), after }))

import { POST } from './route'
const req = () => new NextRequest('http://localhost/api/assistant/reindex', { method: 'POST' })
beforeEach(() => { state.admin = true; reindexAll.mockClear() })

describe('POST /api/assistant/reindex', () => {
  it('admin → 202 et planifie reindexAll', async () => {
    const res = await POST(req())
    expect(res.status).toBe(202)
    expect(reindexAll).toHaveBeenCalled()
  })
  it('non-admin → 403', async () => {
    state.admin = false
    expect((await POST(req())).status).toBe(403)
  })
})
