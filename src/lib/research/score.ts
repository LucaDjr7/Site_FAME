// FAME relevance score: cosine similarity between a paper's title+abstract and
// a reference description of the FAME project's research scope, normalized to
// 0-100%. Reuses the embedding provider already wired for the Astra assistant
// RAG (src/lib/llm) — no new API key.
import { getEmbeddingProvider, type EmbeddingProvider } from '@/lib/llm'

export const FAME_THRESHOLD = Number(process.env.RESEARCH_FAME_THRESHOLD ?? 50)
const SIM_LO = Number(process.env.RESEARCH_SIM_LO ?? 0.32)
const SIM_HI = Number(process.env.RESEARCH_SIM_HI ?? 0.72)

const FAME_REFERENCE_SUMMARY = `
  The FAME project (Financial Artificial Machine Intelligence, Paris Dauphine – PSL
  and HEC Montreal) studies generative AI and large language models for investing,
  trading, and market supervision. Research topics include LLM-based analysis of
  financial news, disclosures and earnings calls for trading signals; reinforcement
  learning for portfolio allocation and execution; deep learning and factor models
  for stock return and volatility forecasting; natural language processing of
  financial text; machine learning applied to derivatives pricing and hedging;
  and AI methods for cryptocurrency and digital asset markets.
`

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0)
    normA += (a[i] ?? 0) ** 2
    normB += (b[i] ?? 0) ** 2
  }
  if (normA === 0 || normB === 0) return 0
  const result = dot / (Math.sqrt(normA) * Math.sqrt(normB))
  return Number.isFinite(result) ? result : 0
}

export function normalizeToPercent(cosine: number): number {
  const norm = (cosine - SIM_LO) / (SIM_HI - SIM_LO)
  return Math.round(Math.max(0, Math.min(1, norm)) * 100)
}

let cachedReferenceVector: Promise<number[]> | null = null

function getReferenceVector(provider: EmbeddingProvider): Promise<number[]> {
  if (!cachedReferenceVector) {
    cachedReferenceVector = provider.embed([FAME_REFERENCE_SUMMARY]).then((v) => v[0]!)
  }
  return cachedReferenceVector
}

export async function scoreBatch(
  papers: { title: string; abstract: string }[],
  deps: { provider?: EmbeddingProvider } = {}
): Promise<number[]> {
  const provider = deps.provider ?? getEmbeddingProvider()
  const refVector = await getReferenceVector(provider)
  const texts = papers.map((p) => `${p.title}. ${p.abstract.slice(0, 2000)}`)
  const embeddings = await provider.embed(texts)
  return embeddings.map((e) => normalizeToPercent(computeCosineSimilarity(e, refVector)))
}
