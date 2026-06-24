import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeServiceMock } from '@/test/supabase-mock'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

const serviceMock = makeServiceMock({ data: [{ id: '1', email: 'a@b.c' }], error: null })
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => serviceMock.client,
}))

import { GET } from './route'
import { AuthError } from '@/lib/auth'

function req(lab: string) {
  return new NextRequest(`http://localhost/api/members?lab=${lab}`)
}

beforeEach(() => { requireMember.mockReset() })

describe('GET /api/members', () => {
  it('renvoie 401 si non authentifié', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'Authentication required'))
    const res = await GET(req('paris'))
    expect(res.status).toBe(401)
  })
  it('renvoie 400 si lab invalide même authentifié', async () => {
    requireMember.mockResolvedValue({})
    const res = await GET(req('berlin'))
    expect(res.status).toBe(400)
  })
  it('renvoie les membres si authentifié et lab valide', async () => {
    requireMember.mockResolvedValue({})
    const res = await GET(req('paris'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([{ id: '1', email: 'a@b.c' }])
  })
})
