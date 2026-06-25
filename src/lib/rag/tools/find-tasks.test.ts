import { describe, it, expect } from 'vitest'
import { findTasks } from './find-tasks'
import type { ToolContext } from './types'

const taskRows = [
  { id: 't1', titre: 'Run regressions', statut: 'to-do', labo: 'paris', sujet_id: 's1',
    subjects: { confidentiel: false },
    task_assignees: [{ members: { prenom: 'Ada', nom: 'Lovelace', email: 'ada@x.org' } }] },
  { id: 't2', titre: 'Secret', statut: 'to-do', labo: 'paris', sujet_id: 's2',
    subjects: { confidentiel: true }, task_assignees: [] },
]

function ctx(tier: 'visitor' | 'member'): ToolContext {
  const builder: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    select: () => builder, eq: () => builder, limit: () => builder,
    then: (res: (v: { data: unknown; error: null }) => void) => res({ data: taskRows, error: null }),
  }
  return { tier, service: { from: () => builder } as never }
}

describe('find_tasks', () => {
  it('exclut les sujets confidentiels pour un visiteur et masque les emails', async () => {
    const r = await findTasks.handler({ labo: 'paris', statut: 'to-do' }, ctx('visitor'))
    const tasks = r.tasks as { id: string; assignees: string[] }[]
    expect(tasks.map(t => t.id)).toEqual(['t1'])
    expect(tasks[0]!.assignees).toEqual(['Ada Lovelace'])
    expect(JSON.stringify(r)).not.toContain('ada@x.org')
  })
  it('inclut les sujets confidentiels pour un membre', async () => {
    const r = await findTasks.handler({ labo: 'paris', statut: 'to-do' }, ctx('member'))
    expect((r.tasks as unknown[]).length).toBe(2)
  })
})
