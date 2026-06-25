import type { EmbeddingProvider, ChatProvider, ChatMessage } from './provider'

interface OpenAIEmbeddingResponse {
  data: { embedding: number[] }[]
}

export function createOpenAIEmbeddingProvider(opts: {
  apiKey: string
  model: string
  dimensions: number
  fetchImpl?: typeof fetch
}): EmbeddingProvider {
  const doFetch = opts.fetchImpl ?? fetch
  return {
    async embed(texts) {
      if (texts.length === 0) return []
      const res = await doFetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: opts.model, input: texts, dimensions: opts.dimensions }),
      })
      if (!res.ok) {
        throw new Error(`OpenAI embeddings failed: ${res.status}`)
      }
      const json = (await res.json()) as OpenAIEmbeddingResponse
      return json.data.map(d => d.embedding)
    },
  }
}

export function createOpenAIChatProvider(opts: {
  apiKey: string
  model: string
  fetchImpl?: typeof fetch
}): ChatProvider {
  const doFetch = opts.fetchImpl ?? fetch
  return {
    async *stream(messages: ChatMessage[], streamOpts) {
      const res = await doFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts.model, messages, stream: true,
          max_tokens: streamOpts?.maxTokens ?? 600,
        }),
      })
      if (!res.ok || !res.body) throw new Error(`OpenAI chat failed: ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') return
          try {
            const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }
            const delta = json.choices?.[0]?.delta?.content
            if (delta) yield delta
          } catch { /* ligne partielle ignorée */ }
        }
      }
    },
  }
}
