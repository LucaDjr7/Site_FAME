import { describe, it, expect, vi } from 'vitest'
import { createOpenAIChatProvider } from './openai'

function jsonResponse(payload: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch
}

describe('ChatProvider.complete', () => {
  it('extrait les tool_calls', async () => {
    const fetchImpl = jsonResponse({
      choices: [{ message: { content: null, tool_calls: [
        { id: 'c1', function: { name: 'find_tasks', arguments: '{"labo":"paris"}' } },
      ] } }],
    })
    const p = createOpenAIChatProvider({ apiKey: 'sk', model: 'm', fetchImpl })
    const out = await p.complete([{ role: 'user', content: 'tasks?' }], { tools: [] })
    expect(out.toolCalls).toEqual([{ id: 'c1', name: 'find_tasks', arguments: '{"labo":"paris"}' }])
    expect(out.content).toBeNull()
  })
  it('renvoie le contenu quand pas d’outils', async () => {
    const fetchImpl = jsonResponse({ choices: [{ message: { content: 'Hello', tool_calls: undefined } }] })
    const p = createOpenAIChatProvider({ apiKey: 'sk', model: 'm', fetchImpl })
    const out = await p.complete([{ role: 'user', content: 'hi' }])
    expect(out).toEqual({ content: 'Hello', toolCalls: [] })
  })
})
