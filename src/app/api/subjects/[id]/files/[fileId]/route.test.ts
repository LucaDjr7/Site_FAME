import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getSession = vi.fn()
const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, getSession: () => getSession(), requireMember: () => requireMember() }
})

let subject: unknown = { confidentiel: false }
let file: unknown = { id: 'f1', subject_id: 's1', storage_path: 's1/uuid', file_name: 'a.pdf' }
let updated: Record<string, unknown> = {}
const removed: string[][] = []
const createSignedUrl = vi.fn()
vi.mock('@/lib/rag/schedule', () => ({ scheduleDeleteFileChunks: () => {}, scheduleReindex: () => {}, scheduleRetierFile: () => {} }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: table === 'subjects' ? subject : file, error: (table === 'subjects' ? subject : file) ? null : { message: 'nf' } }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      update: (vals: Record<string, unknown>) => { updated = vals; return { eq: () => Promise.resolve({ error: null }) } },
    }),
    storage: { from: () => ({
      createSignedUrl: (...a: unknown[]) => createSignedUrl(...a),
      remove: (paths: string[]) => { removed.push(paths); return Promise.resolve({ error: null }) },
    }) },
  }),
}))

import { GET, DELETE, PATCH } from './route'
import { AuthError } from '@/lib/auth'

const params = { params: Promise.resolve({ id: 's1', fileId: 'f1' }) }
const gReq = () => new NextRequest('http://localhost/api/subjects/s1/files/f1')
const dReq = () => new NextRequest('http://localhost/api/subjects/s1/files/f1', { method: 'DELETE' })

beforeEach(() => {
  getSession.mockReset(); getSession.mockResolvedValue(null)
  requireMember.mockReset(); requireMember.mockResolvedValue({ session: {}, member: { id: 'm' } })
  subject = { confidentiel: false }
  file = { id: 'f1', subject_id: 's1', storage_path: 's1/uuid', file_name: 'a.pdf' }
  updated = {}
  removed.length = 0
  createSignedUrl.mockReset()
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.example/signed' }, error: null })
})

describe('GET /api/subjects/[id]/files/[fileId] (download)', () => {
  it('404 sujet confidentiel vu par un visiteur', async () => {
    subject = { confidentiel: true }
    expect((await GET(gReq(), params)).status).toBe(404)
  })
  it('302 sujet confidentiel vu par un membre', async () => {
    subject = { confidentiel: true }
    getSession.mockResolvedValue({ user: { id: 'u' }, member: { id: 'u' } })
    expect((await GET(gReq(), params)).status).toBe(302)
  })
  it('404 si le fichier appartient à un autre sujet', async () => {
    file = { id: 'f1', subject_id: 'OTHER', storage_path: 'x', file_name: 'a' }
    expect((await GET(gReq(), params)).status).toBe(404)
  })
  it('302 vers l\'URL signée en succès (visiteur, sujet public)', async () => {
    const res = await GET(gReq(), params)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://storage.example/signed')
  })
  it('404 doc confidentiel sur sujet public vu par un visiteur', async () => {
    file = { id: 'f1', subject_id: 's1', storage_path: 's1/uuid', file_name: 'a.pdf', confidentiel: true }
    expect((await GET(gReq(), params)).status).toBe(404)
  })
  it('302 doc confidentiel vu par un membre', async () => {
    file = { id: 'f1', subject_id: 's1', storage_path: 's1/uuid', file_name: 'a.pdf', confidentiel: true }
    getSession.mockResolvedValue({ user: { id: 'u' }, member: { id: 'u' } })
    expect((await GET(gReq(), params)).status).toBe(302)
  })
})

describe('DELETE /api/subjects/[id]/files/[fileId]', () => {
  it('401 si non-membre', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'x'))
    expect((await DELETE(dReq(), params)).status).toBe(401)
  })
  it('200 + suppression de l\'objet en succès', async () => {
    const res = await DELETE(dReq(), params)
    expect(res.status).toBe(200)
    expect(removed).toEqual([['s1/uuid']])
  })
})

const pReq = (b: unknown) => new NextRequest('http://localhost/api/subjects/s1/files/f1', { method: 'PATCH', body: JSON.stringify(b) })

describe('PATCH /api/subjects/[id]/files/[fileId]', () => {
  it('401 si non-membre', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'x'))
    expect((await PATCH(pReq({ confidentiel: true }), params)).status).toBe(401)
  })
  it('400 si confidentiel absent', async () => {
    expect((await PATCH(pReq({}), params)).status).toBe(400)
  })
  it('404 si le fichier appartient à un autre sujet', async () => {
    file = { id: 'f1', subject_id: 'OTHER' }
    expect((await PATCH(pReq({ confidentiel: true }), params)).status).toBe(404)
  })
  it('200 + met à jour confidentiel', async () => {
    const res = await PATCH(pReq({ confidentiel: true }), params)
    expect(res.status).toBe(200)
    expect(updated.confidentiel).toBe(true)
  })
})
