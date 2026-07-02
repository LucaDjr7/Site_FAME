import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ rel: null as null | Record<string, unknown> }))
const deleteEq = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))

vi.mock('@/lib/auth', () => ({ requireMember: vi.fn().mockResolvedValue({}), authErrorResponse: () => new Response('x', { status: 401 }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'subject_relations') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.rel, error: null }) }) }),
          delete: () => ({ eq: deleteEq }),
        }
      }
      // subjects (purge inherits) — non atteint dans ces cas
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { inherits: {} }, error: null }) }) }), update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
    },
  }),
}))

import { DELETE } from './route'
function delReq() { return new NextRequest('http://localhost/api/subjects/S1/relations/R1', { method: 'DELETE' }) }

beforeEach(() => { state.rel = null; deleteEq.mockClear() })

describe('DELETE /api/subjects/[id]/relations/[relId] — intégrité d’URL', () => {
  it('404 si la relation est introuvable', async () => {
    state.rel = null
    const res = await DELETE(delReq(), { params: Promise.resolve({ id: 'S1', relId: 'R1' }) })
    expect(res.status).toBe(404)
    expect(deleteEq).not.toHaveBeenCalled()
  })
  it('404 si la relation n’appartient pas au sujet du chemin', async () => {
    state.rel = { id: 'R1', kind: 'assoc', source_id: 'OTHER', target_id: 'ALSO_OTHER' }
    const res = await DELETE(delReq(), { params: Promise.resolve({ id: 'S1', relId: 'R1' }) })
    expect(res.status).toBe(404)
    expect(deleteEq).not.toHaveBeenCalled()
  })
  it('200 si le sujet du chemin est une extrémité', async () => {
    state.rel = { id: 'R1', kind: 'assoc', source_id: 'S1', target_id: 'X' }
    const res = await DELETE(delReq(), { params: Promise.resolve({ id: 'S1', relId: 'R1' }) })
    expect(res.status).toBe(200)
    expect(deleteEq).toHaveBeenCalled()
  })
})
