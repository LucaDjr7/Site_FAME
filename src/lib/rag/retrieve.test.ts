import { describe, it, expect, vi } from 'vitest'
import { retrieve } from './retrieve'
import type { EmbeddingProvider } from '@/lib/llm'

const provider: EmbeddingProvider = { embed: async (t) => t.map(() => [0.1, 0.2]) }

function serviceReturning(rows: unknown[]) {
  return { rpc: vi.fn(async () => ({ data: rows, error: null })) }
}

describe('retrieve', () => {
  it('membre → include_member=true', async () => {
    const service = serviceReturning([])
    await retrieve('q', 'member', { service: service as never, provider, threshold: 0 })
    expect(service.rpc).toHaveBeenCalledWith('match_rag_chunks', expect.objectContaining({ include_member: true }))
  })
  it('visiteur → include_member=false', async () => {
    const service = serviceReturning([])
    await retrieve('q', 'visitor', { service: service as never, provider, threshold: 0 })
    expect(service.rpc).toHaveBeenCalledWith('match_rag_chunks', expect.objectContaining({ include_member: false }))
  })
  it('filtre par seuil d’ancrage', async () => {
    const service = serviceReturning([
      { id: 'a', source_type: 'subject', source_id: 's', content: 'x', labo: 'paris', lang: 'en', similarity: 0.9 },
      { id: 'b', source_type: 'kb', source_id: 'kb:x', content: 'y', labo: null, lang: 'en', similarity: 0.2 },
    ])
    const out = await retrieve('q', 'visitor', { service: service as never, provider, threshold: 0.5 })
    expect(out.map(c => c.id)).toEqual(['a'])
  })
})
