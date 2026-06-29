// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubjectVitrine } from './SubjectVitrine'
import type { Subject } from '@/types'

const subject = {
  id: '1', labo: 'paris', titre: 'T', kicker: 'AI', question: 'Q?', accroche: 'A', periode: '2025',
  statut: 'active', context: '', method: '', results: '',
  keywords: ['alpha', 'beta', 'gamma', 'delta'], auteurs: [], difficulte: 'easy',
  dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 1,
  is_transversal: false, confidentiel: false, i18n: {}, created_at: '', updated_at: '',
} as unknown as Subject

describe('SubjectVitrine keywords', () => {
  it('affiche plusieurs mots-clés sans conteneur tronqué (pas de maxHeight 24)', () => {
    render(
      <SubjectVitrine subject={subject} locale="en" members={[]} editMode={false}
        statusLabel="Active" doneLabel="Done" ficheLabel="Sheet" questionLabel="Question" readLabel="Read" />)
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('delta')).toBeTruthy()
    // Le conteneur des mots-clés ne doit plus imposer une hauteur d'une ligne.
    const kw = screen.getByText('alpha').parentElement as HTMLElement
    expect(kw.style.maxHeight).toBe('')
    expect(kw.style.overflow).not.toBe('hidden')
  })
})
