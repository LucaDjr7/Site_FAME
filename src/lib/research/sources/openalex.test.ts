// src/lib/research/sources/openalex.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { searchOpenAlex } from './openalex'

const WORK = {
  id: 'https://openalex.org/W123',
  doi: 'https://doi.org/10.1/abc',
  title: 'Deep learning for factor investing',
  publication_date: '2024-03-01',
  abstract_inverted_index: { Deep: [0], learning: [1], works: [2] },
  authorships: [{ author: { display_name: 'A. Researcher' } }],
  primary_location: { landing_page_url: 'https://journal.example/abc' },
}

beforeEach(() => { process.env.OPENALEX_MAILTO = 'test@example.com' })
afterEach(() => { vi.restoreAllMocks(); delete process.env.OPENALEX_MAILTO })

describe('searchOpenAlex', () => {
  it('reconstructs the abstract from the inverted index and normalizes the work', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [WORK] }), { status: 200 })
    ))
    const papers = await searchOpenAlex('factor investing', 10)
    expect(papers).toHaveLength(1)
    expect(papers[0]).toMatchObject({
      title: 'Deep learning for factor investing',
      abstract: 'Deep learning works',
      authors: ['A. Researcher'],
      doi: '10.1/abc',
      url: 'https://journal.example/abc',
      source: 'openalex',
      publishedAt: '2024-03-01',
    })
  })

  it('throws if OPENALEX_MAILTO is not set', async () => {
    delete process.env.OPENALEX_MAILTO
    await expect(searchOpenAlex('x')).rejects.toThrow('OPENALEX_MAILTO')
  })
})
