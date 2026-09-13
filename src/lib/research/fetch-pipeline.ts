// src/lib/research/fetch-pipeline.ts
// Weekly ingestion: fetch every source, gate → dedup → score → insert.
// Each source is isolated in its own try/catch — one failing source never
// aborts the others (same principle as ArdiaD/fame).
//
// Wall-clock budget. This runs behind a Vercel cron with a hard function
// timeout (see src/app/api/research/fetch/route.ts). Four rules keep the run
// inside it — the original one-paper-at-a-time shape could not finish:
//   1. ONE batched embedding call per source instead of one per paper;
//   2. the dedup corpus is read ONCE per run (paginated past Supabase's
//      1000-row default cap — see DEDUP_PAGE_SIZE) and kept in memory (rows
//      accepted during the run are appended to it, so within-run duplicates
//      are still caught) instead of two `research_papers` queries per
//      candidate;
//   3. the source fan-out is narrowed (QUERIES, SOURCE_LIMIT) and paced
//      per source's *actual* documented rate limit — see ARXIV_MIN_INTERVAL_MS
//      and SEMANTIC_SCHOLAR_MIN_INTERVAL_MS below — instead of a shared
//      concurrency guess, so the budget is not burnt on retry backoff against
//      rate limits the pipeline itself triggered;
//   4. the `research_fetch_log` row is written BEFORE a source's work starts and
//      updated afterwards, so a run killed mid-flight still leaves evidence.
import { createServiceClient } from '@/lib/supabase/server'
import { searchArxiv, ARXIV_MIN_INTERVAL_MS } from './sources/arxiv'
import { searchOpenAlex } from './sources/openalex'
import { searchRepec } from './sources/repec'
import { searchSemanticScholar, SEMANTIC_SCHOLAR_MIN_INTERVAL_MS } from './sources/semantic-scholar'
import { tagThemes, THEMES } from './themes'
import { passesRelevanceGate } from './relevance'
import { computeFingerprint, findDuplicate, type DedupCandidate } from './dedup'
import { scoreAndEmbedBatch, FAME_THRESHOLD, type ScoredPaper } from './score'
import type { NormalizedPaper } from './sources/types'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

export interface FetchPipelineResult {
  source: string
  added: number
  skipped: number
  errors: number
  message?: string
}

// One representative keyword per theme — 12 queries per query-source. Two per
// theme doubled the candidate volume for a marginal recall gain and pushed the
// run past its wall-clock budget.
const QUERIES: string[] = THEMES.map((t) => t.keywords[0]).filter((k): k is string => Boolean(k))

// Explicit page size passed to every adapter rather than relying on their own
// `limit = 50` default: 12 × 25 × 3 query-sources ≈ 900 candidates upper bound
// per run, down from ~3650.
const SOURCE_LIMIT = 25

// OpenAlex's polite pool (used with OPENALEX_MAILTO) allows ~10 req/sec, so
// bounded concurrency is enough — it is the one query-source that was never
// seen 429ing in prod.
const SOURCE_CONCURRENCY = 3

// ARXIV_MIN_INTERVAL_MS / SEMANTIC_SCHOLAR_MIN_INTERVAL_MS (imported above)
// are each documented next to the adapter that owns the underlying API
// contract — the previous shared SOURCE_CONCURRENCY=3 fan-out violated both
// at once, which is the actual, confirmed cause of the 429s seen in prod.
// Their own fetchWithRetry calls use the same constants, so a retry can't
// re-violate the floor its own pacing just enforced (confirmed live,
// 2026-09-13: without that, the default 2s/4s backoff retried arXiv faster
// than its 3.1s floor and a tripped 429 nearly always exhausted all 3
// attempts).

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))))
  }
  return out
}

// Single connection, spaced at least `minIntervalMs` apart between request
// *starts* — waiting out the remainder of the interval after each request
// completes (skipped after the last one, which has nothing left to pace
// against) guarantees both properties at once: a request can only start once
// the previous one has finished, and never sooner than the interval allows.
async function mapWithPacing<T, R>(
  items: readonly T[],
  minIntervalMs: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i++) {
    const start = Date.now()
    out.push(await fn(items[i]!))
    if (i === items.length - 1) break // no next request to pace against
    const wait = minIntervalMs - (Date.now() - start)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }
  return out
}

function fanOutConcurrent(fetchOne: (query: string) => Promise<NormalizedPaper[]>): Promise<NormalizedPaper[]> {
  return mapWithConcurrency(QUERIES, SOURCE_CONCURRENCY, fetchOne).then((r) => r.flat())
}

