import type { RegisteredTool, ToolContext, ToolResult } from './types'
import { getSubjectProgress } from './get-subject-progress'
import { findTasks } from './find-tasks'
import { getSubjectFiles } from './get-subject-files'

export const TOOLS: Record<string, RegisteredTool> = {
  get_subject_progress: getSubjectProgress,
  find_tasks: findTasks,
  get_subject_files: getSubjectFiles,
}

export function toolDefs(): { type: 'function'; function: RegisteredTool['def'] }[] {
  return Object.values(TOOLS).map(t => ({ type: 'function', function: t.def }))
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const tool = TOOLS[name]
  if (!tool) return { error: 'unknown_tool' }
  return tool.handler(args, ctx)
}
