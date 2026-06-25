// Interface fournisseur LLM — swappable par env. P1 : embeddings uniquement.
// (ChatProvider sera ajouté en P2.)
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}
