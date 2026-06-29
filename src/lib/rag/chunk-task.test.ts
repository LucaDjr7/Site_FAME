import { describe, it, expect } from 'vitest'
import { chunkTask } from './chunk'
import type { Task } from '@/types'

const t: Task = {
  id: '1', labo: 'paris', titre: 'Build', description: 'Do', statut: 'to-do',
  difficulte: 'easy', sujet_id: 's', date_creation: '', date_echeance: null,
  i18n: { en: { titre: 'Build', description: 'Do' }, fr: { titre: 'Construire', description: 'Faire' } },
}

describe('chunkTask bilingue', () => {
  it('émet un chunk par langue', () => {
    const out = chunkTask(t)
    expect(out.some(c => c.content.includes('Construire'))).toBe(true)
    expect(out.some(c => c.content.includes('Build'))).toBe(true)
  })
})
