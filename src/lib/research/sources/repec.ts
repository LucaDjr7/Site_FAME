// src/lib/research/sources/repec.ts
// RSS adapter for RePEc/NEP curated economics feeds — no search query, fixed feed list.
import { XMLParser } from 'fast-xml-parser'
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const NEP_CODES = ['nep-fmk', 'nep-cmp', 'nep-big', 'nep-rmg', 'nep-fin'] as const
type NepCode = (typeof NEP_CODES)[number]

const BASE = 'https://nep.repec.org'

interface RepecItem {
  title?: string
  description?: string
  link?: string
  'dc:creator'?: string
  pubDate?: string
}
interface RepecFeed { rss: { channel: { item?: RepecItem | RepecItem[] } } }

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function extractDoi(link: string | undefined): string | null {
  if (!link) return null
  const idx = link.indexOf('doi.org/')
  return idx === -1 ? null : link.slice(idx + 'doi.org/'.length) || null
}

function toItemArray(raw: RepecItem | RepecItem[] | undefined): RepecItem[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

async function fetchFeed(code: NepCode): Promise<NormalizedPaper[]> {
  let res: Response
  try {
    res = await fetchWithRetry(`${BASE}/${code}.rss`, {}, 'repec')
  } catch (err) {
    console.error(`[repec:${code}] error:`, err)
    return []
  }
  if (!res.ok) {
    console.error(`[repec:${code}] HTTP ${res.status}`)
    return []
  }

  let parsed: RepecFeed
  try {
    parsed = parser.parse(await res.text()) as RepecFeed
  } catch (err) {
    console.error(`[repec:${code}] XML parse failed:`, err)
    return []
  }

  return toItemArray(parsed.rss?.channel?.item)
    .map((item): NormalizedPaper | null => {
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const abstract = stripHtml(typeof item.description === 'string' ? item.description : '').trim()
      if (!title || !abstract) return null

      const authors = (item['dc:creator'] ?? '')
        .split(/[,;]/)
        .map((a) => a.trim())
        .filter((a) => a.length > 0)
      const link = typeof item.link === 'string' ? item.link.trim() : ''
      const d = item.pubDate ? new Date(item.pubDate) : null

      return {
        title,
        abstract,
        authors,
        doi: extractDoi(link),
        url: link,
        source: 'repec',
        venue: null,
        publishedAt: d && !isNaN(d.getTime()) ? d.toISOString() : null,
      }
    })
    .filter((p): p is NormalizedPaper => p !== null)
}

export async function searchRepec(limit = 50): Promise<NormalizedPaper[]> {
  const results = await Promise.all(NEP_CODES.map(fetchFeed))
  return results.flat().slice(0, limit)
}
