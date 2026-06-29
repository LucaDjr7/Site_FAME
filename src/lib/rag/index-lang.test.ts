import { describe, it, expect } from 'vitest'
import { chunkSubject } from './chunk'
import type { Subject } from '@/types'

const s = {
  id: '1', labo: 'paris', titre: 'T', kicker: '', question: 'Q', accroche: 'A', periode: '',
  statut: 'active', context: 'C', method: 'M', results: 'R', keywords: [], auteurs: [], difficulte: 'easy',
  dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 0, is_transversal: false,
  confidentiel: false, i18n: { en: { question: 'EN q' }, fr: { question: 'FR q' } }, created_at: '', updated_at: '',
} as unknown as Subject

describe('chunkSubject lang tagging', () => {
  it('tague les chunks FR et EN', () => {
    const out = chunkSubject(s)
    expect(out.find(c => c.content.includes('EN q'))?.lang).toBe('en')
    expect(out.find(c => c.content.includes('FR q'))?.lang).toBe('fr')
  })
})
