import { describe, it, expect, vi } from 'vitest'
import { createOpenAIChatProvider } from './openai'

function sseResponse(chunks: string[]): typeof fetch {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
  return vi.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch
}

describe('createOpenAIChatProvider.stream', () => {
  it("yield les deltas de texte et s'arrete sur [DONE]", async () => {
    const fetchImpl = sseResponse([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const p = createOpenAIChatProvider({ apiKey: 'sk', model: 'm', fetchImpl })
    let out = ''
    for await (const delta of p.stream([{ role: 'user', content: 'hi' }])) out += delta
    expect(out).toBe('Hello')
  })

  it("leve une erreur quand la reponse est non-ok (status 500)", async () => {
    const fetchImpl = vi.fn(async () => new Response('err', { status: 500 })) as unknown as typeof fetch
    const p = createOpenAIChatProvider({ apiKey: 'sk', model: 'm', fetchImpl })
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (async () => { for await (const _chunk of p.stream([{ role: 'user', content: 'hi' }])) {} })()
    ).rejects.toThrow(/OpenAI chat failed/)
  })
})
