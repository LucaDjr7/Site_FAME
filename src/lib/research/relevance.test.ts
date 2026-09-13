import { describe, it, expect } from 'vitest'
import { passesRelevanceGate } from './relevance'

describe('passesRelevanceGate', () => {
  it('passes when title+abstract match at least one AI term and one finance term', () => {
    expect(passesRelevanceGate(
      'Deep learning for equity return prediction',
      'We apply a neural network to forecast stock returns.'
    )).toBe(true)
  })

  it('rejects an AI paper with no finance term', () => {
    expect(passesRelevanceGate(
      'A neural network for image segmentation',
      'We propose a convolutional architecture for medical imaging.'
    )).toBe(false)
  })

  it('rejects a finance paper with no AI term', () => {
    expect(passesRelevanceGate(
      'A survey of portfolio theory',
      'We review classical mean-variance optimization for equity portfolios.'
    )).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(passesRelevanceGate('LARGE LANGUAGE MODEL FOR TRADING', 'GPT-based ALPHA generation.')).toBe(true)
  })
})
