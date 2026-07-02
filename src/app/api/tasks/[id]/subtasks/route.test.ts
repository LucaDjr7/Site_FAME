import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/tasks/translate', () => ({ buildTaskI18n: vi.fn().mockResolvedValue({ en: { subtasks: [] }, fr: { subtasks: [] } }) }))

let insertResult: { data: unknown; error: unknown } = { data: { id: 's1' }, error: null }
let updateResult: { data: unknown; error: unknown } = { data: { id: 's1', done: true }, error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve(insertResult) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve(updateResult) }) }) }),
    }),
  }),
}))

import { POST, PATCH } from './route'

const params = { params: Promise.resolve({ id: 't1' }) }
function req(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/t1/subtasks', { method: 'POST', body: JSON.stringify(body) })
}
function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/t1/subtasks', { method: 'PATCH', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { id: 'm' } })
  insertResult = { data: { id: 's1' }, error: null }
  updateResult = { data: { id: 's1', done: true }, error: null }
})

describe('POST /api/tasks/[id]/subtasks — validation du label', () => {
  it('refuse un label vide (400)', async () => {
    expect((await POST(req({ label: '   ' }), params)).status).toBe(400)
  })
  it('refuse un label absent (400)', async () => {
    expect((await POST(req({}), params)).status).toBe(400)
  })
  it('accepte un label valide (201)', async () => {
    expect((await POST(req({ label: 'Faire X' }), params)).status).toBe(201)
  })
  it('404 si la tâche parente n’existe pas (FK 23503)', async () => {
    insertResult = { data: null, error: { code: '23503', message: 'fk violation' } }
    expect((await POST(req({ label: 'X' }), params)).status).toBe(404)
  })
})

describe('PATCH /api/tasks/[id]/subtasks — done', () => {
  it('404 si la sous-tâche est introuvable (PGRST116)', async () => {
    updateResult = { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    expect((await PATCH(patchReq({ subtask_id: 'nope', done: true }))).status).toBe(404)
  })
  it('200 en cas de succès', async () => {
    expect((await PATCH(patchReq({ subtask_id: 's1', done: true }))).status).toBe(200)
  })
})
