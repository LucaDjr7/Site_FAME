import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Auth mock ────────────────────────────────────────────────────────────────
const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  // Keep assertLabAccess + authErrorResponse real; only stub requireMember
  return { ...actual, requireMember: () => requireMember() }
})

// ── Supabase mock — differentiated by table ──────────────────────────────────
// Shared state variables, mutated per test in beforeEach
let taskLabo: string | null = 'paris'  // null = task not found
let existing: unknown = null           // row in task_assignees (null = not assigned)
let insertError: unknown = null
let deleteError: unknown = null

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'tasks') {
        // select('labo').eq('id', task_id).single()
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve(
                  taskLabo === null
                    ? { data: null, error: { message: 'not found' } }
                    : { data: { labo: taskLabo }, error: null }
                ),
            }),
          }),
        }
      }
      // table === 'task_assignees'
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: existing, error: null }),
            }),
          }),
        }),
        insert: () => Promise.resolve({ error: insertError }),
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: deleteError }),
          }),
        }),
      }
    },
  }),
}))

import { POST } from './route'

// ── Helpers ───────────────────────────────────────────────────────────────────
function req() {
  return new NextRequest('http://localhost/api/tasks/t1/claim', { method: 'POST' })
}
const params = { params: Promise.resolve({ id: 't1' }) }

beforeEach(() => {
  requireMember.mockReset()
  existing = null
  insertError = null
  deleteError = null
  taskLabo = 'paris'
  // Default member: paris, non-admin — matches taskLabo='paris'
  requireMember.mockResolvedValue({ member: { id: 'm1', labo: 'paris', is_admin: false } })
})

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/tasks/[id]/claim', () => {
  // B3 — atomicity & error surfacing
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

  // B5-ext — cross-lab guard
  it('retourne 404 si la tâche n\'existe pas', async () => {
    taskLabo = null
    const res = await POST(req(), params)
    expect(res.status).toBe(404)
  })

  it('retourne 403 si le membre est d\'un autre labo (cross-lab)', async () => {
    taskLabo = 'montreal'
    // member is paris, task is montreal → assertLabAccess (real) must throw 403
    requireMember.mockResolvedValue({ member: { id: 'm1', labo: 'paris', is_admin: false } })
    const res = await POST(req(), params)
    expect(res.status).toBe(403)
  })

  it('laisse passer un admin même cross-lab', async () => {
    taskLabo = 'montreal'
    requireMember.mockResolvedValue({ member: { id: 'admin1', labo: 'paris', is_admin: true } })
    const res = await POST(req(), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ claimed: true })
  })
})
