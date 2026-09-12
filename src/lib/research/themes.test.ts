import { describe, it, expect } from 'vitest'
import { tagThemes, THEME_NAMES } from './themes'

describe('tagThemes', () => {
  it('tags a paper matching one theme', () => {
    const tags = tagThemes('Portfolio rebalancing', 'A mean-variance approach to diversification.')
    expect(tags).toContain('Portfolio')
  })

  it('tags a paper matching several themes', () => {
    const tags = tagThemes('LLM sentiment for crypto trading', 'We use a large language model and bitcoin price data.')
    expect(tags).toEqual(expect.arrayContaining(['LLMs', 'Crypto']))
  })

  it('returns an empty array when nothing matches', () => {
    expect(tagThemes('A history of medieval trade routes', 'No overlap with our taxonomy.')).toEqual([])
  })

  it('THEME_NAMES has 12 unique entries', () => {
    expect(new Set(THEME_NAMES).size).toBe(12)
  })
})
