import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8')

describe('A3 — TaskCard keyboard-accessible', () => {
  const src = read('./tasks/TaskCard.tsx')
  it('uses <button> or role="button" instead of bare div onClick', () => {
    // Either a semantic <button or role="button" with tabIndex and onKeyDown
    const hasButton = src.includes('<button') || src.includes('role="button"')
    expect(hasButton).toBe(true)
  })
  it('has onKeyDown handler', () => {
    // Converted to <button> — keyboard activation is native, no need for explicit onKeyDown.
    // Either a button element (native keyboard) or explicit onKeyDown is acceptable.
    const hasNativeButton = src.includes('<button')
    const hasKeyDown = src.includes('onKeyDown')
    expect(hasNativeButton || hasKeyDown).toBe(true)
  })
})

describe('A4 — DataExplorer tree ARIA', () => {
  const src = read('./data/DataExplorer.tsx')
  it('tree container has role="tree"', () => {
    expect(src).toContain('role="tree"')
  })
  it('tree nodes have role="treeitem"', () => {
    expect(src).toContain('role="treeitem"')
  })
  it('tree nodes have aria-expanded', () => {
    expect(src).toContain('aria-expanded')
  })
  it('tree nodes have onKeyDown for Enter/Space', () => {
    expect(src).toContain('onKeyDown')
  })
})

describe('A5 + F-HC-03 — Globe aria-label i18n (no hardcoded English)', () => {
  const src = read('./globe/Globe.tsx')
  it('canvas has aria-label from tHome("globeLabel")', () => {
    expect(src).toMatch(/aria-label=\{tHome\('globeLabel'\)\}/)
  })
  it('svg overlay div no longer has hardcoded aria-label="Lab locations"', () => {
    expect(src).not.toContain('aria-label="Lab locations"')
  })
  it('svg overlay div uses tHome("globeLabel") instead', () => {
    // Both canvas and overlay use the same i18n key
    const matches = (src.match(/tHome\('globeLabel'\)/g) ?? []).length
    expect(matches).toBeGreaterThanOrEqual(2)
  })
})

describe('A8 — NavMenu aria-controls + aria-expanded', () => {
  const src = read('./layout/NavMenu.tsx')
  it('menu toggle has aria-expanded', () => {
    expect(src).toContain('aria-expanded')
  })
  it('menu toggle has aria-controls', () => {
    expect(src).toContain('aria-controls')
  })
  it('menu container has matching id', () => {
    expect(src).toContain('id="nav-menu"')
  })
})

describe('A9 — subtask delete × has aria-label', () => {
  const src = read('./tasks/AddTaskModal.tsx')
  it('subtask delete button has aria-label', () => {
    expect(src).toMatch(/aria-label=\{t\(/)
  })
})

describe('A12 — LanguageSwitcher lang attribute', () => {
  const src = read('./layout/LanguageSwitcher.tsx')
  it('language buttons have lang attribute', () => {
    expect(src).toContain('lang={l}')
  })
})
