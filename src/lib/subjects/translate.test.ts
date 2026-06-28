import { describe, it, expect, vi } from 'vitest'
import { translateSubjectFields, buildSubjectI18n } from './translate'
import type { ChatProvider } from '@/lib/llm'
import type { SubjectI18nFields } from '@/types'

const SRC: SubjectI18nFields = {
  titre: 'Titre', question: 'Question ?', accroche: 'Accroche',
  context: 'Contexte', method: 'Méthode', results: 'Résultats',
  keywords: ['a', 'b'],
  dimensions: { method: 'm', data: 'd', theory: 't', writing: 'w' },
}
function provider(content: string): ChatProvider {
  return { async *stream() {}, async complete() { return { content, toolCalls: [] } } }
}

describe('translateSubjectFields', () => {
  it('parses model JSON and returns translated fields', async () => {
    const json = JSON.stringify({ ...SRC, titre: 'Title', context: 'Context' })
    const out = await translateSubjectFields(SRC, 'en', { provider: provider(json), record: async () => {} })
    expect(out.titre).toBe('Title')
    expect(out.context).toBe('Context')
    expect(out.keywords).toEqual(['a', 'b'])
  })
  it('strips code fences and falls back per missing key', async () => {
    const out = await translateSubjectFields(SRC, 'en', { provider: provider('```json\n{"titre":"X"}\n```'), record: async () => {} })
    expect(out.titre).toBe('X')
    expect(out.method).toBe('Méthode')
  })
  it('falls back to source on invalid JSON and does not record usage', async () => {
    const record = vi.fn(async () => {})
    const out = await translateSubjectFields(SRC, 'en', { provider: provider('not json'), record })
    expect(out).toEqual(SRC)
    expect(record).not.toHaveBeenCalled()
  })
})

describe('buildSubjectI18n', () => {
  it('fills source verbatim and translates the other language', async () => {
    const json = JSON.stringify({ ...SRC, titre: 'Title' })
    const i18n = await buildSubjectI18n(SRC, 'fr', { provider: provider(json), record: async () => {} })
    expect(i18n.fr?.titre).toBe('Titre')
    expect(i18n.en?.titre).toBe('Title')
  })
  it('copies source to both languages when disabled', async () => {
    const i18n = await buildSubjectI18n(SRC, 'fr', { disabled: true })
    expect(i18n.fr?.titre).toBe('Titre')
    expect(i18n.en?.titre).toBe('Titre')
  })
  it('copies source to both languages when overBudget', async () => {
    const i18n = await buildSubjectI18n(SRC, 'fr', { overBudget: true })
    expect(i18n.fr?.titre).toBe('Titre')
    expect(i18n.en?.titre).toBe('Titre')
  })
})
