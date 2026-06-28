// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FitText } from './FitText'

// jsdom ne calcule pas de layout (clientHeight = 0) → le fit ne réduit rien ;
// on vérifie le rendu du contenu et l'absence de crash (pas de ResizeObserver requis).
describe('FitText', () => {
  it('rend ses enfants', () => {
    render(<FitText maxPx={20}>Bonjour</FitText>)
    expect(screen.getByText('Bonjour')).toBeTruthy()
  })
  it('rend plusieurs enfants em', () => {
    render(
      <FitText maxPx={21} className="font-serif">
        <span style={{ fontSize: '1em' }}>Titre</span>
        <span style={{ fontSize: '0.55em' }}>Sous-titre</span>
      </FitText>,
    )
    expect(screen.getByText('Titre')).toBeTruthy()
    expect(screen.getByText('Sous-titre')).toBeTruthy()
  })
})
