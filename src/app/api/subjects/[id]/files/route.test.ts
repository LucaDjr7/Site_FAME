import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let subject: unknown = { id: 's1', labo: 'paris' }
let insertResult: { data: unknown; error: unknown } = { data: { id: 'f1' }, error: null }
const removed: string[][] = []
vi.mock('@/lib/rag/schedule', () => ({ scheduleIndexFile: () => {}, scheduleReindex: () => {} }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: subject, error: subject ? null : { message: 'nf' } }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve(insertResult) }) }),
    }),
    storage: { from: () => ({ remove: (paths: string[]) => { removed.push(paths); return Promise.resolve({ error: null }) } }) },
  }),
}))

import { POST } from './route'

const params = { params: Promise.resolve({ id: 's1' }) }
const req = (b: unknown) => new NextRequest('http://localhost/api/subjects/s1/files', { method: 'POST', body: JSON.stringify(b) })
const valid = { storage_path: 's1/uuid', file_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 1000 }

beforeEach(() => {
  requireMember.mockReset(); requireMember.mockResolvedValue({ session: {}, member: { id: 'm' } })
  subject = { id: 's1', labo: 'paris' }
  insertResult = { data: { id: 'f1' }, error: null }
  removed.length = 0
})

describe('POST /api/subjects/[id]/files (register)', () => {
  it('400 si type non autorisé', async () => {
    expect((await POST(req({ ...valid, mime_type: 'x/y' }), params)).status).toBe(400)
  })
  it('400 si storage_path hors du dossier du sujet', async () => {
    expect((await POST(req({ ...valid, storage_path: 'other/uuid' }), params)).status).toBe(400)
  })
  it('400 si storage_path contient .. (path traversal)', async () => {
    expect((await POST(req({ ...valid, storage_path: 's1/../evil' }), params)).status).toBe(400)
  })
  it('404 si sujet inexistant', async () => {
    subject = null
    expect((await POST(req(valid), params)).status).toBe(404)
  })
  it('201 en succès', async () => {
    expect((await POST(req(valid), params)).status).toBe(201)
  })
  it("compense (supprime l'objet) si l'insert échoue", async () => {
    insertResult = { data: null, error: { message: 'db down' } }
    const res = await POST(req(valid), params)
    expect(res.status).toBe(500)
    expect(removed).toEqual([['s1/uuid']])
  })
})
