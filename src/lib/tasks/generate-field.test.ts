import { describe, it, expect, vi } from 'vitest'
import { generateTaskField } from './generate-field'

describe('generateTaskField', () => {
  it("appelle le provider et enregistre l'usage", async () => {
    const provider = { complete: vi.fn().mockResolvedValue({ content: '  Build the ingest pipeline  ', toolCalls: [] }), stream: vi.fn() }
    const record = vi.fn().mockResolvedValue(undefined)
    const out = await generateTaskField('titre', { subjectTitre: 'Sentiment' }, 'en', { provider, record })
    expect(out).toBe('Build the ingest pipeline')
    expect(provider.complete).toHaveBeenCalledOnce()
    expect(record).toHaveBeenCalledOnce()
  })
})
