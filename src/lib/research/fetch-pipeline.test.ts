// src/lib/research/fetch-pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runResearchFetch } from './fetch-pipeline'

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
import { scoreAndEmbedBatch } from './score'

// The mocked `searchArxiv` ignores its query argument and returns the same two
// papers for every fanned-out query, so the in-memory dedup corpus is what has
// to catch the repeats — exactly as it does in production for a paper matched
// by several keywords or several sources.
//
// The fake client mirrors the pipeline's real call sequence:
//   research_papers   → `select(...)` once per run (the dedup corpus read),
//                       then `insert(rows[]).select()` once per source;
//   research_fetch_log → `insert(...).select('id').single()` BEFORE the source's
//                       work, then `update(...).eq('id', …)` after it.
function fakeService() {
  const inserted: Record<string, unknown>[] = []
  const logRows: Record<string, unknown>[] = []
  const logUpdates: { id: unknown; patch: Record<string, unknown> }[] = []

  function papersTable() {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      gte: () => chain,
      lte: () => chain,
      single: async () => ({ data: null, error: null }),
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
      // The dedup corpus read resolves against whatever has been inserted so
      // far, exactly as a real table would across sequential awaits.
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [...inserted], error: null }),
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
    from: (table: string) => (table === 'research_fetch_log' ? logTable() : papersTable()),
  }
}

describe('runResearchFetch', () => {
  // Call counts are asserted per test; implementations set by the vi.mock
  // factories survive clearAllMocks (it clears calls, not implementations).
  beforeEach(() => vi.clearAllMocks())

  it('gates out irrelevant papers before spending an embedding call, and inserts the rest as published', async () => {
    const service = fakeService()
    const results = await runResearchFetch({ service: service as never })
    expect(results.find((r) => r.source === 'arxiv')?.added).toBe(1)
    expect(service.inserted).toHaveLength(1)
    expect(service.inserted[0]).toMatchObject({ status: 'published', fame_score: 80 })
  })

  it('stores the embedding that produced the score instead of discarding it', async () => {
    const service = fakeService()
    await runResearchFetch({ service: service as never })
    expect(service.inserted[0]).toMatchObject({ embedding: [0.1, 0.2] })
  })

  it('scores the whole surviving batch in a single call per source', async () => {
    const service = fakeService()
    await runResearchFetch({ service: service as never })
    // Only arxiv yields survivors; the other three sources return no papers and
    // must not spend an embedding call at all.
    expect(scoreAndEmbedBatch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(scoreAndEmbedBatch).mock.calls[0]?.[0]).toHaveLength(1)
  })

  it('throttles the per-source query fan-out instead of firing every query at once', async () => {
    const service = fakeService()
    const original = vi.mocked(searchArxiv).getMockImplementation()
    let inFlight = 0
    let peak = 0
    vi.mocked(searchArxiv).mockImplementation(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight--
      return []
    })
    try {
      await runResearchFetch({ service: service as never })
    } finally {
      if (original) vi.mocked(searchArxiv).mockImplementation(original)
    }
    expect(vi.mocked(searchArxiv).mock.calls.length).toBeGreaterThan(3)
    expect(peak).toBeLessThanOrEqual(3)
    // Every adapter gets an explicit, conservative page size from the pipeline
    // rather than falling back to its own `limit = 50` default.
    expect(vi.mocked(searchArxiv).mock.calls[0]?.[1]).toBe(25)
  })

  it('opens a fetch-log row before a source runs and updates it afterwards, so a timeout still leaves evidence', async () => {
    const service = fakeService()
    await runResearchFetch({ service: service as never })
    // One opened row per source, all with zeroed counters at open time.
    expect(service.logRows).toHaveLength(4)
    expect(service.logRows[0]).toMatchObject({ source: 'arxiv', added: 0, skipped: 0, errors: 0 })
    // …then one update per source carrying the real counters.
    expect(service.logUpdates).toHaveLength(4)
    expect(service.logUpdates[0]).toMatchObject({ id: 'log-1', patch: { added: 1 } })
  })
})
