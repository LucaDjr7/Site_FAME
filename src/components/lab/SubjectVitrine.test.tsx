// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SubjectVitrine } from './SubjectVitrine'
import type { Subject } from '@/types'

afterEach(cleanup)

const subject = {
  id: '1', labo: 'paris', titre: 'T', kicker: 'AI', question: 'Q?',
  accroche: 'Une accroche qui doit rester entièrement visible', periode: '2025',
  statut: 'active', context: '', method: '', results: '',
  keywords: ['alpha', 'beta', 'gamma', 'delta'], auteurs: [], difficulte: 'easy',
  dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 1,
  is_transversal: false, confidentiel: false, i18n: {}, created_at: '', updated_at: '',
} as unknown as Subject

describe('SubjectVitrine card', () => {
  it("n'affiche PAS les mots-clés sur la carte", () => {
    render(
      <SubjectVitrine subject={subject} locale="en" members={[]} editMode={false}
        statusLabel="Active" doneLabel="Done" ficheLabel="Sheet" questionLabel="Question" readLabel="Read" />)
    expect(screen.queryByText('alpha')).toBeNull()
    expect(screen.queryByText('delta')).toBeNull()
  })

  it("affiche l'accroche en entier", () => {
    render(
      <SubjectVitrine subject={subject} locale="en" members={[]} editMode={false}
        statusLabel="Active" doneLabel="Done" ficheLabel="Sheet" questionLabel="Question" readLabel="Read" />)
    expect(screen.getByText('Une accroche qui doit rester entièrement visible')).toBeTruthy()
  })
})
