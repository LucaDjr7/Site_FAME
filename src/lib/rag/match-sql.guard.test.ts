import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/007_match_rag_chunks.sql', 'utf8')

describe('match_rag_chunks — garde de sécurité', () => {
  it('filtre visibility=public quand include_member est faux', () => {
    expect(sql).toContain("include_member or c.visibility = 'public'")
  })
  it('borne les résultats (limit match_count)', () => {
    expect(sql.toLowerCase()).toContain('limit match_count')
  })
  it('ignore les embeddings nuls', () => {
    expect(sql).toContain('c.embedding is not null')
  })
})
