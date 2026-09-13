// src/lib/research/fetch-pipeline.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runResearchFetch, type FetchPipelineResult } from './fetch-pipeline'

vi.mock('./sources/arxiv', () => ({
  searchArxiv: vi.fn(async () => [
    { title: 'LLM sentiment for equity returns', abstract: 'We use a transformer to score financial news for alpha.', authors: ['A'], doi: null, url: 'http://arxiv.org/abs/2401.00001', source: 'arxiv', venue: null, publishedAt: '2024-01-01' },
    { title: 'A history of medieval trade routes', abstract: 'No AI or finance content here at all.', authors: ['B'], doi: null, url: 'http://arxiv.org/abs/2401.00002', source: 'arxiv', venue: null, publishedAt: '2024-01-01' },
  ]),
}))
vi.mock('./sources/openalex', () => ({ searchOpenAlex: vi.fn(async () => []) }))
vi.mock('./sources/repec', () => ({ searchRepec: vi.fn(async () => []) }))
vi.mock('./sources/semantic-scholar', () => ({ searchSemanticScholar: vi.fn(async () => []) }))
vi.mock('./score', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./score')>()
  return {
    ...actual,
    scoreAndEmbedBatch: vi.fn(async (papers: unknown[]) =>
      papers.map(() => ({ score: 80, embedding: [0.1, 0.2] }))
    ),
  }
})

import { searchArxiv } from './sources/arxiv'
import { searchOpenAlex } from './sources/openalex'
import { searchSemanticScholar } from './sources/semantic-scholar'
import { scoreAndEmbedBatch } from './score'

// The mocked `searchArxiv` ignores its query argument and returns the same two
// papers for every fanned-out query, so the in-memory dedup corpus is what has
// to catch the repeats — exactly as it does in production for a paper matched
// by several keywords or several sources.
//
// The fake client mirrors the pipeline's real call sequence:
//   research_papers   → `select(...).range(...)` once per run, possibly more
//                       than once (the paginated dedup corpus read), then
//                       `insert(rows[]).select()` once per source;
//   research_fetch_log → `insert(...).select('id').single()` BEFORE the source's
//                       work, then `update(...).eq('id', …)` after it.
//
// `existingRows` seeds rows the dedup corpus should see as already in the
// table (distinct from `inserted`, which tracks rows this run adds), so a
// test can plant a duplicate past the first `.range()` page.
function fakeService(existingRows: Record<string, unknown>[] = []) {
  const inserted: Record<string, unknown>[] = []
  const logRows: Record<string, unknown>[] = []
  const logUpdates: { id: unknown; patch: Record<string, unknown> }[] = []
  const orderCalls: unknown[][] = []

  function papersTable() {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: (...args: unknown[]) => {
        orderCalls.push(args)
        return chain
      },
      single: async () => ({ data: null, error: null }),
      // Paginated dedup-corpus read: slice `existingRows` the same way a real
      // table would page through them with `.range(from, to)`.
      range: (from: number, to: number) => {
        const page = existingRows.slice(from, to + 1)
        return { then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: page, error: null }) }
      },
      insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(rows) ? rows : [rows]
        inserted.push(...list)
        const result = { data: list, error: null }
        return {
          select: () => ({
            single: async () => ({ data: list[0], error: null }),
            then: (resolve: (v: typeof result) => void) => resolve(result),
          }),
        }
      },
    }
    return chain
  }

  function logTable() {
    return {
      insert: (row: Record<string, unknown>) => {
        logRows.push(row)
        return {
          select: () => ({ single: async () => ({ data: { id: `log-${logRows.length}` }, error: null }) }),
          then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
        }
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: unknown) => { logUpdates.push({ id, patch }); return { error: null } },
      }),
    }
  }

  return {
    inserted,
    logRows,
    logUpdates,
    orderCalls,
    from: (table: string) => (table === 'research_fetch_log' ? logTable() : papersTable()),
  }
}

