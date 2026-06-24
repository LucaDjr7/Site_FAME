import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let deleteResult: { data: unknown; error: unknown } = { data: [], error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ delete: () => ({ eq: () => ({ select: () => Promise.resolve(deleteResult) }) }) }),
  }),
}))

import { DELETE } from './route'

const ctx = { params: Promise.resolve({ id: 'x' }) }
function req() { return new NextRequest('http://localhost/api/dropbox/links/x', { method: 'DELETE' }) }

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris' } })
  deleteResult = { data: [], error: null }
})

describe('DELETE /api/dropbox/links/[id]', () => {
  it('renvoie 404 si aucune ligne supprimée', async () => {
    deleteResult = { data: [], error: null }
    expect((await DELETE(req(), ctx)).status).toBe(404)
  })
  it('renvoie 500 sur erreur DB', async () => {
    deleteResult = { data: null, error: { message: 'db down' } }
    expect((await DELETE(req(), ctx)).status).toBe(500)
  })
  it('renvoie 200 quand une ligne est supprimée', async () => {
    deleteResult = { data: [{ id: 'x' }], error: null }
    expect((await DELETE(req(), ctx)).status).toBe(200)
  })
})
