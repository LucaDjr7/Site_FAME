// Coarse AND-gate: a paper only enters the pipeline if it mentions at least one
// AI term AND one finance term. Cheap pre-filter, run before spending an
// embedding call (Task 10) — ported from ArdiaD/fame's config.yaml term lists.

const AI_TERMS = [
  'machine learning', 'deep learning', 'neural network', 'reinforcement learning',
  'large language model', 'llm', 'transformer', 'natural language processing', 'nlp',
  'artificial intelligence', 'generative', 'gpt', 'embedding', 'gradient boosting',
  'random forest', 'graph neural',
]

const FINANCE_TERMS = [
  'trading', 'investment', 'portfolio', 'asset pricing', 'stock return', 'equity',
  'market', 'alpha', 'factor', 'volatility', 'risk', 'hedge', 'derivative',
  'cryptocurrency', 'forecasting return', 'backtest', 'order book', 'execution',
]

export function passesRelevanceGate(title: string, abstract: string): boolean {
  const text = `${title} ${abstract}`.toLowerCase()
  const hasAiTerm = AI_TERMS.some((t) => text.includes(t))
  const hasFinanceTerm = FINANCE_TERMS.some((t) => text.includes(t))
  return hasAiTerm && hasFinanceTerm
}
