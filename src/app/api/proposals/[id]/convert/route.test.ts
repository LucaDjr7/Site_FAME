import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireAdmin = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireAdmin: () => requireAdmin() }
})

let proposal: Record<string, unknown> | null
let updateError: unknown = null
const deletedSubjectIds: string[] = []
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'proposals') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: proposal, error: proposal ? null : { message: 'nf' } }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: updateError }) }),
        }
      }
      // subjects
      return {
        select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { ordre: 4 }, error: null }) }) }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'subj-new' }, error: null }) }) }),
        delete: () => ({ eq: (_c: string, id: string) => { deletedSubjectIds.push(id); return Promise.resolve({ error: null }) } }),
      }
    },
  }),
}))

import { POST } from './route'

function req() { return new NextRequest('http://localhost/api/proposals/p1/convert', { method: 'POST' }) }
const params = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => {
  requireAdmin.mockReset(); updateError = null; deletedSubjectIds.length = 0
  requireAdmin.mockResolvedValue({ member: { id: 'admin1' } })
  proposal = { id: 'p1', labo: 'paris', statut: 'pending', titre: 'T', description: 'D', domaine: 'finance', difficulte: 'easy', subject_id: null }
})

describe('POST /api/proposals/[id]/convert', () => {
  it('crée le sujet et renvoie 201 en cas de succès', async () => {
    const res = await POST(req(), params)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ subject_id: 'subj-new' })
    expect(deletedSubjectIds).toEqual([])
  })
  it('supprime le sujet et renvoie 500 si l\'update de la proposition échoue', async () => {
    updateError = { message: 'update failed' }
    const res = await POST(req(), params)
    expect(res.status).toBe(500)
    expect(deletedSubjectIds).toEqual(['subj-new']) // compensation
  })
  it('reste idempotent si déjà converti', async () => {
    proposal = { ...proposal, subject_id: 'existing' }
    const res = await POST(req(), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ subject_id: 'existing' })
  })
})
