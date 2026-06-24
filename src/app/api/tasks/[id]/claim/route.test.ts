import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let existing: unknown = null  // row in task_assignees (null = not assigned)
let insertError: unknown = null
let deleteError: unknown = null

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: existing, error: null }),
          }),
        }),
      }),
      insert: () => Promise.resolve({ error: insertError }),
      delete: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: deleteError }),
        }),
      }),
    }),
  }),
}))

import { POST } from './route'

function req() {
  return new NextRequest('http://localhost/api/tasks/t1/claim', { method: 'POST' })
}
const params = { params: Promise.resolve({ id: 't1' }) }

beforeEach(() => {
  requireMember.mockReset()
  existing = null
  insertError = null
  deleteError = null
  requireMember.mockResolvedValue({ member: { id: 'm1', labo: 'paris', is_admin: false } })
})

describe('POST /api/tasks/[id]/claim', () => {
  it('réclame (insert) quand non assigné → claimed:true', async () => {
    const res = await POST(req(), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ claimed: true })
  })

  it('libère (delete) quand déjà assigné → claimed:false', async () => {
    existing = { task_id: 't1', member_id: 'm1' }
    const res = await POST(req(), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ claimed: false })
  })

  it('traite la violation d\'unicité (23505) comme claimed:true', async () => {
    insertError = { code: '23505', message: 'duplicate key' }
    const res = await POST(req(), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ claimed: true })
  })

  it('remonte une vraie erreur d\'insert en 500', async () => {
    insertError = { code: '42P01', message: 'relation does not exist' }
    const res = await POST(req(), params)
    expect(res.status).toBe(500)
  })

  it('remonte une erreur de delete en 500', async () => {
    existing = { task_id: 't1', member_id: 'm1' }
    deleteError = { code: 'XX000', message: 'boom' }
    const res = await POST(req(), params)
    expect(res.status).toBe(500)
  })
})
