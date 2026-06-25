// Interfaces fournisseur LLM — swappable par env. P1 : EmbeddingProvider. P2 : ChatProvider.
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: unknown[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ChatCompletion {
  content: string | null
  toolCalls: ToolCall[]
}

export interface ChatProvider {
  stream(messages: ChatMessage[], opts?: { maxTokens?: number }): AsyncIterable<string>
  complete(messages: ChatMessage[], opts?: { tools?: unknown[]; maxTokens?: number }): Promise<ChatCompletion>
}
