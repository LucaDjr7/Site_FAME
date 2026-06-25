import type { RegisteredTool, ToolContext, ToolResult } from './types'

async function handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  if (ctx.tier !== 'member') return { allowed: false }
  const subjectId = String(args.subject_id ?? '')
  if (!subjectId) return { allowed: true, files: [] }

  const { data } = await ctx.service.from('dropbox_links')
    .select('node_name, node_path').eq('subject_id', subjectId)
  const files = (data ?? []).map((r: { node_name: string; node_path: string }) => ({ name: r.node_name, path: r.node_path }))
  return { allowed: true, files }
}

export const getSubjectFiles: RegisteredTool = {
  def: {
    name: 'get_subject_files',
    description: 'List Dropbox files linked to a FAME subject. Members only — visitors are not allowed.',
    parameters: {
      type: 'object',
      properties: { subject_id: { type: 'string' } },
      required: ['subject_id'],
    },
  },
  handler,
}
