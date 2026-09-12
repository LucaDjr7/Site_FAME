// src/lib/research/sources/repec.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchRepec } from './repec'

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Market microstructure and machine learning</title>
    <description>&lt;p&gt;We study order book dynamics with ML.&lt;/p&gt;</description>
    <link>https://doi.org/10.2/xyz</link>
    <dc:creator>J. Smith, K. Lee</dc:creator>
    <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
  </item>
</channel></rss>`

afterEach(() => vi.restoreAllMocks())

describe('searchRepec', () => {
  it('parses an RSS item, strips HTML from the description, splits authors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(RSS, { status: 200 })))
    const papers = await searchRepec(50)
    expect(papers.length).toBeGreaterThan(0)
    expect(papers[0]).toMatchObject({
      title: 'Market microstructure and machine learning',
      abstract: 'We study order book dynamics with ML.',
      authors: ['J. Smith', 'K. Lee'],
      doi: '10.2/xyz',
      source: 'repec',
    })
  })

  it('never throws when one feed fails — returns whatever the other feeds produced', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const papers = await searchRepec(50)
    expect(papers).toEqual([])
  })
})
