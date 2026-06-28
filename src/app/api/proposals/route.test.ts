import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

let lastSelect = ''
vi.mock('@/lib/auth', () => ({ requireMember: () => Promise.resolve({}), authErrorResponse: () => new Response(null, { status: 401 }) }))
vi.mock('@/lib/rate-limit', () => ({ checkIpRateLimit: () => Promise.resolve(true) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: (cols: string) => { lastSelect = cols; return { in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }), eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) } },
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: '1' }, error: null }) }) }),
    }),
  }),
}))
import { GET, POST } from './route'
const post = (b: unknown) => new NextRequest('http://localhost/api/proposals', { method: 'POST', body: JSON.stringify(b) })
const valid = { labo: 'paris', titre: 'T', domaine: 'finance', difficulte: 'easy', description: 'D', proposant_prenom: 'A', proposant_nom: 'B' }

describe('proposals POST — bornes', () => {
  it('refuse titre > 300 (400)', async () => expect((await POST(post({ ...valid, titre: 't'.repeat(301) }))).status).toBe(400))
  it('refuse description > 5000 (400)', async () => expect((await POST(post({ ...valid, description: 'd'.repeat(5001) }))).status).toBe(400))
  it('refuse email mal formé (400)', async () => expect((await POST(post({ ...valid, proposant_email: 'pasunmail' }))).status).toBe(400))
})
describe('proposals GET ?ids — fuite de données', () => {
  it('le select public exclut proposant_email et commentaire_admin', async () => {
    await GET(new NextRequest('http://localhost/api/proposals?ids=a,b'))
    expect(lastSelect).not.toContain('proposant_email')
    expect(lastSelect).not.toContain('commentaire_admin')
    expect(lastSelect).not.toBe('*')
  })
})
