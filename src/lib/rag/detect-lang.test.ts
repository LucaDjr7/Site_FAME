import { describe, it, expect } from 'vitest'
import { detectLang } from './detect-lang'

describe('detectLang', () => {
  it('détecte le français via mots-outils', () => {
    expect(detectLang('Quels sont les sujets de recherche sur la finance ?')).toBe('fr')
  })
  it('détecte l’anglais', () => {
    expect(detectLang('What research subjects do you have about finance?')).toBe('en')
  })
  it('français via accents même sans mot-outil évident', () => {
    expect(detectLang('Données économétriques élevées')).toBe('fr')
  })
})
