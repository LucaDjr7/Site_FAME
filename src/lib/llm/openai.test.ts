import { describe, it, expect, vi } from 'vitest'
import { createOpenAIEmbeddingProvider } from './openai'

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch
}

describe('createOpenAIEmbeddingProvider', () => {
  it('poste model+input+dimensions et renvoie les vecteurs dans l’ordre', async () => {
    const fetchImpl = fakeFetch({ data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }] })
    const p = createOpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'm', dimensions: 1536, fetchImpl })
    const out = await p.embed(['a', 'b'])
    expect(out).toEqual([[0.1, 0.2], [0.3, 0.4]])
    const call = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!
    expect(call[0]).toBe('https://api.openai.com/v1/embeddings')
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body).toMatchObject({ model: 'm', input: ['a', 'b'], dimensions: 1536 })
    expect((call[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sk-x' })
  })

  it('chaîne vide → renvoie [] sans appel réseau', async () => {
    const fetchImpl = fakeFetch({ data: [] })
    const p = createOpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'm', dimensions: 1536, fetchImpl })
    expect(await p.embed([])).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('statut non-2xx → lève', async () => {
    const p = createOpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'm', dimensions: 1536, fetchImpl: fakeFetch({ error: 'x' }, 500) })
    await expect(p.embed(['a'])).rejects.toThrow(/embeddings/i)
  })
})
