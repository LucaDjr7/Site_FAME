import { describe, it, expect } from 'vitest'
import en from '../../../messages/en.json'
import fr from '../../../messages/fr.json'

const sub = (m: Record<string, unknown>) => (m.privacy as Record<string, Record<string, string>>).assistant!

describe('privacy.assistant parity', () => {
  it('en a la section assistant', () => {
    for (const k of ['heading', 'body', 'provider', 'retention']) expect(sub(en as never)).toHaveProperty(k)
  })
  it('fr reflète en', () => {
    expect(Object.keys(sub(fr as never)).sort()).toEqual(Object.keys(sub(en as never)).sort())
  })
})
