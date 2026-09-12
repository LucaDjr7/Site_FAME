// src/lib/research/sources/arxiv.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchArxiv } from './arxiv'

const FEED_XML = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.01234v1</id>
    <title>LLM sentiment for stock return prediction</title>
    <summary>We study transformer-based sentiment scoring of financial news.</summary>
    <published>2024-01-02T00:00:00Z</published>
    <author><name>Jane Doe</name></author>
  </entry>
</feed>`

afterEach(() => vi.restoreAllMocks())

describe('searchArxiv', () => {
  it('normalizes an arXiv Atom entry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FEED_XML, { status: 200 })))
    const papers = await searchArxiv('llm finance', 10)
    expect(papers).toHaveLength(1)
    expect(papers[0]).toMatchObject({
      title: 'LLM sentiment for stock return prediction',
      abstract: 'We study transformer-based sentiment scoring of financial news.',
      authors: ['Jane Doe'],
      source: 'arxiv',
      url: 'http://arxiv.org/abs/2401.01234v1',
      publishedAt: '2024-01-02T00:00:00.000Z',
    })
  })

  it('returns an empty array on HTTP failure without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    const papers = await searchArxiv('anything')
    expect(papers).toEqual([])
  }, 10_000) // fetchWithRetry backs off 2s+4s on repeated 503s (real timers) — exceeds vitest's 5s default
})
