// src/lib/research/sources/openalex.ts
// OpenAlex API client — all OpenAlex calls must go through this module.
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const BASE = 'https://api.openalex.org/works'

interface OAAuthorship { author: { display_name: string | null } | null }
interface OAWork {
  id: string
  doi: string | null
  title: string | null
  publication_date: string | null
  abstract_inverted_index: Record<string, number[]> | null
  authorships: OAAuthorship[]
  primary_location: { landing_page_url: string | null } | null
}
interface OASearchResponse { results: OAWork[] }

// OpenAlex stores abstracts as an inverted index { word: [positions] } — rebuild
// the original text by placing each word at its position.
function reconstructAbstract(index: Record<string, number[]> | null): string {
  if (!index) return ''
  const slots: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) slots[pos] = word
  }
  return slots.filter((w) => w !== undefined).join(' ').trim()
}

function normalizeWork(w: OAWork): NormalizedPaper | null {
  const abstract = reconstructAbstract(w.abstract_inverted_index)
  if (!w.title || !abstract) return null
  const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, '') : null
  return {
    title: w.title,
    abstract,
    authors: w.authorships.map((a) => a.author?.display_name).filter((n): n is string => Boolean(n)),
    doi,
    url: w.primary_location?.landing_page_url ?? w.id,
    source: 'openalex',
    venue: null,
    publishedAt: w.publication_date ?? null,
  }
}

export async function searchOpenAlex(query: string, limit = 50): Promise<NormalizedPaper[]> {
  const mailto = process.env.OPENALEX_MAILTO
  if (!mailto) throw new Error('Missing OPENALEX_MAILTO')

  const perPage = Math.min(limit, 200)
  const url = `${BASE}?search=${encodeURIComponent(query)}&per-page=${perPage}&mailto=${encodeURIComponent(mailto)}`

  let res: Response
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, 'openalex')
  } catch (err) {
    console.error('[openalex] fetch error:', err)
    return []
  }
  if (!res.ok) {
    console.error(`[openalex] HTTP ${res.status}`)
    return []
  }

  try {
    const json = (await res.json()) as OASearchResponse
    return json.results.map(normalizeWork).filter((p): p is NormalizedPaper => p !== null)
  } catch (err) {
    console.error('[openalex] parse error:', err)
    return []
  }
}
