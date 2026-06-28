import { describe, it, expect } from 'vitest'
import { vitrineHeadline, vitrineSubtitle, vitrineNumber } from './vitrine'

describe('vitrine helpers', () => {
  it('uses question as headline when present, titre as subtitle', () => {
    const s = { question: 'Why refused?', titre: 'XAI for credit' }
    expect(vitrineHeadline(s)).toBe('Why refused?')
    expect(vitrineSubtitle(s)).toBe('XAI for credit')
  })
  it('falls back to titre as headline when question empty, no subtitle', () => {
    const s = { question: '  ', titre: 'XAI for credit' }
    expect(vitrineHeadline(s)).toBe('XAI for credit')
    expect(vitrineSubtitle(s)).toBe('')
  })
  it('formats the index number 1-based, zero-padded to 3', () => {
    expect(vitrineNumber(0)).toBe('001')
    expect(vitrineNumber(13)).toBe('014')
  })
})
