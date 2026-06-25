import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('./Modal.tsx', import.meta.url), 'utf8')
describe('Modal a11y (garde structurelle)', () => {
  it('porte role=dialog + aria-modal', () => { expect(src).toContain('role="dialog"'); expect(src).toContain('aria-modal="true"') })
  it('le × a un aria-label i18n', () => expect(src).toMatch(/aria-label=\{t\('close'\)\}/))
  it('restitue le focus au trigger', () => expect(src).toContain('triggerRef'))
})
