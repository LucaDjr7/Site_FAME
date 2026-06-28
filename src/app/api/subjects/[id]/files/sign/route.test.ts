import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let subject: unknown = { id: 's1' }
const createSignedUploadUrl = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: subject, error: subject ? null : { message: 'nf' } }) }) }) }),
    storage: { from: () => ({ createSignedUploadUrl: (...a: unknown[]) => createSignedUploadUrl(...a) }) },
  }),
}))

import { POST } from './route'
import { AuthError } from '@/lib/auth'

const params = { params: Promise.resolve({ id: 's1' }) }
const req = (b: unknown) => new NextRequest('http://localhost/api/subjects/s1/files/sign', { method: 'POST', body: JSON.stringify(b) })
const valid = { file_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 1000 }

beforeEach(() => {
  requireMember.mockReset(); requireMember.mockResolvedValue({ session: {}, member: { id: 'm' } })
  subject = { id: 's1' }
  createSignedUploadUrl.mockReset()
  createSignedUploadUrl.mockResolvedValue({ data: { path: 's1/uuid', token: 'tok', signedUrl: 'http://x' }, error: null })
})

describe('POST /api/subjects/[id]/files/sign', () => {
  it('401 si non-membre', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'x'))
    expect((await POST(req(valid), params)).status).toBe(401)
  })
  it('400 si type non autorisé', async () => {
    expect((await POST(req({ ...valid, mime_type: 'application/x-msdownload' }), params)).status).toBe(400)
  })
  it('400 si trop volumineux', async () => {
    expect((await POST(req({ ...valid, size_bytes: 60_000_000 }), params)).status).toBe(400)
  })
  it('404 si sujet inexistant', async () => {
    subject = null
    expect((await POST(req(valid), params)).status).toBe(404)
  })
  it('200 + path/token en succès', async () => {
    const res = await POST(req(valid), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ path: 's1/uuid', token: 'tok' })
  })
})
