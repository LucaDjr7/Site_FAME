// src/lib/research/search.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeSearchTerm } from './search'

describe('sanitizeSearchTerm', () => {
  it('leaves an ordinary search term untouched', () => {
    expect(sanitizeSearchTerm('portfolio allocation')).toBe('portfolio allocation')
  })

  it('strips the characters that are structural in PostgREST\'s .or() mini-language', () => {
    // Without this, `q = "x,abstract.ilike.%y%"` would inject a third filter
    // term into `title.ilike.%…%,abstract.ilike.%…%`.
    expect(sanitizeSearchTerm('x,abstract.ilike.%y%')).toBe('x abstract ilike y')
    expect(sanitizeSearchTerm('deep (learning)')).toBe('deep learning')
  })

  it('strips ilike wildcards so a term cannot silently widen the match', () => {
    expect(sanitizeSearchTerm('a%b_c*d')).toBe('a b c d')
    expect(sanitizeSearchTerm('back\\slash')).toBe('back slash')
  })

  it('collapses the whitespace left behind and trims', () => {
    expect(sanitizeSearchTerm('  ...llm...  ')).toBe('llm')
  })

  it('returns an empty string for a term made only of stripped characters', () => {
    // The caller treats "" as "no search filter", which is the right outcome.
    expect(sanitizeSearchTerm('%%%')).toBe('')
  })
})
