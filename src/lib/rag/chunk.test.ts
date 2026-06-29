import { describe, it, expect } from 'vitest'
import { chunkSubject, chunkPublication, chunkPrompt, chunkMember, chunkTask, chunkText } from './chunk'
import type { Subject, Member } from '@/types'

function makeSubject(over: Partial<Subject> = {}): Subject {
  return {
    id: '1', labo: 'paris', titre: 'T', kicker: 'K',
    question: '', accroche: '', periode: '',
    statut: 'active', context: '', method: '', results: '',
    keywords: [], auteurs: [], difficulte: 'intermediate',
    dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre: 0, is_transversal: false, confidentiel: false,
    i18n: {},
    created_at: '2026-01-01', updated_at: '2026-01-01',
    ...over,
  }
}

describe('chunkSubject', () => {
  const base: Subject = {
    id: 's1', labo: 'paris', titre: 'Inflation dynamics', kicker: 'Macro',
    question: '', accroche: '', periode: '',
    statut: 'active', context: 'Ctx text', method: 'Method text', results: '',
    keywords: ['inflation'], auteurs: [], difficulte: 'intermediate',
    dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 0,
    is_transversal: false, confidentiel: false,
    i18n: {},
    created_at: '', updated_at: '',
  }
  it('crée un chunk par champ non vide, préfixé du titre', () => {
    const chunks = chunkSubject(base)
    expect(chunks.length).toBe(2) // context + method (results vide ignoré)
    expect(chunks[0]!.content).toContain('Inflation dynamics')
    expect(chunks[0]!.content).toContain('Ctx text')
  })
  it('ignore les champs vides', () => {
    expect(chunkSubject({ ...base, context: '', method: '', results: '' }).length).toBe(0)
  })
  it('includes question and accroche when present', () => {
    const joined = chunkSubject(makeSubject({ question: 'Why?', accroche: 'A hook.' }))
      .map(c => c.content).join('\n')
    expect(joined).toContain('Question: Why?')
    expect(joined).toContain('Accroche: A hook.')
  })
  it('omits empty fields', () => {
    expect(chunkSubject(makeSubject())).toHaveLength(0)
  })
  it('indexes both languages when i18n is present', () => {
    const joined = chunkSubject(makeSubject({
      question: 'Q fr', context: 'Ctx fr',
      i18n: {
        fr: { question: 'Q fr', accroche: '', context: 'Ctx fr', method: '', results: '', titre: '', keywords: [], dimensions: { method: '', data: '', theory: '', writing: '' } },
        en: { question: 'Q en', accroche: '', context: 'Ctx en', method: '', results: '', titre: '', keywords: [], dimensions: { method: '', data: '', theory: '', writing: '' } },
      },
    })).map(c => c.content).join('\n')
    expect(joined).toContain('Question: Q fr')
    expect(joined).toContain('Question: Q en')
    expect(joined).toContain('Context: Ctx en')
  })
})

describe('chunkMember', () => {
  it('n’inclut jamais l’email', () => {
    const m: Member = {
      id: 'm1', prenom: 'Ada', nom: 'Lovelace', email: 'ada@x.org',
      role: 'researcher', labo: 'paris', domaines: ['finance'], photo_url: null,
      is_admin: false, activated_at: null, created_at: '',
    }
    const chunks = chunkMember(m)
    expect(chunks.length).toBe(1)
    expect(chunks[0]!.content).toContain('Ada Lovelace')
    expect(chunks[0]!.content).not.toContain('ada@x.org')
  })
})

describe('chunkPublication / chunkPrompt', () => {
  it('publication → 1 chunk bibliographique', () => {
    const c = chunkPublication({ id: 'p1', labo: 'paris', titre: 'Paper T', auteurs: ['X'], annee: 2024, type: 'article', revue_ou_conf: 'JE', lien: null, created_at: '' })
    expect(c.length).toBe(1)
    expect(c[0]!.content).toContain('Paper T')
    expect(c[0]!.content).toContain('2024')
  })
  it('prompt → 1 chunk (titre + texte)', () => {
    const c = chunkPrompt({ id: 'pr1', labo: 'paris', titre: 'Lit review', type_cible: 'subject', texte: 'Do X', is_transversal: false, created_by: null, created_at: '' })
    expect(c[0]!.content).toContain('Lit review')
    expect(c[0]!.content).toContain('Do X')
  })
})

describe('chunkTask', () => {
  it('tâche → 1 chunk (titre + statut + description)', () => {
    const c = chunkTask({
      id: 't1', labo: 'paris', titre: 'Collecter données', description: 'INSEE',
      statut: 'in-progress', difficulte: 'easy', sujet_id: 's1',
      date_creation: '', date_echeance: null, i18n: {},
    })
    expect(c.length).toBe(1)
    expect(c[0]!.content).toContain('Collecter données')
    expect(c[0]!.content).toContain('INSEE')
  })
})

describe('chunkText', () => {
  it('renvoie [] pour vide', () => {
    expect(chunkText('   ')).toEqual([])
  })
  it('un seul chunk si court', () => {
    const c = chunkText('court texte')
    expect(c).toHaveLength(1)
    expect(c[0]!.content).toBe('court texte')
  })
  it('découpe un texte long en plusieurs chunks qui se chevauchent', () => {
    const text = 'a'.repeat(4000)
    const c = chunkText(text, 1500, 150)
    expect(c.length).toBeGreaterThan(1)
    expect(c.every((x) => x.content.length <= 1500)).toBe(true)
  })
})
