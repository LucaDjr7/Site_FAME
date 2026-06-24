import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let updateError: unknown = null
const updateCalls: unknown[][] = []
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      update: (vals: unknown) => ({
        eq: (_c: string, id: string) => {
          updateCalls.push([vals, id])
          return Promise.resolve({ error: updateError })
        },
      }),
    }),
  }),
}))

import { PATCH } from './route'
import { AuthError } from '@/lib/auth'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/subjects/x/order', {
    method: 'PATCH', body: JSON.stringify(body),
  })
}

beforeEach(() => {
  requireMember.mockReset()
  updateError = null; updateCalls.length = 0
  requireMember.mockResolvedValue({ member: { labo: 'paris', is_admin: false } })
})

describe('PATCH /api/subjects/[id]/order', () => {
  it('renvoie 401 si non authentifié', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'x'))
    expect((await PATCH(req({ orderedIds: ['a'] }))).status).toBe(401)
  })
  it('renvoie 400 si orderedIds absent, non-tableau, vide ou éléments non-string', async () => {
    expect((await PATCH(req({}))).status).toBe(400)
    expect((await PATCH(req({ orderedIds: 'nope' }))).status).toBe(400)
    expect((await PATCH(req({ orderedIds: [] }))).status).toBe(400)
    expect((await PATCH(req({ orderedIds: [1, 2] }))).status).toBe(400)
  })
  it('renvoie 500 si une mise à jour échoue', async () => {
    updateError = { message: 'db down' }
    expect((await PATCH(req({ orderedIds: ['a', 'b'] }))).status).toBe(500)
  })
  it('renvoie 200 et met à jour chaque id en cas de succès', async () => {
    const res = await PATCH(req({ orderedIds: ['a', 'b', 'c'] }))
    expect(res.status).toBe(200)
    expect(updateCalls.map((c) => c[1])).toEqual(['a', 'b', 'c'])
    expect(updateCalls.map((c) => c[0])).toEqual([{ ordre: 0 }, { ordre: 1 }, { ordre: 2 }])
  })
})
