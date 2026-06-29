import { describe, it, expect } from 'vitest'
import { localizedTask, localizedSubtaskLabel } from './localized'
import type { Task } from '@/types'

const base: Task = {
  id: '1', labo: 'paris', titre: 'Build', description: 'Do', statut: 'to-do',
  difficulte: 'easy', sujet_id: 's', date_creation: '', date_echeance: null,
  i18n: { fr: { titre: 'Construire', description: 'Faire' } },
}

describe('localizedTask', () => {
  it('sert la locale demandée', () => {
    expect(localizedTask(base, 'fr')).toEqual({ titre: 'Construire', description: 'Faire' })
  })
  it('fallback aux colonnes plates', () => {
    expect(localizedTask(base, 'en')).toEqual({ titre: 'Build', description: 'Do' })
  })
  it('localise un label de sous-tâche avec fallback', () => {
    expect(localizedSubtaskLabel({ label: 'Fetch', i18n: { fr: { label: 'Récupérer' } } }, 'fr')).toBe('Récupérer')
    expect(localizedSubtaskLabel({ label: 'Fetch', i18n: {} }, 'fr')).toBe('Fetch')
  })
})
