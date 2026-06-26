import { describe, it, expect, vi } from 'vitest'
import { checkRateLimitDb } from './rate-limit-db'

function makeService(currentCount: number) {
  const upsert = vi.fn(async () => ({ error: null }))
  const service = {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: currentCount > 0 ? { count: currentCount } : null, error: null }) }) }) }),
      upsert,
    }),
  }
  return { service, upsert }
}

describe('checkRateLimitDb', () => {
  it('autorise sous la limite et incrémente', async () => {
    const { service, upsert } = makeService(2)
    const ok = await checkRateLimitDb('member:1', 5, 60000, { service: service as never, now: 1_000_000 })
    expect(ok).toBe(true)
    expect(upsert).toHaveBeenCalled()
  })
  it('bloque à la limite', async () => {
    const { service } = makeService(5)
    const ok = await checkRateLimitDb('ip:abc', 5, 60000, { service: service as never, now: 1_000_000 })
    expect(ok).toBe(false)
  })
})
