// src/lib/research/sources/fetch-utils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry } from './fetch-utils'

describe('fetchWithRetry', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('returns immediately on a 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await fetchWithRetry('http://x', {}, 'test')
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const promise = fetchWithRetry('http://x', {}, 'test')
    await vi.runAllTimersAsync()
    const res = await promise
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after 3 attempts on repeated 500s', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const promise = fetchWithRetry('http://x', {}, 'test')
    const assertion = expect(promise).rejects.toThrow('test] HTTP 500 after 3 attempts')
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  // Regression test: confirmed live in prod (2026-09-13) that arXiv's default
  // exponential backoff (2s, then 4s) retries *faster* than arXiv's own 3.1s
  // floor, so a query that trips one 429 nearly always exhausts all 3
  // attempts — the retry was re-violating the very limit the caller's own
  // pacing was built to respect.
  it('floors the backoff delay to minDelayMs when the exponential schedule would be faster', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 429 }))
    vi.stubGlobal('fetch', fetchMock)
    const callTimes: number[] = []
    fetchMock.mockImplementation(async () => {
      callTimes.push(Date.now())
      return new Response('', { status: 429 })
    })
    const promise = fetchWithRetry('http://x', {}, 'test', 1, 3100)
    const assertion = expect(promise).rejects.toThrow('test] HTTP 429 after 3 attempts')
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
    // Default schedule would gap 2s then 4s; flooring to 3100 forces both
    // gaps to at least that, not just the second one.
    expect(callTimes[1]! - callTimes[0]!).toBeGreaterThanOrEqual(3100)
    expect(callTimes[2]! - callTimes[1]!).toBeGreaterThanOrEqual(3100)
  })
})
