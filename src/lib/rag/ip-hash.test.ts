import { describe, it, expect } from 'vitest'
import { hashIp } from './ip-hash'

describe('hashIp', () => {
  it('déterministe et non réversible (pas l’IP en clair)', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4')
    expect(hashIp('1.2.3.4').length).toBe(64)
  })
})