// arXiv and Semantic Scholar are now paced with real `setTimeout` gaps (3.1s
// / 1.1s — see fetch-pipeline.ts) to respect their documented rate limits, so
// every call to `runResearchFetch` needs fake timers fast-forwarded past
// those waits — otherwise each test would really take ~46s wall-clock.
function run(service: ReturnType<typeof fakeService>): Promise<FetchPipelineResult[]> {
  const promise = runResearchFetch({ service: service as never })
  return vi.runAllTimersAsync().then(() => promise)
}

describe('runResearchFetch', () => {
  // Call counts are asserted per test; implementations set by the vi.mock
  // factories survive clearAllMocks (it clears calls, not implementations).
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('gates out irrelevant papers before spending an embedding call, and inserts the rest as published', async () => {
    const service = fakeService()
    const results = await run(service)
    expect(results.find((r) => r.source === 'arxiv')?.added).toBe(1)
    expect(service.inserted).toHaveLength(1)
    expect(service.inserted[0]).toMatchObject({ status: 'published', fame_score: 80 })
  })

  it('stores the embedding that produced the score instead of discarding it', async () => {
    const service = fakeService()
    await run(service)
    expect(service.inserted[0]).toMatchObject({ embedding: [0.1, 0.2] })
  })

  it('scores the whole surviving batch in a single call per source', async () => {
    const service = fakeService()
    await run(service)
    // Only arxiv yields survivors; the other three sources return no papers and
    // must not spend an embedding call at all.
    expect(scoreAndEmbedBatch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(scoreAndEmbedBatch).mock.calls[0]?.[0]).toHaveLength(1)
  })

  // arXiv's terms of use ("no more than one request every three seconds,
  // single connection at a time" — https://info.arxiv.org/help/api/tou.html)
  // is what a shared concurrency=3 fan-out violated in prod and drew 429s.
  // Fake timers let this assert the real ~3.1s spacing without the test
  // actually taking 34 seconds.
  it('paces arXiv to a single connection at least 3.1s apart, per its terms of use', async () => {
    const service = fakeService()
    const original = vi.mocked(searchArxiv).getMockImplementation()
    let inFlight = 0
    let peak = 0
    const callTimes: number[] = []
    vi.mocked(searchArxiv).mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      callTimes.push(Date.now())
      inFlight--
      return []
    })
    try {
      await run(service)
    } finally {
      if (original) vi.mocked(searchArxiv).mockImplementation(original)
    }
    expect(callTimes.length).toBeGreaterThan(3)
    expect(peak).toBe(1)
    for (let i = 1; i < callTimes.length; i++) {
      expect(callTimes[i]! - callTimes[i - 1]!).toBeGreaterThanOrEqual(3100)
    }
    // Every adapter gets an explicit, conservative page size from the pipeline
    // rather than falling back to its own `limit = 50` default.
    expect(vi.mocked(searchArxiv).mock.calls[0]?.[1]).toBe(25)
  })

  // Semantic Scholar's documented limit with an API key is 1 request/sec on
  // every endpoint (https://www.semanticscholar.org/product/api) — same fix,
  // same failure mode as arXiv above.
  it('paces Semantic Scholar to a single connection at least 1.1s apart', async () => {
    const service = fakeService()
    const original = vi.mocked(searchSemanticScholar).getMockImplementation()
    let inFlight = 0
    let peak = 0
    const callTimes: number[] = []
    vi.mocked(searchSemanticScholar).mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      callTimes.push(Date.now())
      inFlight--
      return []
    })
    try {
      await run(service)
    } finally {
      if (original) vi.mocked(searchSemanticScholar).mockImplementation(original)
    }
    expect(callTimes.length).toBeGreaterThan(3)
    expect(peak).toBe(1)
    for (let i = 1; i < callTimes.length; i++) {
      expect(callTimes[i]! - callTimes[i - 1]!).toBeGreaterThanOrEqual(1100)
    }
  })

  it('still bounds OpenAlex to concurrency 3 — its polite pool tolerates it, no prod 429s seen', async () => {
    const service = fakeService()
    const original = vi.mocked(searchOpenAlex).getMockImplementation()
    let inFlight = 0
    let peak = 0
    vi.mocked(searchOpenAlex).mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight--
      return []
    })
    try {
      await run(service)
    } finally {
      if (original) vi.mocked(searchOpenAlex).mockImplementation(original)
    }
    expect(vi.mocked(searchOpenAlex).mock.calls.length).toBeGreaterThan(3)
    expect(peak).toBe(3)
  })

  // Regression test for the silent-truncation bug: a plain `.select()` caps at
  // 1000 rows (Supabase's default `db-max-rows`), so a duplicate sitting past
  // row 1000 would never be seen and would get re-inserted every week.
  it('paginates the dedup corpus past a 1000-row page so an older duplicate is still caught', async () => {
    const padding = Array.from({ length: 1000 }, (_, i) => ({
      id: `pad-${i}`,
      fingerprint: `title:pad-${i}`,
      title: `padding paper ${i}`,
    }))
    // The mocked arxiv paper's URL is http://arxiv.org/abs/2401.00001, so its
    // fingerprint is `arxiv:2401.00001` — plant the "existing" duplicate past
    // the first .range() page (index 1000) with that exact fingerprint.
    const existingRows = [...padding, { id: 'existing-1000', fingerprint: 'arxiv:2401.00001', title: 'old copy' }]
    const service = fakeService(existingRows)
    const results = await run(service)
    // The mocked arxiv adapter is fanned out across all 12 queries and returns
    // the same two papers every time: 12 relevance-gated out, and now 12 more
    // caught as duplicates of the pre-seeded row — none added.
    expect(results.find((r) => r.source === 'arxiv')).toMatchObject({ added: 0, skipped: 24 })
    expect(service.inserted).toHaveLength(0)
  })

  // Regression test for a subtler version of the same bug: `.range()` is
  // LIMIT/OFFSET under the hood, and Postgres/PostgREST give no ordering
  // guarantee across separate page queries without an explicit ORDER BY — a
  // concurrent write between pages could otherwise shift the offset window
  // and silently skip or repeat a row.
  it('orders the dedup corpus read deterministically before paginating it', async () => {
    const service = fakeService()
    await run(service)
    expect(service.orderCalls.length).toBeGreaterThan(0)
    expect(service.orderCalls[0]).toEqual(['id', { ascending: true }])
  })

  // mapWithPacing must not add a fixed delay on top of a request that already
  // took longer than the minimum interval — only pace requests that finish
  // faster than the floor.
  it('does not double up the wait when a paced request itself takes longer than the interval', async () => {
    const service = fakeService()
    const original = vi.mocked(searchArxiv).getMockImplementation()
    const callTimes: number[] = []
    vi.mocked(searchArxiv).mockImplementation(async () => {
      callTimes.push(Date.now())
      await new Promise((r) => setTimeout(r, 5000)) // slower than the 3.1s arXiv floor
      return []
    })
    try {
      await run(service)
    } finally {
      if (original) vi.mocked(searchArxiv).mockImplementation(original)
    }
    for (let i = 1; i < callTimes.length; i++) {
      const gap = callTimes[i]! - callTimes[i - 1]!
      // Spaced by ~the request's own 5s duration, not 5s + another 3.1s wait.
      expect(gap).toBeGreaterThanOrEqual(5000)
      expect(gap).toBeLessThan(5100)
    }
  })

  it('opens a fetch-log row before a source runs and updates it afterwards, so a timeout still leaves evidence', async () => {
    const service = fakeService()
    await run(service)
    // One opened row per source, all with zeroed counters at open time.
    expect(service.logRows).toHaveLength(4)
    expect(service.logRows[0]).toMatchObject({ source: 'arxiv', added: 0, skipped: 0, errors: 0 })
    // …then one update per source carrying the real counters.
    expect(service.logUpdates).toHaveLength(4)
    expect(service.logUpdates[0]).toMatchObject({ id: 'log-1', patch: { added: 1 } })
  })
})
