import { describe, it, expect } from 'vitest'
import { rateLimit } from './rate-limit'

describe('rateLimit', () => {
  it('autorise jusqu’à la limite puis bloque', () => {
    const key = `k-${Math.random()}`
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(false)
  })
  it('isole les clés', () => {
    expect(rateLimit(`a-${Math.random()}`, 1, 1000)).toBe(true)
    expect(rateLimit(`b-${Math.random()}`, 1, 1000)).toBe(true)
  })
})
