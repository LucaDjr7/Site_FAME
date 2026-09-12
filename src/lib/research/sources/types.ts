// src/lib/research/sources/types.ts
// Shape every source adapter normalizes into — mirrors research_papers columns
// that come straight from the fetch (fingerprint/status/themes/score are computed later).
export interface NormalizedPaper {
  title: string
  abstract: string
  authors: string[]
  doi: string | null
  url: string
  source: 'arxiv' | 'openalex' | 'repec' | 'semantic_scholar'
  venue: string | null
  publishedAt: string | null // ISO date, or null if unknown
}
