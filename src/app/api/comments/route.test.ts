import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getSession: () => Promise.resolve(null) }))
vi.mock('@/lib/rate-limit', () => ({ checkIpRateLimit: () => Promise.resolve(true) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: '1' }, error: null }) }) }) }),
  }),
}))
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/comments', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => {})

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
