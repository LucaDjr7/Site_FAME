import { describe, it, expect, vi } from 'vitest'
import { computeCosineSimilarity, normalizeToPercent, scoreBatch } from './score'
import type { EmbeddingProvider } from '@/lib/llm'

describe('computeCosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(computeCosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
  })
  it('is 0 for orthogonal vectors', () => {
    expect(computeCosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })
  it('is 0 when a vector is all zeros (guards div-by-zero)', () => {
    expect(computeCosineSimilarity([0, 0], [1, 1])).toBe(0)
  })
})

describe('normalizeToPercent', () => {
  it('clamps below SIM_LO to 0', () => {
    expect(normalizeToPercent(0.1)).toBe(0)
  })
  it('clamps above SIM_HI to 100', () => {
    expect(normalizeToPercent(0.9)).toBe(100)
  })
  it('maps the midpoint to 50', () => {
    expect(normalizeToPercent(0.52)).toBe(50) // (0.52-0.32)/(0.72-0.32) = 0.5
  })
})

describe('scoreBatch', () => {
  it('embeds title+abstract for each paper and scores against the FAME reference vector', async () => {
    const fakeProvider: EmbeddingProvider = {
      embed: vi.fn(async (texts: string[]) => texts.map(() => [1, 0])), // pretend everything matches perfectly
    }
    const scores = await scoreBatch(
      [{ title: 'A', abstract: 'a' }, { title: 'B', abstract: 'b' }],
      { provider: fakeProvider }
    )
    expect(scores).toHaveLength(2)
    expect(scores.every((s) => s === 100)).toBe(true)
    // one call for the reference vector + one batched call for the two papers
    expect((fakeProvider.embed as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
  })
})
