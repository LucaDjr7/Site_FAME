import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  subject: { confidentiel: false } as null | { confidentiel: boolean },
  member: null as null | { id: string; prenom: string; nom: string },
}))
const insertSingle = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: { id: '1' }, error: null })))

vi.mock('@/lib/auth', () => ({ getSession: () => Promise.resolve(state.member ? { member: state.member } : null) }))
vi.mock('@/lib/rate-limit', () => ({ checkIpRateLimit: () => Promise.resolve(true) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) =>
      table === 'subjects'
        ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.subject, error: null }) }) }) }
        : { insert: () => ({ select: () => ({ single: insertSingle }) }) },
  }),
}))
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/comments', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => { state.subject = { confidentiel: false }; state.member = null; insertSingle.mockClear() })

describe('POST /api/comments — bornes', () => {
  it('refuse un texte > 4000 caractères (400)', async () => {
    const r = await POST(req({ sujet_id: 's', texte: 'a'.repeat(4001), visitor_prenom: 'A', visitor_nom: 'B' }))
    expect(r.status).toBe(400)
  })
  it('refuse un nom visiteur > 80 caractères (400)', async () => {
    const r = await POST(req({ sujet_id: 's', texte: 'ok', visitor_prenom: 'x'.repeat(81), visitor_nom: 'B' }))
    expect(r.status).toBe(400)
  })
  it('accepte un commentaire valide (201)', async () => {
    const r = await POST(req({ sujet_id: 's', texte: 'ok', visitor_prenom: 'A', visitor_nom: 'B' }))
    expect(r.status).toBe(201)
  })
})

describe('POST /api/comments — gate confidentiel (R3)', () => {
  it('404 si le sujet est introuvable', async () => {
    state.subject = null
    const r = await POST(req({ sujet_id: 'ghost', texte: 'ok', visitor_prenom: 'A', visitor_nom: 'B' }))
    expect(r.status).toBe(404)
    expect(insertSingle).not.toHaveBeenCalled()
  })
  it('404 pour un visiteur sur un sujet confidentiel', async () => {
    state.subject = { confidentiel: true }
    const r = await POST(req({ sujet_id: 's', texte: 'ok', visitor_prenom: 'A', visitor_nom: 'B' }))
    expect(r.status).toBe(404)
    expect(insertSingle).not.toHaveBeenCalled()
  })
  it('201 pour un membre sur un sujet confidentiel', async () => {
    state.subject = { confidentiel: true }
    state.member = { id: 'm1', prenom: 'Grace', nom: 'Hopper' }
    const r = await POST(req({ sujet_id: 's', texte: 'ok' }))
    expect(r.status).toBe(201)
    expect(insertSingle).toHaveBeenCalled()
  })
})
