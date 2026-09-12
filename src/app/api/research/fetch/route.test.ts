import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/research/fetch-pipeline', () => ({
  runResearchFetch: vi.fn(async () => [{ source: 'arxiv', added: 3, skipped: 1, errors: 0 }]),
}))
vi.mock('@/lib/research/retention', () => ({
  runRetention: vi.fn(async () => ({ deletedRejected: 0, strippedHidden: 0 })),
}))

import { GET } from './route'
import { runResearchFetch } from '@/lib/research/fetch-pipeline'

beforeEach(() => { process.env.CRON_SECRET = 'test-secret'; vi.clearAllMocks() })

function req(auth?: string) {
  const headers = auth ? { Authorization: auth } : undefined
  return new NextRequest('http://localhost/api/research/fetch', { headers })
}

describe('GET /api/research/fetch', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(runResearchFetch).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong secret', async () => {
    const res = await GET(req('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('runs the pipeline + retention and returns a summary for a valid Vercel Cron request', async () => {
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([{ source: 'arxiv', added: 3, skipped: 1, errors: 0 }])
    expect(runResearchFetch).toHaveBeenCalledTimes(1)
  })
})
