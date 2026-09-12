// src/lib/research/fetch-pipeline.test.ts
import { describe, it, expect, vi } from 'vitest'
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
  return { ...actual, scoreBatch: vi.fn(async (papers: unknown[]) => papers.map(() => 80)) }
})

// Note: the brief's original fakeService used one shared `chain` object whose
// `.then()` always resolved `{ data: [], error: null }` regardless of which
// filters had been applied — i.e. `research_papers` lookups never reflected
// rows inserted earlier in the same run. That's fine for cross-run dedup
// (nothing pre-exists) but breaks within-run dedup: the mocked `searchArxiv`
// ignores its query argument and returns the same paper for all 24 fanned-out
// queries (12 themes × 2 keywords), so the exact-fingerprint check must see
// each paper as it's inserted, exactly as a real Supabase table would across
// sequential awaits. Rewired the chain to track filters and evaluate them
// against `inserted` lazily (in `.then()`), instead of changing
// `fetch-pipeline.ts`'s dedup logic to match a mock that never persists.
function fakeService() {
  const inserted: Record<string, unknown>[] = []
  type Filter = { field: string; op: 'eq' | 'gte' | 'lte'; value: unknown }

  function makeChain() {
    const filters: Filter[] = []
    const chain = {
      select: () => chain,
      eq: (field: string, value: unknown) => { filters.push({ field, op: 'eq', value }); return chain },
      in: () => chain,
      gte: (field: string, value: unknown) => { filters.push({ field, op: 'gte', value }); return chain },
      lte: (field: string, value: unknown) => { filters.push({ field, op: 'lte', value }); return chain },
      insert: (row: Record<string, unknown>) => {
        inserted.push(row)
        return { select: () => ({ single: async () => ({ data: { id: `id-${inserted.length}`, ...row }, error: null }) }) }
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
        const data = inserted.filter((row) =>
          filters.every((f) => {
            const rowVal = row[f.field] as string | undefined
            if (f.op === 'eq') return rowVal === f.value
            if (f.op === 'gte') return typeof rowVal === 'string' && rowVal >= (f.value as string)
            if (f.op === 'lte') return typeof rowVal === 'string' && rowVal <= (f.value as string)
            return true
          })
        )
        resolve({ data, error: null })
      },
    }
    return chain
  }

  return {
    inserted,
    from: (table: string) => {
      if (table === 'research_fetch_log') return { insert: async () => ({ error: null }) }
      return makeChain()
    },
  }
}

describe('runResearchFetch', () => {
  it('gates out irrelevant papers before spending an embedding call, and inserts the rest as published', async () => {
    const service = fakeService()
    const results = await runResearchFetch({ service: service as never })
    expect(results.find((r) => r.source === 'arxiv')?.added).toBe(1)
    expect(service.inserted).toHaveLength(1)
    expect(service.inserted[0]).toMatchObject({ status: 'published', fame_score: 80 })
  })
})
