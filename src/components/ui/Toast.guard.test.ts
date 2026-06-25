import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('./Toast.tsx', import.meta.url), 'utf8')
describe('Toast a11y (garde structurelle)', () => {
  it('le conteneur porte aria-live="polite"', () => expect(src).toContain('aria-live="polite"'))
  it('le conteneur porte role="status"', () => expect(src).toContain('role="status"'))
  it('le conteneur porte aria-atomic="true"', () => expect(src).toContain('aria-atomic="true"'))
})
