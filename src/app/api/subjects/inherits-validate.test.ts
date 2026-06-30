import { describe, it, expect } from 'vitest'
import { sanitizeInherits } from './[id]/route'

describe('sanitizeInherits', () => {
  const mothers = new Set(['m1', 'm2'])
  it('garde une clé héritable pointant une mère réelle', () => {
    expect(sanitizeInherits({ context: 'm1' }, mothers)).toEqual({ context: 'm1' })
  })
  it('rejette un champ non héritable', () => {
    expect(sanitizeInherits({ titre: 'm1' }, mothers)).toEqual({})
  })
  it('rejette une mère inconnue', () => {
    expect(sanitizeInherits({ context: 'zzz' }, mothers)).toEqual({})
  })
  it('ignore les valeurs non-string', () => {
    expect(sanitizeInherits({ context: 123 }, mothers)).toEqual({})
  })
})
