import type { Tier } from '@/lib/rag/retrieve'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = { from: (t: string) => any }

export interface ToolContext {
  tier: Tier
  service: SupabaseLike
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ToolResult = Record<string, unknown>
export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>

export interface RegisteredTool {
  def: ToolDef
  handler: ToolHandler
}
