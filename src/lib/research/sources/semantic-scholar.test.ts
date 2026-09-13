// src/lib/research/sources/semantic-scholar.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchSemanticScholar } from './semantic-scholar'

const RESPONSE = {
  data: [{
    paperId: 'abc123',
    title: 'Reinforcement learning for portfolio rebalancing',
    abstract: 'We train an RL agent to rebalance a multi-asset portfolio.',
    authors: [{ authorId: '1', name: 'X. Chen' }],
    externalIds: { DOI: '10.3/rl-portfolio' },
    url: 'https://www.semanticscholar.org/paper/abc123',
    publicationDate: '2024-05-10',
  }],
}

afterEach(() => vi.restoreAllMocks())

describe('searchSemanticScholar', () => {
  it('normalizes a search result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(RESPONSE), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const papers = await searchSemanticScholar('reinforcement learning portfolio', 10)
    expect(papers).toEqual([{
      title: 'Reinforcement learning for portfolio rebalancing',
      abstract: 'We train an RL agent to rebalance a multi-asset portfolio.',
      authors: ['X. Chen'],
      doi: '10.3/rl-portfolio',
      url: 'https://www.semanticscholar.org/paper/abc123',
      source: 'semantic_scholar',
      venue: null,
      publishedAt: '2024-05-10',
    }])
  })

  it('sends an x-api-key header when SEMANTIC_SCHOLAR_API_KEY is set', async () => {
    process.env.SEMANTIC_SCHOLAR_API_KEY = 'secret-key'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await searchSemanticScholar('x')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('secret-key')
    delete process.env.SEMANTIC_SCHOLAR_API_KEY
  })
})
