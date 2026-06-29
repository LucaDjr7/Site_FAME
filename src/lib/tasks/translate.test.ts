import { describe, it, expect, vi } from 'vitest'
import { translateTaskFields, buildTaskI18n } from './translate'
import type { TaskI18nFields } from '@/types'

const src: TaskI18nFields = { titre: 'Build pipeline', description: 'Ingest news', subtasks: ['Fetch RSS', 'Parse'] }

describe('tasks translate', () => {
  it('fusionne le JSON traduit et garde la forme', async () => {
    const provider = { complete: vi.fn().mockResolvedValue({ content: JSON.stringify({ titre: 'Construire le pipeline', description: 'Ingérer les news', subtasks: ['Récupérer RSS', 'Parser'] }), toolCalls: [] }), stream: vi.fn() }
    const out = await translateTaskFields(src, 'fr', { provider, record: vi.fn() })
    expect(out.titre).toBe('Construire le pipeline')
    expect(out.subtasks).toEqual(['Récupérer RSS', 'Parser'])
  })
  it('fallback à la source si JSON invalide', async () => {
    const provider = { complete: vi.fn().mockResolvedValue({ content: 'not json', toolCalls: [] }), stream: vi.fn() }
    const out = await translateTaskFields(src, 'fr', { provider, record: vi.fn() })
    expect(out).toEqual(src)
  })
  it('buildTaskI18n court-circuite si disabled', async () => {
    const provider = { complete: vi.fn(), stream: vi.fn() }
    const i18n = await buildTaskI18n(src, 'en', { provider, disabled: true })
    expect(provider.complete).not.toHaveBeenCalled()
    expect(i18n.en).toEqual(src)
    expect(i18n.fr).toEqual(src)
  })
})
