import { describe, it, expect } from 'vitest'
import { buildFieldPrompt, isAssistField, ASSIST_FIELDS } from './field-prompts'

describe('field-prompts', () => {
  it('isAssistField recognises valid and rejects invalid', () => {
    expect(isAssistField('question')).toBe(true)
    expect(isAssistField('dimensions.method')).toBe(true)
    expect(isAssistField('nope')).toBe(false)
    expect(isAssistField(42)).toBe(false)
  })
  it('injects draft context into the user prompt', () => {
    const p = buildFieldPrompt('question', { kicker: 'AI & Finance', titre: 'XAI for credit' }, 'en')
    expect(p.user).toContain('AI & Finance')
    expect(p.user).toContain('XAI for credit')
    expect(p.displayPrompt).toBe(p.user)
    expect(p.system.length).toBeGreaterThan(0)
  })
  it('handles empty draft with a placeholder', () => {
    expect(buildFieldPrompt('accroche', {}, 'fr').user).toContain('aucune information')
  })
  it('covers every assist field without throwing', () => {
    for (const f of ASSIST_FIELDS) {
      expect(() => buildFieldPrompt(f, {}, 'en')).not.toThrow()
    }
  })
})
