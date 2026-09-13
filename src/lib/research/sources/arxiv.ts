// src/lib/research/sources/arxiv.ts
// ArXiv API client — all ArXiv calls must go through this module.
// ArXiv serves Atom XML (not JSON) and limits clients to ~3 req/sec.
import { XMLParser } from 'fast-xml-parser'
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const BASE = 'http://export.arxiv.org/api/query'

interface ArxivAuthor { name: string }
interface ArxivEntry {
  title: string
  summary: string
  published: string
  id: string
  author: ArxivAuthor | ArxivAuthor[]
}
interface ArxivFeed { feed: { entry?: ArxivEntry | ArxivEntry[] } }

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true })

function toArray(entry: ArxivEntry | ArxivEntry[] | undefined): ArxivEntry[] {
  if (!entry) return []
  return Array.isArray(entry) ? entry : [entry]
}

function authorNames(author: ArxivAuthor | ArxivAuthor[]): string[] {
  const list = Array.isArray(author) ? author : [author]
  return list.map((a) => a.name).filter((n): n is string => Boolean(n))
}

export async function searchArxiv(query: string, limit = 50): Promise<NormalizedPaper[]> {
  const maxResults = Math.min(limit, 200)
  const url = `${BASE}?search_query=${encodeURIComponent(`all:${query}`)}&start=0&max_results=${maxResults}`

  let res: Response
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/atom+xml' } }, 'arxiv')
  } catch (err) {
    console.error('[arxiv] fetch error:', err)
    return []
  }
  if (!res.ok) {
    console.error(`[arxiv] HTTP ${res.status}`)
    return []
  }

  const xml = await res.text()
  const parsed = parser.parse(xml) as ArxivFeed

  return toArray(parsed.feed?.entry)
    .map((e): NormalizedPaper | null => {
      const title = typeof e.title === 'string' ? e.title.trim() : ''
      const abstract = typeof e.summary === 'string' ? e.summary.trim() : ''
      if (!title || !abstract) return null
      return {
        title,
        abstract,
        authors: authorNames(e.author),
        doi: null,
        url: e.id,
        source: 'arxiv',
        venue: null,
        publishedAt: e.published ? new Date(e.published).toISOString() : null,
      }
    })
    .filter((p): p is NormalizedPaper => p !== null)
}
