import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
const getSession = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember(), getSession: () => getSession() }
})

// Le hook embed-on-write appelle after() hors scope de requête en test → no-op.
const scheduleDeleteSubjectFiles = vi.fn()
vi.mock('@/lib/rag/schedule', () => ({ scheduleReindex: () => {}, scheduleDeleteSubjectFiles: (id: string, paths?: string[]) => scheduleDeleteSubjectFiles(id, paths) }))

let updateVals: Record<string, unknown> = {}
let singleResult: { data: unknown; error: unknown } = { data: null, error: null }
let getResult: { data: unknown; error: unknown } = { data: null, error: null }
let subjectFilesResult: { data: unknown; error: unknown } = { data: [], error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'subject_files') {
        return { select: () => ({ eq: () => Promise.resolve(subjectFilesResult) }) }
      }
      if (table === 'subject_relations') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }
      }
      return {
        update: (vals: Record<string, unknown>) => { updateVals = vals; return {
          eq: () => ({ select: () => ({ single: () => Promise.resolve(singleResult) }) }) } },
        select: () => ({ eq: () => ({ single: () => Promise.resolve(getResult) }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }
    },
  }),
}))

vi.mock('@/lib/rag/usage', () => ({ isOverBudget: async () => false }))
vi.mock('@/lib/subjects/translate', () => ({ buildSubjectI18n: async () => ({ en: {}, fr: {} }) }))

import { GET, PATCH, DELETE } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/subjects/x', { method: 'PATCH', body: JSON.stringify(body) })
}
function getReq() {
  return new NextRequest('http://localhost/api/subjects/x')
}
function delReq() {
  return new NextRequest('http://localhost/api/subjects/x', { method: 'DELETE' })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris', is_admin: false } })
  getSession.mockReset()
  getSession.mockResolvedValue(null)
  updateVals = {}
  singleResult = { data: null, error: null }
  getResult = { data: null, error: null }
  subjectFilesResult = { data: [], error: null }
  scheduleDeleteSubjectFiles.mockClear()
})

describe('GET /api/subjects/[id] — confidentiel gating', () => {
  it('renvoie 404 si introuvable', async () => {
    getResult = { data: null, error: { message: 'no rows' } }
    expect((await GET(getReq(), { params: Promise.resolve({ id: 'x' }) })).status).toBe(404)
  })
  it('renvoie 404 pour un sujet confidentiel vu par un visiteur', async () => {
    getResult = { data: { id: 'x', confidentiel: true }, error: null }
    getSession.mockResolvedValue(null)
    expect((await GET(getReq(), { params: Promise.resolve({ id: 'x' }) })).status).toBe(404)
  })
  it('renvoie 200 pour un sujet confidentiel vu par un membre', async () => {
    getResult = { data: { id: 'x', confidentiel: true }, error: null }
    getSession.mockResolvedValue({ user: { id: 'u' }, member: { id: 'u' } })
    expect((await GET(getReq(), { params: Promise.resolve({ id: 'x' }) })).status).toBe(200)
  })
  it('renvoie 200 pour un sujet non confidentiel vu par un visiteur', async () => {
    getResult = { data: { id: 'x', confidentiel: false }, error: null }
    getSession.mockResolvedValue(null)
    expect((await GET(getReq(), { params: Promise.resolve({ id: 'x' }) })).status).toBe(200)
  })
})

describe('PATCH /api/subjects/[id]', () => {
  it('renvoie 404 si la ligne est introuvable (PGRST116)', async () => {
    singleResult = { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(404)
  })
  it('renvoie 500 sur autre erreur DB', async () => {
    singleResult = { data: null, error: { code: '08006', message: 'db down' } }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(500)
  })
  it('renvoie 200 en cas de succès', async () => {
    singleResult = { data: { id: 'x', titre: 'x' }, error: null }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(200)
  })
  it('whiteliste is_transversal dans l\'update', async () => {
    singleResult = { data: { id: 'x', is_transversal: true }, error: null }
    await PATCH(req({ is_transversal: true }), { params: Promise.resolve({ id: 'x' }) })
    expect(updateVals.is_transversal).toBe(true)
  })
  it('coerce is_transversal en booléen', async () => {
    singleResult = { data: { id: 'x', is_transversal: true }, error: null }
    await PATCH(req({ is_transversal: 1 }), { params: Promise.resolve({ id: 'x' }) })
    expect(updateVals.is_transversal).toBe(true)
  })
})

describe('DELETE /api/subjects/[id] — purge Storage', () => {
  it('lit les storage_path avant le delete et les passe au scheduler', async () => {
    subjectFilesResult = { data: [{ storage_path: 'x/a.pdf' }, { storage_path: 'x/b.png' }], error: null }
    const res = await DELETE(delReq(), { params: Promise.resolve({ id: 'x' }) })
    expect(res.status).toBe(200)
    expect(scheduleDeleteSubjectFiles).toHaveBeenCalledWith('x', ['x/a.pdf', 'x/b.png'])
  })
  it('sans fichier : passe un tableau vide', async () => {
    subjectFilesResult = { data: [], error: null }
    await DELETE(delReq(), { params: Promise.resolve({ id: 'x' }) })
    expect(scheduleDeleteSubjectFiles).toHaveBeenCalledWith('x', [])
  })
})
