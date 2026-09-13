// src/lib/research/dedup.test.ts
import { describe, it, expect } from 'vitest'
import { computeFingerprint, findDuplicate, type DedupCandidate } from './dedup'

describe('computeFingerprint', () => {
  it('prefers an arXiv id extracted from the url', () => {
    const fp = computeFingerprint({ doi: null, url: 'http://arxiv.org/abs/2401.01234v2', title: 'X' })
    expect(fp).toBe('arxiv:2401.01234')
  })

  it('falls back to the DOI when there is no arXiv id', () => {
    const fp = computeFingerprint({ doi: '10.1/ABC', url: 'https://journal.example/x', title: 'X' })
    expect(fp).toBe('doi:10.1/abc')
  })

  it('falls back to a normalized-title hash when neither is present', () => {
    const a = computeFingerprint({ doi: null, url: 'https://x.example/a', title: 'Deep Learning, for Trading!' })
    const b = computeFingerprint({ doi: null, url: 'https://x.example/b', title: 'deep learning for trading' })
    expect(a).toBe(b) // punctuation/case-insensitive normalization
    expect(a).toMatch(/^title:/)
  })
})

describe('findDuplicate', () => {
  const candidates: DedupCandidate[] = [
    { id: '1', fingerprint: 'arxiv:2401.01234', title: 'Deep learning for algorithmic trading in equity markets' },
    { id: '2', fingerprint: 'doi:10.1/xyz', title: 'A survey of reinforcement learning in finance' },
  ]

  it('matches on exact fingerprint', () => {
    const match = findDuplicate({ fingerprint: 'doi:10.1/xyz', title: 'anything' }, candidates)
    expect(match?.id).toBe('2')
  })

  it('matches on fuzzy title (preprint vs. published-version rewording)', () => {
    // Singular/plural rewording of the trailing noun, as commonly happens
    // between a preprint's title and its published-version title.
    // Fuse.js score observed: 0.087 (well under the 0.15 threshold).
    const match = findDuplicate(
      { fingerprint: 'title:some-other-hash', title: 'Deep learning for algorithmic trading in equity market' },
      candidates
    )
    expect(match?.id).toBe('1')
  })

  it('returns null when nothing matches closely enough', () => {
    const match = findDuplicate(
      { fingerprint: 'title:unrelated-hash', title: 'A totally unrelated paper about medieval trade' },
      candidates
    )
    expect(match).toBeNull()
  })
})
