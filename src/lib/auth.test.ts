import { describe, it, expect } from 'vitest'
import { assertLabAccess, AuthError } from './auth'
import type { Member } from '@/types'

function member(partial: Partial<Member>): Member {
  return {
    id: 'm1', prenom: 'A', nom: 'B', email: 'a@b.c', role: 'researcher',
    labo: 'paris', domaines: [], photo_url: null, is_admin: false,
    activated_at: null, created_at: '2026-01-01',
    ...partial,
  } as Member
}

describe('assertLabAccess', () => {
  it('autorise un membre sur son propre labo', () => {
    expect(() => assertLabAccess(member({ labo: 'paris' }), 'paris')).not.toThrow()
  })
  it('refuse un membre sur un autre labo (403)', () => {
    try {
      assertLabAccess(member({ labo: 'paris' }), 'montreal')
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(403)
    }
  })
  it("autorise un admin sur n'importe quel labo", () => {
    expect(() => assertLabAccess(member({ labo: 'paris', is_admin: true }), 'montreal')).not.toThrow()
  })
})
