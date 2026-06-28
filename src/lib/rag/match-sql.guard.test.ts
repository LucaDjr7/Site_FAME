import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDir = 'supabase/migrations'

function findMatchRagMigrations(): { file: string; sql: string }[] {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
  const results: { file: string; sql: string }[] = []
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8')
    if (sql.includes('function match_rag_chunks')) {
      results.push({ file: f, sql })
    }
  }
  return results
}

const migrations = findMatchRagMigrations()

describe('match_rag_chunks — garde de securite (toutes migrations)', () => {
  it('au moins un fichier de migration definit match_rag_chunks', () => {
    expect(migrations.length).toBeGreaterThan(0)
  })

  for (const { file, sql } of migrations) {
    describe(`migration ${file}`, () => {
      it('filtre visibility=public quand include_member est faux', () => {
        expect(sql).toContain("include_member or c.visibility = 'public'")
      })
      it('borne les resultats (limit match_count)', () => {
        expect(sql.toLowerCase()).toContain('limit match_count')
      })
      it('ignore les embeddings nuls', () => {
        expect(sql).toContain('c.embedding is not null')
      })
    })
  }
})
