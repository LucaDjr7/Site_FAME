// src/lib/research/sources/repec.ts
// HTML scraper for RePEc/NEP curated economics report pages — no search query,
// fixed feed list.
//
// This used to be an RSS reader against `nep.repec.org/<code>.rss`. That
// endpoint now 404s: RePEc rebuilt the NEP site around plain HTML report
// pages (verified live) with no machine-readable feed anywhere — no
// <link rel="alternate"> on the index page or a report page, and no working
// `/latest` shortcut. So instead this adapter:
//   1. fetches the per-code index page and finds the most recent report date
//      (dates are `YYYY-MM-DD` in the href, so plain string comparison sorts
//      them correctly — the max href is the latest issue);
//   2. fetches that single report page and scrapes its paper list.
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const NEP_CODES = ['nep-fmk', 'nep-cmp', 'nep-big', 'nep-rmg', 'nep-fin'] as const
type NepCode = (typeof NEP_CODES)[number]

const BASE = 'https://nep.repec.org'

// Handles named entities plus generic decimal/hex numeric references — real
// report pages were verified live to use numeric forms (&#8217; &#8220;
// &#8221; &#160;, etc.) for curly quotes, dashes and nbsp in titles/abstracts,
// which a fixed list of 5 named entities would leave corrupted in stored
// data. &amp; is decoded last so an already-escaped "&#39;" in source text
// (literally meaning the four characters &, #, 3, 9) isn't double-unescaped
// into an apostrophe.
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&')
    // Numeric nbsp (&#160;) decodes to U+00A0, not a plain space — normalize
    // it the same way the named &nbsp; case above is, so stored text doesn't
    // carry an invisible non-breaking space depending on which form a given
    // report page happened to use.
    .replace(/\u00A0/g, ' ')
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function extractDoi(url: string): string | null {
  const idx = url.indexOf('doi.org/')
  return idx === -1 ? null : url.slice(idx + 'doi.org/'.length) || null
}

// Report dates are `YYYY-MM-DD` in the href — plain string comparison sorts
// them correctly, so the max href found is the latest issue.
function latestReportDate(indexHtml: string, code: NepCode): string | null {
  const re = new RegExp(`href="/${code}/(\\d{4}-\\d{2}-\\d{2})"`, 'g')
  let latest: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(indexHtml))) {
    const date = m[1]
    if (date && (!latest || date > latest)) latest = date
  }
  return latest
}

// Report dates on the detail page render as "2026–07" (en dash, month
// precision) or, occasionally, just "2026" (year only). Normalize the former
// to an ISO date; leave the latter as null rather than fabricate a month —
// same "null means unknown" contract every other source in this pipeline uses.
function parsePublishedAt(raw: string): string | null {
  const normalized = raw.trim().replace(/[‐-―]/g, '-')
  const match = normalized.match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-01T00:00:00.000Z` : null
}

// One `<li class="coblo_li">…</li>` block per paper: a title link, then a
// `<table class="basit">` with By:/Abstract:/Date:/URL: rows.
function parseReport(html: string): NormalizedPaper[] {
  const blocks = html.split('<li class="coblo_li">').slice(1)
  const papers: NormalizedPaper[] = []

  for (let block of blocks) {
    const end = block.indexOf('</li>')
    if (end !== -1) block = block.slice(0, end)

    const titleMatch = block.match(/<a[^>]*class="trout"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/)
    if (!titleMatch) continue
    const title = decodeEntities(titleMatch[2] ?? '').trim()
    const url = decodeEntities(titleMatch[1] ?? '')

    const authorCell = block.match(/class="fina">By:<\/td>\s*<td[^>]*class="fiva">([\s\S]*?)<\/td>/)
    const authors = authorCell
      ? [...(authorCell[1] ?? '').matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((a) => decodeEntities(a[1] ?? '').trim())
      : []

    const abstractCell = block.match(/class="fina">Abstract:<\/td>\s*<td[^>]*class="fiva">([\s\S]*?)<\/td>/)
    const abstract = abstractCell ? stripHtml(abstractCell[1] ?? '') : ''

    const dateCell = block.match(/class="fina">Date:<\/td>\s*<td[^>]*class="fiva">([^<]+)<\/td>/)
    const publishedAt = dateCell ? parsePublishedAt(dateCell[1] ?? '') : null

    if (!title || !abstract) continue

    papers.push({
      title,
      abstract,
      authors,
      doi: extractDoi(url),
      url,
      source: 'repec',
      venue: null,
      publishedAt,
    })
  }

  return papers
}

async function fetchReport(code: NepCode): Promise<NormalizedPaper[]> {
  let indexRes: Response
  try {
    indexRes = await fetchWithRetry(`${BASE}/${code}/`, {}, 'repec')
  } catch (err) {
    console.error(`[repec:${code}] index fetch error:`, err)
    return []
  }
  if (!indexRes.ok) {
    console.error(`[repec:${code}] index HTTP ${indexRes.status}`)
    return []
  }

  const date = latestReportDate(await indexRes.text(), code)
  if (!date) {
    console.error(`[repec:${code}] no report date found on index page`)
    return []
  }

  let reportRes: Response
  try {
    reportRes = await fetchWithRetry(`${BASE}/${code}/${date}`, {}, 'repec')
  } catch (err) {
    console.error(`[repec:${code}] report fetch error:`, err)
    return []
  }
  if (!reportRes.ok) {
    console.error(`[repec:${code}] report HTTP ${reportRes.status}`)
    return []
  }

  const papers = parseReport(await reportRes.text())
  // A found report page parsing to zero papers almost always means the
  // markup drifted under the regex-based parser above, not that NEP actually
  // published an empty issue — log it so that failure mode isn't silently
  // indistinguishable from "no new papers this week" in the fetch-log panel.
  if (papers.length === 0) console.error(`[repec:${code}] report ${date} parsed 0 papers — markup may have changed`)
  return papers
}

export async function searchRepec(limit = 50): Promise<NormalizedPaper[]> {
  const results = await Promise.all(NEP_CODES.map(fetchReport))
  return results.flat().slice(0, limit)
}
