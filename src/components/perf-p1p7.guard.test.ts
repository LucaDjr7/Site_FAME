import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(fileURLToPath(import.meta.url), '../../..')

const globals   = readFileSync(path.join(root, 'src/app/globals.css'), 'utf8')
const paperView = readFileSync(path.join(root, 'src/components/paper/PaperView.tsx'), 'utf8')

describe('P4 — drift keyframes moved to globals.css', () => {
  it('globals.css contains @keyframes drift1', () =>
    expect(globals).toContain('@keyframes drift1'))
  it('globals.css contains @keyframes drift2', () =>
    expect(globals).toContain('@keyframes drift2'))
  it('globals.css contains @keyframes drift3', () =>
    expect(globals).toContain('@keyframes drift3'))
  it('globals.css contains @keyframes drift4', () =>
    expect(globals).toContain('@keyframes drift4'))
  it('PaperView.tsx no longer contains @keyframes drift', () =>
    expect(paperView).not.toContain('@keyframes drift'))
})

describe('P5 — prefers-reduced-motion in globals.css', () => {
  it('globals.css contains prefers-reduced-motion', () =>
    expect(globals).toContain('prefers-reduced-motion'))
  it('globals.css disables fameSpin under reduced-motion', () =>
    expect(globals).toMatch(/prefers-reduced-motion[\s\S]*?fameSpin/))
})

describe('Config — @config still present in globals.css', () => {
  it('globals.css still contains @config directive', () =>
    expect(globals).toContain('@config "../../tailwind.config.ts"'))
})
