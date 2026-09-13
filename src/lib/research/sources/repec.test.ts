// src/lib/research/sources/repec.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchRepec } from './repec'

// Trimmed fixtures mirroring the real site structure (verified live against
// nep.repec.org — the RSS feeds this used to parse are gone, replaced by
// plain HTML report pages with no machine-readable alternative).
const INDEX_HTML = `<!DOCTYPE html>
<html><body>
<a href="/nep-fmk/2026-08-24">issue</a>
<a href="/nep-fmk/2026-09-07">issue</a>
<a href="/nep-fmk/2026-08-31">issue</a>
</body></html>`

const REPORT_HTML = `<!DOCTYPE html>
<html><body>
<ol class="coblo_ol">
<li class="coblo_li">
<div id="p1">
<a target="_blank" tabindex="-1" class="trout" href="https://econpapers.repec.org/RePEc:arx:papers:2607.29583?ref=nep-fmk">Fund Competition under Conflicting ESG Rating Methodologies</a></div>
<table class="basit">
<tr>
<td style="width: 7em" class="fina">By:</td>
<td class="fiva">
<a target="_blank" class="trout" href="https://econpapers.repec.org/scripts/search.pf?ar=on&amp;nep-fmk&amp;aus=Wanling%20Rudkin">Wanling Rudkin</a>;
<a target="_blank" class="trout" href="https://econpapers.repec.org/scripts/search.pf?ar=on&amp;nep-fmk&amp;aus=J.%20Smith">J. Smith</a></td></tr>
<tr>
<td style="width: 7em" class="fina">Abstract:</td>
<td class="fiva">We study order book dynamics with ML, spanning several
lines of the source markup.</td></tr>
<tr>
<td style="width: 7em" class="fina">Date:</td>
<td class="fiva">2026–07</td></tr>
<tr>
<td style="width: 7em" class="fina">URL:</td>
<td class="fiva"><a target="_blank" class="trout" href="https://d.repec.org/n?u=RePEc:arx:papers:2607.29583&amp;r=fmk">https://d.repec.org/n?u=RePEc:arx:papers:2607.29583</a></td></tr></table></li>
<li class="coblo_li">
<div id="p2">
<a target="_blank" tabindex="-1" class="trout" href="https://doi.org/10.2/xyz">Stablecoin regulation: A comparative glance</a></div>
<table class="basit">
<tr>
<td style="width: 7em" class="fina">By:</td>
<td class="fiva">
<a target="_blank" class="trout" href="https://econpapers.repec.org/scripts/search.pf?ar=on&amp;aus=Langenbucher,%20Katja">Langenbucher, Katja</a></td></tr>
<tr>
<td style="width: 7em" class="fina">Abstract:</td>
<td class="fiva">How should legislators cope with technological innovation&#8212;a &#8220;critical&#8221; question in today&#8217;s policy&#160;debate.</td></tr>
<tr>
<td style="width: 7em" class="fina">Date:</td>
<td class="fiva">2026</td></tr>
<tr>
<td style="width: 7em" class="fina">URL:</td>
<td class="fiva"><a target="_blank" class="trout" href="https://doi.org/10.2/xyz">https://doi.org/10.2/xyz</a></td></tr></table></li>
</ol>
</body></html>`

afterEach(() => vi.restoreAllMocks())

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/nep-fmk/')) return new Response(INDEX_HTML, { status: 200 })
      if (url.includes('/nep-fmk/2026-09-07')) return new Response(REPORT_HTML, { status: 200 })
      // Every other NEP code: no report list in this fixture.
      return new Response('<html></html>', { status: 200 })
    })
  )
}

describe('searchRepec', () => {
  it('finds the most recent report date on the index page, then scrapes its paper list', async () => {
    stubFetch()
    const papers = await searchRepec(50)
    expect(papers).toHaveLength(2)
    expect(papers[0]).toMatchObject({
      title: 'Fund Competition under Conflicting ESG Rating Methodologies',
      abstract: 'We study order book dynamics with ML, spanning several lines of the source markup.',
      authors: ['Wanling Rudkin', 'J. Smith'],
      url: 'https://econpapers.repec.org/RePEc:arx:papers:2607.29583?ref=nep-fmk',
      source: 'repec',
      publishedAt: '2026-07-01T00:00:00.000Z',
    })
  })

  it('extracts a DOI from a doi.org URL', async () => {
    stubFetch()
    const papers = await searchRepec(50)
    expect(papers[1]).toMatchObject({ doi: '10.2/xyz' })
  })

  it('leaves publishedAt null for a year-only date rather than inventing a month', async () => {
    stubFetch()
    const papers = await searchRepec(50)
    expect(papers[1]?.publishedAt).toBeNull()
  })

  // Verified live against other NEP report pages (nep-cmp, nep-big, nep-rmg):
  // real abstracts use numeric character references for curly quotes, an
  // em/en dash and nbsp — a fixed list of 5 named entities left these as
  // corrupted literal "&#8217;"-style text in stored data.
  it('decodes numeric HTML entities (curly quotes, dash, nbsp), not just the 5 named ones', async () => {
    stubFetch()
    const papers = await searchRepec(50)
    expect(papers[1]?.abstract).toBe(
      'How should legislators cope with technological innovation—a “critical” question in today’s policy debate.'
    )
  })

  it('never throws when every feed fails — returns whatever the other codes produced', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const papers = await searchRepec(50)
    expect(papers).toEqual([])
  })

  it('returns nothing for a code whose index page has no report date', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>no reports here</html>', { status: 200 })))
    const papers = await searchRepec(50)
    expect(papers).toEqual([])
  })
})
