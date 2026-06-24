import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Auth mock ────────────────────────────────────────────────────────────────
// Keep assertLabAccess + authErrorResponse real; only stub requireMember
const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

// ── Supabase mock — differentiated by table ──────────────────────────────────
// Shared state variables, mutated per test in beforeEach
let taskLabo: string | null = 'paris'      // null = task not found
let subtaskTaskId: string | null = 'task1' // null = subtask not found (for PATCH)
let insertResult: { data: unknown; error: unknown } = { data: { id: 'st1', task_id: 'task1', label: 'foo', ordre: 0, done: false }, error: null }
let updateResult: { data: unknown; error: unknown } = { data: { id: 'st1', task_id: 'task1', done: true }, error: null }

const insertCalls: unknown[] = []
const updateCalls: unknown[] = []

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'tasks') {
        // Used by both POST (select by task_id from URL) and PATCH (select by subtask.task_id)
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
      // table === 'subtasks'
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve(
                subtaskTaskId === null
                  ? { data: null, error: { message: 'not found' } }
                  : { data: { task_id: subtaskTaskId }, error: null }
              ),
          }),
        }),
        insert: (row: unknown) => {
          insertCalls.push(row)
          return {
            select: () => ({
              single: () => Promise.resolve(insertResult),
            }),
          }
        },
        update: (patch: unknown) => {
          updateCalls.push(patch)
          return {
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve(updateResult),
              }),
            }),
          }
        },
      }
    },
  }),
}))

import { POST, PATCH } from './route'

// ── Helpers ───────────────────────────────────────────────────────────────────
function postReq(body: unknown = { label: 'My subtask', ordre: 0 }) {
  return new NextRequest('http://localhost/api/tasks/task1/subtasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function patchReq(body: unknown = { subtask_id: 'st1', done: true }) {
  return new NextRequest('http://localhost/api/tasks/task1/subtasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const postParams = { params: Promise.resolve({ id: 'task1' }) }

beforeEach(() => {
  requireMember.mockReset()
  insertCalls.length = 0
  updateCalls.length = 0
  taskLabo = 'paris'
  subtaskTaskId = 'task1'
  insertResult = { data: { id: 'st1', task_id: 'task1', label: 'My subtask', ordre: 0, done: false }, error: null }
  updateResult = { data: { id: 'st1', task_id: 'task1', done: true }, error: null }
  // Default member: paris, non-admin — matches taskLabo='paris'
  requireMember.mockResolvedValue({ member: { id: 'm1', labo: 'paris', is_admin: false } })
})

// ── POST tests ────────────────────────────────────────────────────────────────
describe('POST /api/tasks/[id]/subtasks', () => {
  it('retourne 401 si non authentifié', async () => {
    requireMember.mockRejectedValue(new (await import('@/lib/auth')).AuthError(401, 'Authentication required'))
    const res = await POST(postReq(), postParams)
    expect(res.status).toBe(401)
    expect(insertCalls).toHaveLength(0)
  })

  it('retourne 404 si la tâche n\'existe pas', async () => {
    taskLabo = null
    const res = await POST(postReq(), postParams)
    expect(res.status).toBe(404)
    expect(insertCalls).toHaveLength(0)
  })

  it('retourne 403 si le membre est d\'un autre labo (cross-lab, vrai assertLabAccess)', async () => {
    taskLabo = 'montreal'
    requireMember.mockResolvedValue({ member: { id: 'm1', labo: 'paris', is_admin: false } })
    const res = await POST(postReq(), postParams)
    expect(res.status).toBe(403)
    expect(insertCalls).toHaveLength(0)
  })

  it('laisse passer un admin même cross-lab', async () => {
    taskLabo = 'montreal'
    requireMember.mockResolvedValue({ member: { id: 'admin1', labo: 'paris', is_admin: true } })
    const res = await POST(postReq(), postParams)
    expect(res.status).toBe(201)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({ task_id: 'task1', label: 'My subtask', ordre: 0 })
  })

  it('crée la sous-tâche et renvoie 201 en cas de succès', async () => {
    const res = await POST(postReq(), postParams)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ id: 'st1', task_id: 'task1' })
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({ task_id: 'task1', label: 'My subtask', ordre: 0 })
  })
})

// ── PATCH tests ───────────────────────────────────────────────────────────────
describe('PATCH /api/tasks/[id]/subtasks', () => {
  it('retourne 401 si non authentifié', async () => {
    requireMember.mockRejectedValue(new (await import('@/lib/auth')).AuthError(401, 'Authentication required'))
    const res = await PATCH(patchReq())
    expect(res.status).toBe(401)
    expect(updateCalls).toHaveLength(0)
  })

  it('retourne 400 si subtask_id est absent', async () => {
    const res = await PATCH(patchReq({ done: true }))
    expect(res.status).toBe(400)
    expect(updateCalls).toHaveLength(0)
  })

  it('retourne 400 si done n\'est pas un booléen', async () => {
    const res = await PATCH(patchReq({ subtask_id: 'st1', done: 'yes' }))
    expect(res.status).toBe(400)
    expect(updateCalls).toHaveLength(0)
  })

  it('retourne 404 si la sous-tâche n\'existe pas', async () => {
    subtaskTaskId = null
    const res = await PATCH(patchReq())
    expect(res.status).toBe(404)
    expect(updateCalls).toHaveLength(0)
  })

  it('retourne 404 si la tâche propriétaire de la sous-tâche est introuvable', async () => {
    subtaskTaskId = 'task1'
    taskLabo = null
    const res = await PATCH(patchReq())
    expect(res.status).toBe(404)
    expect(updateCalls).toHaveLength(0)
  })

  it('retourne 403 si la sous-tâche appartient à une tâche d\'un autre labo (cross-lab, vrai assertLabAccess)', async () => {
    // subtask belongs to task1, task1 is montreal, member is paris
    taskLabo = 'montreal'
    requireMember.mockResolvedValue({ member: { id: 'm1', labo: 'paris', is_admin: false } })
    const res = await PATCH(patchReq())
    expect(res.status).toBe(403)
    expect(updateCalls).toHaveLength(0)
  })

  it('laisse passer un admin même cross-lab sur PATCH', async () => {
    taskLabo = 'montreal'
    requireMember.mockResolvedValue({ member: { id: 'admin1', labo: 'paris', is_admin: true } })
    const res = await PATCH(patchReq())
    expect(res.status).toBe(200)
    expect(updateCalls).toHaveLength(1)
  })

  it('met à jour done et renvoie 200 en cas de succès', async () => {
    const res = await PATCH(patchReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ id: 'st1', done: true })
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]).toMatchObject({ done: true })
  })
})
