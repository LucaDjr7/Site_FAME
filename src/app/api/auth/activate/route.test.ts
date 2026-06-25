import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// État pilotable par test
let memberUpdateError: unknown = null
let invitationDeleteError: unknown = null

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'invitations') {
        return {
          // chaîne SELECT de validation du token
          select: () => ({ eq: () => ({ gt: () => ({ single: () => Promise.resolve({
            data: { id: 'inv1', member_id: 'm1', members: {} }, error: null,
          }) }) }) }),
          // chaîne DELETE de l'invitation
          delete: () => ({ eq: () => Promise.resolve({ error: invitationDeleteError }) }),
        }
      }
      // table === 'members'
      return { update: () => ({ eq: () => Promise.resolve({ error: memberUpdateError }) }) }
    },
    auth: { admin: { updateUserById: () => Promise.resolve({ error: null }) } },
  }),
}))

import { POST } from './route'

function req() {
  return new NextRequest('http://localhost/api/auth/activate', {
    method: 'POST', body: JSON.stringify({ token: 'tok', password: 'Password123' }),
  })
}

beforeEach(() => { memberUpdateError = null; invitationDeleteError = null })

describe('POST /api/auth/activate', () => {
  it('renvoie 500 si la mise à jour du membre échoue', async () => {
    memberUpdateError = { message: 'update failed' }
    expect((await POST(req())).status).toBe(500)
  })
  it('renvoie 200 si tout réussit', async () => {
    expect((await POST(req())).status).toBe(200)
  })
  it('renvoie 200 même si la suppression de l\'invitation échoue (non bloquant)', async () => {
    invitationDeleteError = { message: 'delete failed' }
    expect((await POST(req())).status).toBe(200)
  })
})

describe('activate — complexité mot de passe', () => {
  const reqPw = (b: unknown) =>
    new NextRequest('http://localhost/api/auth/activate', { method: 'POST', body: JSON.stringify(b) })
  it('refuse sans majuscule (400)', async () =>
    expect((await POST(reqPw({ token: 't', password: 'abcd1234' }))).status).toBe(400))
  it('refuse sans chiffre (400)', async () =>
    expect((await POST(reqPw({ token: 't', password: 'Abcdefgh' }))).status).toBe(400))
  it('refuse trop court (400)', async () =>
    expect((await POST(reqPw({ token: 't', password: 'Ab1' }))).status).toBe(400))
})
