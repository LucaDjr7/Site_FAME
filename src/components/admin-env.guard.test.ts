import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8')

describe('D7 — admin layout protected by requireAdmin', () => {
  it('admin/layout.tsx calls requireAdmin', () => {
    expect(src('../app/[locale]/admin/layout.tsx')).toContain('requireAdmin')
  })
})

describe('TS-04 — server.ts uses guarded env reads (no !-assertion)', () => {
  it('server.ts no longer non-null-asserts NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(src('../lib/supabase/server.ts')).not.toContain(
      'process.env.NEXT_PUBLIC_SUPABASE_URL!'
    )
  })
  it('server.ts throws on missing Supabase env', () => {
    expect(src('../lib/supabase/server.ts')).toContain('Missing Supabase env')
  })
})
