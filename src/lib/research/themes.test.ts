import { describe, it, expect } from 'vitest'
import { tagThemes, THEME_NAMES, THEMES, themeSlug, isKnownThemeSlug } from './themes'
import en from '../../../messages/en.json'
import fr from '../../../messages/fr.json'

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

describe('themeSlug', () => {
  it('kebab-cases a multi-word theme name', () => {
    expect(themeSlug('Factor Investing')).toBe('factor-investing')
    expect(themeSlug('Return Forecasting')).toBe('return-forecasting')
  })

  it('produces a unique slug per theme', () => {
    expect(new Set(THEMES.map((t) => themeSlug(t.name))).size).toBe(THEMES.length)
  })

  it('reports a theme outside the taxonomy as unknown so callers can fall back', () => {
    expect(isKnownThemeSlug(themeSlug('LLMs'))).toBe(true)
    expect(isKnownThemeSlug(themeSlug('Medieval Trade Routes'))).toBe(false)
  })

  // Zero hardcoded UI strings: every theme chip / filter button renders
  // `research.themes.<slug>`. A theme added without both translations would
  // otherwise ship a missing-message placeholder to users.
  it('every theme has a display label in both locales', () => {
    const enThemes = en.research.themes as Record<string, string>
    const frThemes = fr.research.themes as Record<string, string>
    for (const { name } of THEMES) {
      const slug = themeSlug(name)
      expect(enThemes[slug], `missing en label for ${name}`).toBeTruthy()
      expect(frThemes[slug], `missing fr label for ${name}`).toBeTruthy()
    }
    expect(Object.keys(enThemes)).toHaveLength(THEMES.length)
  })

  // Same rule for the source badge / source filter.
  it('every research source has a display label in both locales', () => {
    const sources = ['arxiv', 'openalex', 'repec', 'semantic_scholar', 'manual']
    const enSources = en.research.sources as Record<string, string>
    const frSources = fr.research.sources as Record<string, string>
    for (const s of sources) {
      expect(enSources[s], `missing en label for ${s}`).toBeTruthy()
      expect(frSources[s], `missing fr label for ${s}`).toBeTruthy()
    }
    expect(Object.keys(enSources)).toHaveLength(sources.length)
  })
})
