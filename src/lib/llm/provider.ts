// Interfaces fournisseur LLM — swappable par env. P1 : EmbeddingProvider. P2 : ChatProvider.
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatProvider {
  stream(messages: ChatMessage[], opts?: { maxTokens?: number }): AsyncIterable<string>
}
