import { describe, it, expect } from 'vitest'
import type { Task, Subtask, TaskI18nFields, TaskI18n } from '@/types'

describe('Task i18n types', () => {
  it('accepte une tâche avec i18n bilingue', () => {
    const fields: TaskI18nFields = { titre: 'Build X', description: 'Do Y', subtasks: ['a', 'b'] }
    const i18n: TaskI18n = { en: fields, fr: { titre: 'Construire X' } }
    const task: Task = {
      id: '1', labo: 'paris', titre: 'Build X', description: 'Do Y',
      statut: 'to-do', difficulte: 'easy', sujet_id: 's1',
      date_creation: '2026-01-01', date_echeance: null, i18n,
    }
    const sub: Subtask['i18n'] = { fr: { label: 'étape' } }
    expect(task.i18n.en?.titre).toBe('Build X')
    expect(sub.fr?.label).toBe('étape')
  })
})
