import { describe, it, expect } from 'vitest'
import { buildLabelI18n } from './relation-label'
import type { ChatProvider } from '@/lib/llm'

function provider(content: string): ChatProvider {
  return { async *stream() {}, async complete() { return { content, toolCalls: [] } } }
}
function throwingProvider(): ChatProvider {
  return { async *stream() {}, async complete(): Promise<never> { throw new Error('boom') } }
}

describe('buildLabelI18n', () => {
  it('renvoie {} pour un libellé vide', async () => {
    expect(await buildLabelI18n('', 'fr', { disabled: true })).toEqual({})
  })

  it('disabled : même libellé dans les deux langues', async () => {
    const r = await buildLabelI18n('mêmes données', 'fr', { disabled: true })
    expect(r.fr).toEqual({ label: 'mêmes données' })
    expect(r.en).toEqual({ label: 'mêmes données' })
  })

  it('traduit vers l’autre langue', async () => {
    const r = await buildLabelI18n('mêmes données', 'fr', { provider: provider('same data'), record: async () => {} })
    expect(r.fr).toEqual({ label: 'mêmes données' })
    expect(r.en).toEqual({ label: 'same data' })
  })

  it('repli sur la source si la traduction échoue', async () => {
    const r = await buildLabelI18n('x', 'en', { provider: throwingProvider(), record: async () => {} })
    expect(r.en).toEqual({ label: 'x' })
    expect(r.fr).toEqual({ label: 'x' })
  })
})
