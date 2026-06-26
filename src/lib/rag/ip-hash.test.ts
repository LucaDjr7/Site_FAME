import { describe, it, expect, afterEach, vi } from 'vitest'
import { hashIp } from './ip-hash'

describe('hashIp', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('déterministe et non réversible (pas l’IP en clair)', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4')
    expect(hashIp('1.2.3.4').length).toBe(64)
  })

  it('le sel (pepper server-only) modifie le hash', () => {
    const unsalted = hashIp('1.2.3.4')
    vi.stubEnv('ASSISTANT_IP_SALT', 'pepper')
    const salted = hashIp('1.2.3.4')
    expect(salted).not.toBe(unsalted)
    expect(salted.length).toBe(64)
    expect(salted).not.toContain('1.2.3.4')
    expect(salted).not.toContain('pepper')
  })
})
