import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('.env.example', () => {
  it('documente les clés assistant sans valeurs secrètes', () => {
    expect(existsSync('.env.example')).toBe(true)
    const s = readFileSync('.env.example', 'utf8')
    for (const k of ['OPENAI_API_KEY', 'ASSISTANT_MODEL', 'ASSISTANT_EMBED_MODEL', 'ASSISTANT_SIMILARITY_THRESHOLD', 'ASSISTANT_MONTHLY_BUDGET_USD', 'ASSISTANT_DISABLED'])
      expect(s).toContain(k)
    // pas de vraie clé OpenAI commitée
    expect(s).not.toMatch(/sk-[A-Za-z0-9]{20,}/)
  })
})
