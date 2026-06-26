import type { EmbeddingProvider, ChatProvider } from './provider'
import { createOpenAIEmbeddingProvider, createOpenAIChatProvider } from './openai'

export type { EmbeddingProvider } from './provider'
export type { ChatProvider, ChatMessage } from './provider'

const EMBED_DIMENSIONS = 1536

export function getEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  const model = process.env.ASSISTANT_EMBED_MODEL ?? 'text-embedding-3-large'
  return createOpenAIEmbeddingProvider({ apiKey, model, dimensions: EMBED_DIMENSIONS })
}

export function getChatProvider(): ChatProvider {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  const model = process.env.ASSISTANT_MODEL ?? 'gpt-4o-mini'
  return createOpenAIChatProvider({ apiKey, model })
}