function fanOutPaced(
  fetchOne: (query: string) => Promise<NormalizedPaper[]>,
  minIntervalMs: number
): Promise<NormalizedPaper[]> {
  return mapWithPacing(QUERIES, minIntervalMs, fetchOne).then((r) => r.flat())
}

// ─── Dedup corpus ───────────────────────────────────────────────────────────
// The whole table, read once per run. `research_papers` starts empty and grows
// by a few hundred rows a year, so one full read is far cheaper (and strictly
// more correct, since it is not windowed on a possibly-NULL `published_at`)
// than the two per-candidate queries it replaces.
//
// Paginated with `.range()`: a plain `.select()` is silently capped at 1000
// rows by Supabase's default `db-max-rows` — past that size (~1 year at the
// estimated pace) this would quietly stop seeing older papers and resurrect
// the exact duplicate-insert bug this in-memory corpus was built to fix.
//
// `.order('id')` is required, not cosmetic: `.range()` is LIMIT/OFFSET under
// the hood, and Postgres/PostgREST give no ordering guarantee across separate
// queries without an explicit ORDER BY. Without it, a row inserted or updated
// between two page reads (the admin add/hide/publish routes all write to this
// same table, concurrently with the weekly cron) could shift the offset
// window and make a page silently skip or repeat a row.
const DEDUP_PAGE_SIZE = 1000

