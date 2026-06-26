import { describe, it, expect } from 'vitest'
import { parseKbFile } from './kb'

const RAW = `---
lang: en
labo:
---
# About FAME

Intro paragraph.

## Mission

FAME studies macro questions.

## Team

Two labs: Paris and Montreal.
`

describe('parseKbFile', () => {
  it('lit le frontmatter lang/labo', () => {
    const doc = parseKbFile('about-fame', RAW)
    expect(doc.lang).toBe('en')
    expect(doc.labo).toBeNull()
    expect(doc.slug).toBe('about-fame')
  })
  it('découpe par sections ## (au moins une par titre)', () => {
    const doc = parseKbFile('about-fame', RAW)
    expect(doc.chunks.length).toBeGreaterThanOrEqual(2)
    expect(doc.chunks.some(c => c.content.includes('Mission'))).toBe(true)
    expect(doc.chunks.some(c => c.content.includes('Two labs'))).toBe(true)
  })
})
