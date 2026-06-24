import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escape-html'

describe('escapeHtml', () => {
  it('échappe les caractères HTML dangereux', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
  })
  it('échappe guillemets et esperluette', () => {
    expect(escapeHtml(`Tom & "Jerry" <'x'>`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;&#39;x&#39;&gt;'
    )
  })
  it('laisse un texte sans caractère spécial intact', () => {
    expect(escapeHtml('Éric Dupont')).toBe('Éric Dupont')
  })
})
