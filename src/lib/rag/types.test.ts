import { describe, it, expect } from 'vitest'
import type { Subject } from '@/types'
import type { RagSourceType, RagVisibility, RagChunkRow } from '@/types'

describe('RAG types', () => {
  it('Subject porte confidentiel:boolean', () => {
    const s: Pick<Subject, 'confidentiel'> = { confidentiel: false }
    expect(s.confidentiel).toBe(false)
  })
  it('RagChunkRow a la forme attendue', () => {
    const row: RagChunkRow = {
      id: '1', source_type: 'subject' as RagSourceType, source_id: 'x',
      labo: 'paris', is_transversal: false, confidentiel: false,
      visibility: 'public' as RagVisibility, lang: 'en', content: 'c',
      embedding: null, token_count: 0, embedding_stale: false, metadata: {},
    }
    expect(row.visibility).toBe('public')
  })
})