async function loadDedupCorpus(service: ServiceClient): Promise<DedupCandidate[]> {
  const rows: DedupCandidate[] = []
  for (let from = 0; ; from += DEDUP_PAGE_SIZE) {
    const { data, error } = await service
      .from('research_papers')
      .select('id, fingerprint, title')
      .order('id', { ascending: true })
      .range(from, from + DEDUP_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as DedupCandidate[]
    rows.push(...page)
    if (page.length < DEDUP_PAGE_SIZE) break
  }
  return rows
}

function makeCorpus(rows: DedupCandidate[]) {
  const candidates = [...rows]
  const fingerprints = new Set(candidates.map((c) => c.fingerprint))
  return {
    isDuplicate(fingerprint: string, title: string): boolean {
      // Exact-fingerprint hits are the common case (the same paper comes back
      // from several of the fanned-out queries, and from several sources) — a
      // Set lookup keeps them off the O(n) Fuse path.
      if (fingerprints.has(fingerprint)) return true
      return findDuplicate({ fingerprint, title }, candidates) !== null
    },
    // Reserve a fingerprint as soon as a paper is accepted into the batch, so
    // the rest of the batch — and every later source — dedups against it,
    // exactly as the old per-paper DB round trip did.
    reserve(fingerprint: string, title: string): void {
      fingerprints.add(fingerprint)
      candidates.push({ id: `pending:${fingerprint}`, fingerprint, title })
    },
  }
}
type DedupCorpus = ReturnType<typeof makeCorpus>

// ─── Fetch log ──────────────────────────────────────────────────────────────
// Split into open/close on purpose: the admin fetch-log panel is the only
// instrument for "the cron started but was killed by the function timeout", and
// a single post-hoc insert left it blank in exactly that case — indistinguishable
// from "the cron never ran".
async function openLog(service: ServiceClient, source: string): Promise<string | null> {
  try {
    const { data, error } = await service
      .from('research_fetch_log')
      .insert({ source, added: 0, skipped: 0, errors: 0, message: null })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return (data as { id?: string } | null)?.id ?? null
  } catch (err) {
    console.error(`[research-fetch:${source}] log insert error:`, err)
    return null
  }
}

async function closeLog(
  service: ServiceClient,
  logId: string | null,
  result: FetchPipelineResult
): Promise<void> {
  const counters = {
    added: result.added,
    skipped: result.skipped,
    errors: result.errors,
    message: result.message ?? null,
  }
  try {
    if (logId) {
      const { error } = await service.from('research_fetch_log').update(counters).eq('id', logId)
      if (error) throw new Error(error.message)
    } else {
      // openLog failed — still record the run rather than losing it entirely.
      const { error } = await service.from('research_fetch_log').insert({ source: result.source, ...counters })
      if (error) throw new Error(error.message)
    }
  } catch (err) {
    console.error(`[research-fetch:${result.source}] log update error:`, err)
  }
}

// ─── Insert ─────────────────────────────────────────────────────────────────
function buildRow(paper: NormalizedPaper, fingerprint: string, scored: ScoredPaper | undefined) {
  const score = scored?.score ?? 0
  return {
    fingerprint,
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    url: paper.url,
    source: paper.source,
    venue: paper.venue,
    themes: tagThemes(paper.title, paper.abstract),
    fame_score: score,
    // pgvector column: store the vector that produced `fame_score` instead of
    // discarding it (retention.ts nulls it out after 90 days for hidden rows).
    embedding: scored?.embedding ?? null,
    published_at: paper.publishedAt ? paper.publishedAt.slice(0, 10) : null,
    status: score >= FAME_THRESHOLD ? 'published' : 'rejected',
    manual_override: false,
  }
}

// One round trip for the whole batch; if it fails, retry row by row so a single
// bad row (e.g. a fingerprint that raced in) doesn't cost the other N-1.
async function insertRows(
  service: ServiceClient,
  source: string,
  rows: ReturnType<typeof buildRow>[]
): Promise<{ added: number; errors: number }> {
  // `.select('id')`, not `.select()`: the returned representation would
  // otherwise echo every embedding back over the wire (~1536 floats × N rows).
  const { error } = await service.from('research_papers').insert(rows).select('id')
  if (!error) return { added: rows.length, errors: 0 }

  console.error(`[research-fetch:${source}] batch insert failed, retrying row by row:`, error.message)
  let added = 0
  let errors = 0
  for (const row of rows) {
    const { error: rowError } = await service.from('research_papers').insert(row).select('id').single()
    if (rowError) {
      errors++
      console.error(`[research-fetch:${source}] row insert error:`, rowError.message)
    } else {
      added++
    }
  }
  return { added, errors }
}

// ─── Per-source run ─────────────────────────────────────────────────────────
async function runSource(
  service: ServiceClient,
  source: string,
  fetchFn: () => Promise<NormalizedPaper[]>,
  corpus: DedupCorpus
): Promise<FetchPipelineResult> {
  const result: FetchPipelineResult = { source, added: 0, skipped: 0, errors: 0 }
  const logId = await openLog(service, source)

  try {
    const papers = await fetchFn()

    const pending: { paper: NormalizedPaper; fingerprint: string }[] = []
    for (const paper of papers) {
      // Cheap gate first: never spend an embedding on an obviously off-topic paper.
      if (!passesRelevanceGate(paper.title, paper.abstract)) {
        result.skipped++
        continue
      }
      const fingerprint = computeFingerprint(paper)
      if (corpus.isDuplicate(fingerprint, paper.title)) {
        result.skipped++
        continue
      }
      corpus.reserve(fingerprint, paper.title)
      pending.push({ paper, fingerprint })
    }

    if (pending.length > 0) {
      const scored = await scoreAndEmbedBatch(
        pending.map(({ paper }) => ({ title: paper.title, abstract: paper.abstract }))
      )
      const rows = pending.map(({ paper, fingerprint }, i) => buildRow(paper, fingerprint, scored[i]))
      const outcome = await insertRows(service, source, rows)
      result.added += outcome.added
      result.errors += outcome.errors
    }
  } catch (err) {
    result.errors++
    result.message = err instanceof Error ? err.message : String(err)
    console.error(`[research-fetch:${source}] error:`, err)
  }

  await closeLog(service, logId, result)
  return result
}

export async function runResearchFetch(
  deps: { service?: ServiceClient } = {}
): Promise<FetchPipelineResult[]> {
  const service = deps.service ?? (await createServiceClient())
  const corpus = makeCorpus(await loadDedupCorpus(service))

  const results: FetchPipelineResult[] = []
  results.push(
    await runSource(service, 'arxiv', () => fanOutPaced((q) => searchArxiv(q, SOURCE_LIMIT), ARXIV_MIN_INTERVAL_MS), corpus)
  )
  results.push(await runSource(service, 'openalex', () => fanOutConcurrent((q) => searchOpenAlex(q, SOURCE_LIMIT)), corpus))
  results.push(await runSource(service, 'repec', () => searchRepec(SOURCE_LIMIT), corpus))
  // semantic_scholar last — its own pacing already keeps it from blocking the
  // others; running it last just means a killed-by-timeout run still leaves
  // the other three sources' results intact.
  // (Each runSource call is awaited sequentially, so "last" must mean last in
  // this list, not just wherever the comment sits — moved after repec.)
  results.push(
    await runSource(
      service,
      'semantic_scholar',
      () => fanOutPaced((q) => searchSemanticScholar(q, SOURCE_LIMIT), SEMANTIC_SCHOLAR_MIN_INTERVAL_MS),
      corpus
    )
  )

  return results
}
