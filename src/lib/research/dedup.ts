// src/lib/research/dedup.ts
// Two-stage dedup, same principle as ArdiaD/fame: strong identifier first
// (arXiv id / DOI), then fuzzy title match (Fuse.js threshold 0.15 ≈ 92%
// similarity — same threshold Papyrus validated for preprint↔published pairs).
import Fuse from 'fuse.js'
import { createHash } from 'crypto'

export interface DedupCandidate {
  id: string
  fingerprint: string
  title: string
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function computeFingerprint(input: { doi: string | null; url: string; title: string }): string {
  const arxivMatch = input.url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i)
  if (arxivMatch) return `arxiv:${arxivMatch[1]}`
  if (input.doi) return `doi:${input.doi.toLowerCase()}`
  const hash = createHash('sha256').update(normalizeTitle(input.title)).digest('hex').slice(0, 16)
  return `title:${hash}`
}

export function findDuplicate(
  paper: { fingerprint: string; title: string },
  candidates: DedupCandidate[]
): DedupCandidate | null {
  const exact = candidates.find((c) => c.fingerprint === paper.fingerprint)
  if (exact) return exact

  if (candidates.length === 0) return null
  const fuse = new Fuse(candidates, { keys: ['title'], threshold: 0.15, includeScore: true })
  const best = fuse.search(paper.title)[0]
  if (!best || best.score === undefined || best.score > 0.15) return null
  return best.item
}
