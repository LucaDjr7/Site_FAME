import type { EmbeddingProvider } from './provider'

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
