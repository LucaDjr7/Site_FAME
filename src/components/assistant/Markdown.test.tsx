// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('rend le gras', () => {
    const { container } = render(<Markdown text="Voici **important** ok" />)
    expect(container.querySelector('strong')?.textContent).toBe('important')
  })
  it('rend un lien externe sécurisé', () => {
    render(<Markdown text="see [FAME](https://fame.org)" />)
    const a = screen.getByText('FAME') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('https://fame.org')
    expect(a.getAttribute('rel')).toContain('noopener')
  })
  it('laisse un marqueur non fermé en littéral (streaming)', () => {
    const { container } = render(<Markdown text="partial **bold" />)
    expect(container.querySelector('strong')).toBeNull()
    expect(container.textContent).toContain('**bold')
  })
  it('rend une liste à puces', () => {
    const { container } = render(<Markdown text={'- un\n- deux'} />)
    expect(container.querySelectorAll('li').length).toBe(2)
  })
})
