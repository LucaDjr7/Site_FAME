import { describe, it, expect, vi } from 'vitest'
import { generateField } from './generate-field'
import type { ChatProvider } from '@/lib/llm'

function fakeProvider(content: string): ChatProvider {
  return {
    // eslint-disable-next-line require-yield
    async *stream() { return },
    async complete() { return { content, toolCalls: [] } },
  }
}

describe('generateField', () => {
  it('returns trimmed model text and records usage', async () => {
    const record = vi.fn(async () => {})
    const text = await generateField('question', { kicker: 'AI' }, 'en', {
      provider: fakeProvider('  Why refused?  '),
      record,
    })
    expect(text).toBe('Why refused?')
    expect(record).toHaveBeenCalledOnce()
  })

  it('returns empty string when model yields no content', async () => {
    const text = await generateField('accroche', {}, 'fr', {
      provider: fakeProvider(''),
      record: async () => {},
    })
    expect(text).toBe('')
  })
})
