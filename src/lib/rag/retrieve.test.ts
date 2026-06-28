import { describe, it, expect, vi } from 'vitest'
import { retrieve, retrieveSubjectFiles } from './retrieve'
import type { EmbeddingProvider } from '@/lib/llm'

const provider: EmbeddingProvider = { embed: async (t) => t.map(() => [0.1, 0.2]) }

function serviceReturning(rows: unknown[]) {
  return { rpc: vi.fn(async () => ({ data: rows, error: null })) }
}

describe('retrieve', () => {
  it('membre => include_member=true', async () => {
    const service = serviceReturning([])
    await retrieve('q', 'member', { service: service as never, provider, threshold: 0 })
    expect(service.rpc).toHaveBeenCalledWith('match_rag_chunks', expect.objectContaining({ include_member: true }))
  })
  it('visiteur => include_member=false', async () => {
    const service = serviceReturning([])
    await retrieve('q', 'visitor', { service: service as never, provider, threshold: 0 })
    expect(service.rpc).toHaveBeenCalledWith('match_rag_chunks', expect.objectContaining({ include_member: false }))
  })
  it("filtre par seuil d'ancrage", async () => {
    const service = serviceReturning([
      { id: 'a', source_type: 'subject', source_id: 's', content: 'x', labo: 'paris', lang: 'en', similarity: 0.9 },
      { id: 'b', source_type: 'kb', source_id: 'kb:x', content: 'y', labo: null, lang: 'en', similarity: 0.2 },
    ])
    const out = await retrieve('q', 'visitor', { service: service as never, provider, threshold: 0.5 })
    expect(out.map(c => c.id)).toEqual(['a'])
  })
})

describe('retrieveSubjectFiles', () => {
  const provider = { embed: async () => [[0.1, 0.2]] }
  it('appelle match_subject_files scope au sujet et filtre par seuil', async () => {
    const calls: Array<[string, Record<string, unknown>]> = []
    const service = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push([fn, args])
        return { data: [
          { id: '1', source_type: 'subject_file', source_id: 'f1', content: 'a', labo: 'paris', lang: 'en', metadata: { subject_id: 's1' }, similarity: 0.9 },
          { id: '2', source_type: 'subject_file', source_id: 'f2', content: 'b', labo: 'paris', lang: 'en', metadata: { subject_id: 's1' }, similarity: 0.1 },
        ], error: null }
      },
    }
    const out = await retrieveSubjectFiles('query', 's1', { service: service as never, provider: provider as never, threshold: 0.3 })
    expect(calls[0]![0]).toBe('match_subject_files')
    expect(calls[0]![1].p_subject_id).toBe('s1')
    expect(out).toHaveLength(1)
    expect(out[0]!.source_id).toBe('f1')
  })
})
