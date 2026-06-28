import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const checkRateLimitDb = vi.fn()
vi.mock('@/lib/rag/rate-limit-db', () => ({ checkRateLimitDb: (...a: unknown[]) => checkRateLimitDb(...a) }))

import { checkIpRateLimit, clientIp } from './rate-limit'

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/x', { headers })
}

beforeEach(() => checkRateLimitDb.mockReset())

describe('clientIp', () => {
  it('prend la première IP de x-forwarded-for', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })
  it('retombe sur x-real-ip', () => {
    expect(clientIp(req({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })
  it("renvoie 'unknown' sans en-tête", () => {
    expect(clientIp(req())).toBe('unknown')
  })
})

describe('checkIpRateLimit', () => {
  it('délègue à checkRateLimitDb avec la clé name:ip et propage le verdict', async () => {
    checkRateLimitDb.mockResolvedValue(false)
    const allowed = await checkIpRateLimit(req({ 'x-forwarded-for': '1.2.3.4' }), 'report', 5, 60_000)
    expect(allowed).toBe(false)
    expect(checkRateLimitDb).toHaveBeenCalledWith('report:1.2.3.4', 5, 60_000)
  })
})
