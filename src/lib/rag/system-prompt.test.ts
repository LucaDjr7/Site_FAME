import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './system-prompt'
import type { RetrievedChunk } from './retrieve'

const chunks: RetrievedChunk[] = [
  { id: '1', source_type: 'subject', source_id: 's1', content: 'Inflation dynamics — Context: ...', labo: 'paris', lang: 'en', similarity: 0.8 },
]

describe('buildSystemPrompt', () => {
  it('inclut les extraits récupérés', () => {
    expect(buildSystemPrompt('visitor', chunks)).toContain('Inflation dynamics')
  })
  it('contient les règles clés de bridage', () => {
    const p = buildSystemPrompt('visitor', chunks)
    expect(p).toMatch(/only.*(provided|context|sources)/i)   // grounding
    expect(p).toMatch(/FAME/)                                 // voix
    expect(p).toMatch(/never reveal|do not reveal/i)          // anti-extraction
  })
  it('signale le tier membre', () => {
    expect(buildSystemPrompt('member', chunks)).toMatch(/member/i)
  })
})
