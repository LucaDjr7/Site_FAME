// Interface fournisseur LLM — swappable par env. P1 : embeddings uniquement.
// (ChatProvider sera ajouté en P2.)
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
