import { describe, it, expect } from 'vitest'
import { indexSource } from './index-source'
import type { EmbeddingProvider } from '@/lib/llm'

type SingleResult = { data: Record<string, unknown> | null; error: unknown }

// `rows` mappe un nom de table → résultat de `.single()`. Permet aux lectures
// `subjects` (sujet parent) et `tasks` de renvoyer des lignes/erreurs distinctes.
function makeService(rows: Record<string, SingleResult>) {
  const deleted: unknown[] = []
  const inserted: unknown[] = []
  const service = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => rows[table] ?? { data: null, error: null },
        }),
      }),
      delete: () => ({ eq: (_c: string, v: string) => { deleted.push(v); return Promise.resolve({ error: null }) } }),
      insert: (rows2: unknown[]) => { inserted.push(...rows2); return Promise.resolve({ error: null }) },
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
    const { service, inserted, deleted } = makeService({
      subjects: { data: subject, error: null },
    })
    await indexSource('subject', 's1', { service: service as never, provider })
    expect(deleted).toContain('s1')            // purge des anciens chunks
    expect(inserted.length).toBe(1)            // un seul champ non vide (context)
    expect(inserted[0]).toMatchObject({
      source_type: 'subject', source_id: 's1', visibility: 'member',
      confidentiel: true, labo: 'paris', embedding: [0.1, 0.2],
    })
  })
})

function makeTask() {
  return {
    id: 't1', sujet_id: 's1', labo: 'paris', titre: 'Tâche', description: 'desc',
    statut: 'todo', created_at: '', updated_at: '',
  }
}

describe('indexSource(task) — héritage de confidentialité du sujet parent', () => {
  it('parent confidentiel=true → chunks visibility=member + confidentiel=true', async () => {
    const { service, inserted } = makeService({
      tasks: { data: makeTask(), error: null },
      subjects: { data: { confidentiel: true }, error: null },
    })
    await indexSource('task', 't1', { service: service as never, provider })
    expect(inserted.length).toBeGreaterThan(0)
    expect(inserted[0]).toMatchObject({
      source_type: 'task', source_id: 't1', visibility: 'member', confidentiel: true,
    })
  })

  it('parent confidentiel=false → chunks visibility=public + confidentiel=false', async () => {
    const { service, inserted } = makeService({
      tasks: { data: makeTask(), error: null },
      subjects: { data: { confidentiel: false }, error: null },
    })
    await indexSource('task', 't1', { service: service as never, provider })
    expect(inserted.length).toBeGreaterThan(0)
    expect(inserted[0]).toMatchObject({
      source_type: 'task', source_id: 't1', visibility: 'public', confidentiel: false,
    })
  })

  it('FAIL-CLOSED : lecture du sujet parent en erreur → visibility=member (jamais public)', async () => {
    const { service, inserted } = makeService({
      tasks: { data: makeTask(), error: null },
      subjects: { data: null, error: { message: 'boom' } },
    })
    await indexSource('task', 't1', { service: service as never, provider })
    expect(inserted.length).toBeGreaterThan(0)
    expect(inserted[0]).toMatchObject({
      source_type: 'task', source_id: 't1', visibility: 'member', confidentiel: true,
    })
  })
})
