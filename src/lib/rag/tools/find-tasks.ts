import type { RegisteredTool, ToolContext, ToolResult } from './types'

const VALID_STATUT = ['to-do', 'in-progress', 'done']

async function handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  let query = ctx.service.from('tasks').select(
    'id, titre, statut, labo, sujet_id, subjects(confidentiel), task_assignees(members(prenom, nom))',
  )
  if (args.labo === 'paris' || args.labo === 'montreal') query = query.eq('labo', args.labo)
  if (typeof args.statut === 'string' && VALID_STATUT.includes(args.statut)) query = query.eq('statut', args.statut)
  if (typeof args.subject_id === 'string' && args.subject_id) query = query.eq('sujet_id', args.subject_id)
  query = query.limit(25)

  const { data } = await query
  const rows: any[] = data ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any

  const tasks = rows
    .filter(r => ctx.tier === 'member' || !r.subjects?.confidentiel)
    .map(r => ({
      id: r.id,
      titre: r.titre,
      statut: r.statut,
      labo: r.labo,
      assignees: (r.task_assignees ?? [])
        .map((a: any) => a.members) // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter(Boolean)
        .map((m: { prenom: string; nom: string }) => `${m.prenom} ${m.nom}`),
    }))
  return { tasks }
}

export const findTasks: RegisteredTool = {
  def: {
    name: 'find_tasks',
    description: 'List FAME tasks, optionally filtered by lab (paris/montreal), status (to-do/in-progress/done), or subject id. Returns task titles, status, and assignee names.',
    parameters: {
      type: 'object',
      properties: {
        labo: { type: 'string', enum: ['paris', 'montreal'] },
        statut: { type: 'string', enum: ['to-do', 'in-progress', 'done'] },
        subject_id: { type: 'string' },
      },
    },
  },
  handler,
}
