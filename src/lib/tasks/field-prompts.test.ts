import { describe, it, expect } from 'vitest'
import { buildTaskFieldPrompt, isTaskAssistField } from './field-prompts'

describe('buildTaskFieldPrompt', () => {
  it('reconnaît les champs valides', () => {
    expect(isTaskAssistField('titre')).toBe(true)
    expect(isTaskAssistField('nope')).toBe(false)
  })
  it('intègre le contexte du sujet et la consigne FR', () => {
    const p = buildTaskFieldPrompt('description', { titre: 'Pipeline', subjectTitre: 'Sentiment' }, 'fr')
    expect(p.system).toMatch(/français/i)
    expect(p.user).toMatch(/Pipeline/)
    expect(p.displayPrompt).toBe(p.user)
  })
  it('garde les termes techniques (instruction présente)', () => {
    const p = buildTaskFieldPrompt('titre', {}, 'en')
    expect(p.system).toMatch(/LLM|acronyms/i)
  })
})
