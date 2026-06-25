import { describe, it, expect } from 'vitest'
import en from '../messages/en.json'
import fr from '../messages/fr.json'

const flat = (o: Record<string, unknown>, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v as Record<string, unknown>, p + k + '.') : [p + k])

describe('parité i18n', () => {
  it('mêmes clés EN et FR', () => {
    const e = new Set(flat(en)), f = new Set(flat(fr))
    expect([...e].filter(k => !f.has(k))).toEqual([])
    expect([...f].filter(k => !e.has(k))).toEqual([])
  })
})
