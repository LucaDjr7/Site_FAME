import { describe, it, expect } from 'vitest'
import { TOOLS, toolDefs, runTool } from './index'
import type { ToolContext } from './types'

describe('registre d\'outils', () => {
  it('expose les 3 outils', () => {
    expect(Object.keys(TOOLS).sort()).toEqual(['find_tasks', 'get_subject_files', 'get_subject_progress'])
  })
  it('toolDefs() au format OpenAI', () => {
    const defs = toolDefs()
    expect(defs[0]!).toHaveProperty('type', 'function')
    expect(defs[0]!.function).toHaveProperty('name')
  })
  it('runTool inconnu → erreur', async () => {
    const ctx = { tier: 'visitor', service: {} } as unknown as ToolContext
    expect(await runTool('nope', {}, ctx)).toEqual({ error: 'unknown_tool' })
  })
})
