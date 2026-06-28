// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { SourceCitations } from './SourceCitations'
import en from '../../../messages/en.json'

afterEach(() => { cleanup() })

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>)
}

describe('SourceCitations', () => {
  it('lien vers la fiche pour un sujet', () => {
    wrap(<SourceCitations locale="en" lab="paris" sources={[{ source_type: 'subject', source_id: 's1', labo: 'paris' }]} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/en/paris/paper/s1')
  })
  it('ne rend rien si vide', () => {
    const { container } = wrap(<SourceCitations locale="en" sources={[]} />)
    expect(container.textContent).toBe('')
  })
  it('lie un document au sujet parent avec le nom de fichier', () => {
    wrap(<SourceCitations sources={[{ source_type: 'subject_file', source_id: 'f1', labo: 'paris', subject_id: 's1', file_name: 'rapport.pdf' }]} locale="fr" lab="paris" />)
    const link = screen.getByText('rapport.pdf').closest('a')
    expect(link?.getAttribute('href')).toBe('/fr/paris/paper/s1')
  })
})
