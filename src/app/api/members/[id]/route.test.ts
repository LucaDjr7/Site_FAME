import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const state = { admin: true }
vi.mock('@/lib/auth', () => ({
  requireAdmin: async () => { if (!state.admin) throw { status: 403 } },
  requireMember: async () => { return { session: { user: { id: 'u1' }, member: { is_admin: true } } } },
  authErrorResponse: (e: { status: number }) => new Response('forbidden', { status: e.status }),
}))

let lastSelect = ''
const mockMember = { id: 'm1', email: 'ada@fame.org', prenom: 'Ada', nom: 'L', role: 'researcher', domaines: [], photo_url: null, is_admin: false }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: (cols: string) => { lastSelect = cols; return { eq: () => ({ single: async () => ({ data: mockMember, error: null }) }) } },
      update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: mockMember, error: null }) }) }) }),
      delete: () => ({ eq: () => ({ select: async () => ({ data: [{ id: 'm1' }], error: null }) }) }),
    }),
    auth: { admin: { deleteUser: async () => ({}) } },
  }),
}))

import { GET } from './route'

const makeReq = (id = 'm1') => new NextRequest(`http://localhost/api/members/${id}`)
beforeEach(() => { state.admin = true; lastSelect = '' })

describe('GET /api/members/[id]', () => {
  it('admin → 200 avec email', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'm1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe('ada@fame.org')
  })

  it('le select contient email', async () => {
    await GET(makeReq(), { params: Promise.resolve({ id: 'm1' }) })
    expect(lastSelect).toContain('email')
  })

  it('non-admin → 403', async () => {
    state.admin = false
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'm1' }) })
    expect(res.status).toBe(403)
  })
})
