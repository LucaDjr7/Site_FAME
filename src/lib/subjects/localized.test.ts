import { describe, it, expect } from 'vitest'
import { localizedSubject, subjectSearchText, toLocale2 } from './localized'
import type { Subject } from '@/types'

function mk(over: Partial<Subject> = {}): Subject {
  return {
    id: '1', labo: 'paris', titre: 'Titre FR', kicker: 'Recherche · IA',
    question: 'Q FR', accroche: 'A FR', periode: '', statut: 'active',
    context: 'C FR', method: 'M FR', results: 'R FR', keywords: ['kfr'],
    auteurs: [], difficulte: 'intermediate',
    dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre: 0, is_transversal: false, confidentiel: false, i18n: {},
    created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
  }
}

describe('localizedSubject', () => {
  it('returns the requested language when present', () => {
    const L = localizedSubject(mk({ i18n: { en: { titre: 'Title EN', question: 'Q EN' } } }), 'en')
    expect(L.titre).toBe('Title EN')
    expect(L.question).toBe('Q EN')
  })
  it('falls back to flat columns when the language is missing', () => {
    expect(localizedSubject(mk(), 'en').titre).toBe('Titre FR')
  })
  it('maps the kicker across locales via the domain list', () => {
    expect(localizedSubject(mk({ kicker: 'Recherche · IA' }), 'en').kicker).toBe('Research · AI')
  })
  it('keeps a custom kicker unchanged', () => {
    expect(localizedSubject(mk({ kicker: 'Custom' }), 'en').kicker).toBe('Custom')
  })
})

describe('subjectSearchText', () => {
  it('includes both languages, lowercased', () => {
    const text = subjectSearchText(mk({ i18n: { en: { titre: 'Title EN' } } }))
    expect(text).toContain('titre fr')
    expect(text).toContain('title en')
  })
})

describe('toLocale2', () => {
  it('maps fr, defaults everything else to en', () => {
    expect(toLocale2('fr')).toBe('fr')
    expect(toLocale2('de')).toBe('en')
  })
})
