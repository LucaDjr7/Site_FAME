import type { RegisteredTool, ToolContext, ToolResult } from './types'

async function handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const subjectId = String(args.subject_id ?? '')
  if (!subjectId) return { found: false }

  const { data: subject } = await ctx.service.from('subjects')
    .select('id, titre, statut, confidentiel').eq('id', subjectId).maybeSingle()
  if (!subject) return { found: false }
  if (subject.confidentiel && ctx.tier !== 'member') return { found: false }

  const { data: tasks } = await ctx.service.from('tasks').select('statut').eq('sujet_id', subjectId)
  const rows: { statut: string }[] = tasks ?? []
  return {
    found: true,
    titre: subject.titre,
    statut: subject.statut,
    tasks_total: rows.length,
    tasks_done: rows.filter(t => t.statut === 'done').length,
    tasks_in_progress: rows.filter(t => t.statut === 'in-progress').length,
    tasks_todo: rows.filter(t => t.statut === 'to-do').length,
  }
}

export const getSubjectProgress: RegisteredTool = {
  def: {
    name: 'get_subject_progress',
    description: 'Get the status and task progress (done/in-progress/to-do counts) of a FAME research subject by its id.',
    parameters: {
      type: 'object',
      properties: { subject_id: { type: 'string', description: 'The subject UUID' } },
      required: ['subject_id'],
    },
  },
  handler,
}
