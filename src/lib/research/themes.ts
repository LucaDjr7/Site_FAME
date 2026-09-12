// Theme taxonomy for auto-tagging + filter chips on the public research page.

export interface ThemeDefinition {
  readonly name: string
  readonly keywords: readonly string[]
}

export const THEMES: readonly ThemeDefinition[] = [
  { name: 'LLMs', keywords: ['large language model', 'llm', 'gpt', 'chatgpt', 'foundation model', 'instruction tuning', 'prompt engineering'] },
  { name: 'RL', keywords: ['reinforcement learning', 'reward function', 'policy gradient', 'q-learning', 'actor-critic', 'multi-armed bandit'] },
  { name: 'NLP', keywords: ['natural language processing', 'nlp', 'text classification', 'sentiment analysis', 'information extraction', 'text mining'] },
  { name: 'Portfolio', keywords: ['portfolio', 'asset allocation', 'mean-variance', 'markowitz', 'diversification', 'rebalancing', 'risk parity'] },
  { name: 'Factor Investing', keywords: ['factor investing', 'factor model', 'fama-french', 'momentum', 'value factor', 'quality factor', 'smart beta'] },
  { name: 'Volatility', keywords: ['volatility', 'implied volatility', 'garch', 'realized volatility', 'vix', 'stochastic volatility'] },
  { name: 'Trading', keywords: ['trading strategy', 'algorithmic trading', 'high frequency', 'market microstructure', 'order book', 'trade signal'] },
  { name: 'Crypto', keywords: ['cryptocurrency', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'decentralized finance', 'crypto'] },
  { name: 'Derivatives', keywords: ['derivatives', 'options', 'futures', 'swaps', 'hedging', 'black-scholes', 'delta hedging'] },
  { name: 'Macro', keywords: ['macroeconomics', 'gdp', 'inflation', 'monetary policy', 'central bank', 'interest rate', 'yield curve'] },
  { name: 'Deep Learning', keywords: ['deep learning', 'neural network', 'convolutional', 'lstm', 'attention mechanism', 'autoencoder', 'generative adversarial'] },
  { name: 'Return Forecasting', keywords: ['return forecasting', 'stock return', 'price prediction', 'excess return', 'cross-sectional', 'predictability'] },
] as const

export const THEME_NAMES: string[] = THEMES.map((t) => t.name)

export function tagThemes(title: string, abstract: string): string[] {
  const text = `${title} ${abstract}`.toLowerCase()
  return THEMES.filter((t) => t.keywords.some((kw) => text.includes(kw))).map((t) => t.name)
}
