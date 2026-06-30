// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { PaperSheet } from './PaperSheet'
import en from '../../../messages/en.json'
import type { Subject } from '@/types'

const subject = {
  id: '1', labo: 'paris', titre: 'T', kicker: 'AI', question: 'Q?', accroche: 'A hook', periode: '2025',
  statut: 'active', context: 'Some context', method: '', results: '',
  keywords: ['a'], auteurs: [], difficulte: 'easy',
  dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 1,
  is_transversal: false, confidentiel: false, i18n: {}, inherits: {},
  created_at: '2025-01-01', updated_at: '',
} as unknown as Subject

function wrap() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PaperSheet subject={subject} members={[]} labName="Paris" locale="en" byId={new Map()} />
    </NextIntlClientProvider>)
}

describe('PaperSheet layout', () => {
  it('élargit la fiche (clamp max 880px)', () => {
    const { container } = wrap()
    const article = container.querySelector('article') as HTMLElement
    expect(article.style.width).toContain('880px')
  })
  it('ne rend plus le placeholder figure greeké', () => {
    const { container } = wrap()
    // L'ancien placeholder utilisait un fond repeating-linear-gradient strié + caption.
    const greeked = Array.from(container.querySelectorAll('div')).find(d => d.style.background.includes('repeating-linear-gradient'))
    expect(greeked).toBeUndefined()
  })
})
