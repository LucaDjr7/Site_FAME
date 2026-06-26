import { describe, it, expect } from 'vitest'
import { getSubjectProgress } from './get-subject-progress'
import type { ToolContext } from './types'

function ctx(tier: 'visitor' | 'member', subject: unknown, tasks: unknown[]): ToolContext {
  return {
    tier,
    service: {
      from: (t: string) => ({
        select: () => ({
          eq: () => (t === 'subjects'
            ? { maybeSingle: async () => ({ data: subject, error: null }) }
            : { data: tasks, error: null }),
        }),
      }),
    } as never,
  }
}

const subj = { id: 's1', titre: 'Inflation', statut: 'active', confidentiel: false }
const tasks = [{ statut: 'done' }, { statut: 'done' }, { statut: 'in-progress' }, { statut: 'to-do' }]

describe('get_subject_progress', () => {
  it('agrège l’avancement', async () => {
    const r = await getSubjectProgress.handler({ subject_id: 's1' }, ctx('visitor', subj, tasks))
    expect(r).toMatchObject({ found: true, tasks_total: 4, tasks_done: 2, tasks_in_progress: 1, tasks_todo: 1 })
  })
  it('refuse un sujet confidentiel à un visiteur', async () => {
    const r = await getSubjectProgress.handler({ subject_id: 's1' }, ctx('visitor', { ...subj, confidentiel: true }, tasks))
    expect(r).toEqual({ found: false })
  })
  it('autorise un sujet confidentiel à un membre', async () => {
    const r = await getSubjectProgress.handler({ subject_id: 's1' }, ctx('member', { ...subj, confidentiel: true }, tasks))
    expect(r).toMatchObject({ found: true })
  })
})
