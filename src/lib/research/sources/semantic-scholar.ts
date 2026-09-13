// src/lib/research/sources/semantic-scholar.ts
// Semantic Scholar API client — all calls must go through this module.
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const BASE = 'https://api.semanticscholar.org/graph/v1'
const FIELDS = 'paperId,title,abstract,authors,externalIds,url,publicationDate'

// With an API key, Semantic Scholar documents a 1 request/sec limit on every
// endpoint (https://www.semanticscholar.org/product/api — verified live).
// Exported so the pipeline's inter-query pacing (fetch-pipeline.ts) and this
// module's own retry backoff (below) share one source of truth.
export const SEMANTIC_SCHOLAR_MIN_INTERVAL_MS = 1100

interface SSAuthor { authorId: string; name: string }
interface SSPaper {
  paperId: string
  title: string
  abstract: string | null
  authors: SSAuthor[]
  externalIds: Record<string, string> | null
  url: string
  publicationDate: string | null
}
interface SSSearchResponse { data: SSPaper[] }

function ssHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY
  if (key) headers['x-api-key'] = key
  return headers
}

export async function searchSemanticScholar(query: string, limit = 50): Promise<NormalizedPaper[]> {
  const url = `${BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${FIELDS}`

  let res: Response
  try {
    res = await fetchWithRetry(url, { headers: ssHeaders() }, 'semantic-scholar', 1, SEMANTIC_SCHOLAR_MIN_INTERVAL_MS)
  } catch (err) {
    console.error('[semantic-scholar] fetch error:', err)
    return []
  }
  if (!res.ok) {
    console.error(`[semantic-scholar] HTTP ${res.status}`)
    return []
  }

  const json = (await res.json()) as SSSearchResponse
  return json.data
    .filter((p): p is SSPaper & { title: string; abstract: string } => Boolean(p.title && p.abstract))
    .map((p) => ({
      title: p.title,
      abstract: p.abstract,
      authors: p.authors.map((a) => a.name),
      doi: p.externalIds?.['DOI'] ?? null,
      url: p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
      source: 'semantic_scholar' as const,
      venue: null,
      publishedAt: p.publicationDate ?? null,
    }))
}
