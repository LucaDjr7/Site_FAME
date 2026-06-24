import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
}

describe('garde-fous de régression Vague 1', () => {
  it('globals.css définit les keyframes du globe (F10)', () => {
    const css = read('./app/globals.css')
    expect(css).toMatch(/@keyframes\s+fameSpin\b/)
    expect(css).toMatch(/@keyframes\s+fameSpinRev\b/)
  })
  it('FilterSidebar est un composant client (F04)', () => {
    const src = read('./components/lab/FilterSidebar.tsx')
    expect(src.trimStart().startsWith("'use client'")).toBe(true)
  })
})
