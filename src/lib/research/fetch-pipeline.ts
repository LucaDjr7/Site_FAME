// src/lib/research/fetch-pipeline.ts
// Weekly ingestion: fetch every source, gate → dedup → score → insert.
// Each source is isolated in its own try/catch — one failing source never
// aborts the others (same principle as ArdiaD/fame).
import { createServiceClient } from '@/lib/supabase/server'
import { searchArxiv } from './sources/arxiv'
import { searchOpenAlex } from './sources/openalex'
import { searchRepec } from './sources/repec'
import { searchSemanticScholar } from './sources/semantic-scholar'
import { tagThemes, THEMES } from './themes'
import { passesRelevanceGate } from './relevance'
import { computeFingerprint, findDuplicate, type DedupCandidate } from './dedup'
import { scoreBatch, FAME_THRESHOLD } from './score'
import type { NormalizedPaper } from './sources/types'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

export interface FetchPipelineResult {
  source: string
  added: number
  skipped: number
  errors: number
  message?: string
}

// Two representative keywords per theme — broad recall without an explosion
// of requests (12 themes × 2 ≈ 24 queries per query-source).
const QUERIES: string[] = THEMES.flatMap((t) => t.keywords.slice(0, 2))

async function fetchDateWindowCandidates(
  service: ServiceClient,
  publishedAt: string | null
): Promise<DedupCandidate[]> {
  let query = service.from('research_papers').select('id, fingerprint, title')
  if (publishedAt) {
    const d = new Date(publishedAt)
    const from = new Date(d); from.setFullYear(from.getFullYear() - 1)
    const to = new Date(d); to.setFullYear(to.getFullYear() + 1)
    query = query.gte('published_at', from.toISOString().slice(0, 10)).lte('published_at', to.toISOString().slice(0, 10))
  }
  const { data } = await query
  return (data ?? []) as DedupCandidate[]
}

async function ingestOne(
  service: ServiceClient,
  paper: NormalizedPaper
): Promise<'added' | 'skipped'> {
  if (!passesRelevanceGate(paper.title, paper.abstract)) return 'skipped'

  const fingerprint = computeFingerprint(paper)
  const { data: exact } = await service.from('research_papers').select('id').eq('fingerprint', fingerprint)
  if (exact && exact.length > 0) return 'skipped'

  const candidates = await fetchDateWindowCandidates(service, paper.publishedAt)
  if (findDuplicate({ fingerprint, title: paper.title }, candidates)) return 'skipped'

  const [score] = await scoreBatch([{ title: paper.title, abstract: paper.abstract }])
  const status = (score ?? 0) >= FAME_THRESHOLD ? 'published' : 'rejected'

  const { error } = await service.from('research_papers').insert({
    fingerprint,
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    url: paper.url,
    source: paper.source,
    venue: paper.venue,
    themes: tagThemes(paper.title, paper.abstract),
    fame_score: score,
    published_at: paper.publishedAt ? paper.publishedAt.slice(0, 10) : null,
    status,
    manual_override: false,
  }).select().single()

  if (error) throw new Error(error.message)
  return 'added'
}

async function runSource(
  service: ServiceClient,
  source: string,
  fetchFn: () => Promise<NormalizedPaper[]>
): Promise<FetchPipelineResult> {
  const result: FetchPipelineResult = { source, added: 0, skipped: 0, errors: 0 }
  try {
    const papers = await fetchFn()
    for (const paper of papers) {
      try {
        const outcome = await ingestOne(service, paper)
        result[outcome]++
      } catch (err) {
        result.errors++
        console.error(`[research-fetch:${source}] paper error:`, err)
      }
    }
  } catch (err) {
    result.errors++
    result.message = err instanceof Error ? err.message : String(err)
    console.error(`[research-fetch:${source}] fetch error:`, err)
  }
  await service.from('research_fetch_log').insert({ ...result })
  return result
}

export async function runResearchFetch(
  deps: { service?: ServiceClient } = {}
): Promise<FetchPipelineResult[]> {
  const service = deps.service ?? (await createServiceClient())

  const results: FetchPipelineResult[] = []
  results.push(await runSource(service, 'arxiv', async () => (await Promise.all(QUERIES.map((q) => searchArxiv(q)))).flat()))
  results.push(await runSource(service, 'openalex', async () => (await Promise.all(QUERIES.map((q) => searchOpenAlex(q)))).flat()))
  results.push(await runSource(service, 'repec', () => searchRepec()))
  // semantic_scholar last — it rate-limits aggressively and would otherwise block the others.
  // (Each runSource call is awaited sequentially, so "last" must mean last in
  // this list, not just wherever the comment sits — moved after repec.)
  results.push(await runSource(service, 'semantic_scholar', async () => (await Promise.all(QUERIES.map((q) => searchSemanticScholar(q)))).flat()))

  return results
}
