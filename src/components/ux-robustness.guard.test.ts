import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(__dirname, '../app')

const src = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('U1 — anti double-submit', () => {
  it('ProposeForm submit button is disabled while saving', () => {
    expect(src('./propose/ProposeForm.tsx')).toContain('disabled={saving}')
  })
  it('CommentsPanel post button is disabled while posting', () => {
    expect(src('./paper/CommentsPanel.tsx')).toContain('disabled={posting}')
  })
})

describe('U2 — loading.tsx skeletons exist', () => {
  it('loading.tsx exists under [locale]/[lab]/', () => {
    const p = resolve(appDir, '[locale]/[lab]/loading.tsx')
    expect(existsSync(p)).toBe(true)
  })
  it('loading.tsx exists under [locale]/[lab]/paper/[id]/', () => {
    const p = resolve(appDir, '[locale]/[lab]/paper/[id]/loading.tsx')
    expect(existsSync(p)).toBe(true)
  })
  it('[locale]/[lab]/loading.tsx uses bg-fame-sand-bg', () => {
    const content = readFileSync(resolve(appDir, '[locale]/[lab]/loading.tsx'), 'utf8')
    expect(content).toContain('bg-fame-sand-bg')
  })
  it('[locale]/[lab]/paper/[id]/loading.tsx uses bg-fame-sand-bg', () => {
    const content = readFileSync(resolve(appDir, '[locale]/[lab]/paper/[id]/loading.tsx'), 'utf8')
    expect(content).toContain('bg-fame-sand-bg')
  })
})

describe('U3 — success toast after visitor comment', () => {
  it('CommentsPanel calls addToast with commentPosted key on success', () => {
    expect(src('./paper/CommentsPanel.tsx')).toContain("addToast(t('commentPosted'), 'success')")
  })
})

describe('U4 — admin comment uses textarea', () => {
  it('CommentsPanel contains a textarea for the comment input', () => {
    expect(src('./paper/CommentsPanel.tsx')).toContain('<textarea')
  })
})

describe('U5 — PaperNav single-subject neutralised', () => {
  it('PaperNav does not use href="#" for arrows', () => {
    expect(src('./paper/PaperNav.tsx')).not.toContain('href="#"')
  })
  it('PaperNav handles single-subject case', () => {
    expect(src('./paper/PaperNav.tsx')).toMatch(/single|subjects\.length\s*<=?\s*1/)
  })
})
