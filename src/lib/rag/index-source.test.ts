import { describe, it, expect } from 'vitest'
import { indexSource } from './index-source'
import type { EmbeddingProvider } from '@/lib/llm'

function makeService(row: Record<string, unknown>) {
  const deleted: unknown[] = []
  const inserted: unknown[] = []
  const service = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
      delete: () => ({ eq: (_c: string, v: string) => { deleted.push(v); return Promise.resolve({ error: null }) } }),
      insert: (rows: unknown[]) => { inserted.push(...rows); return Promise.resolve({ error: null }) },
      _table: table,
    }),
  }
  return { service, deleted, inserted }
}

const provider: EmbeddingProvider = { embed: async (t) => t.map(() => [0.1, 0.2]) }

describe('indexSource(subject)', () => {
  it('sujet confidentiel → chunks visibility=member + confidentiel=true', async () => {
    const subject = {
      id: 's1', labo: 'paris', titre: 'T', kicker: '', statut: 'active',
      context: 'ctx', method: '', results: '', keywords: [], auteurs: [],
      difficulte: 'easy', dimensions: {}, ordre: 0, is_transversal: false,
      confidentiel: true, created_at: '', updated_at: '',
    }
    const { service, inserted, deleted } = makeService(subject)
    await indexSource('subject', 's1', { service: service as never, provider })
    expect(deleted).toContain('s1')            // purge des anciens chunks
    expect(inserted.length).toBe(1)            // un seul champ non vide (context)
    expect(inserted[0]).toMatchObject({
      source_type: 'subject', source_id: 's1', visibility: 'member',
      confidentiel: true, labo: 'paris', embedding: [0.1, 0.2],
    })
  })
})
