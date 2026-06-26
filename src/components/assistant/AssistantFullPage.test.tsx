// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { AssistantFullPage } from './AssistantFullPage'
import en from '../../../messages/en.json'

afterEach(() => cleanup())
function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>)
}

describe('AssistantFullPage', () => {
  it('affiche l\'accueil et les suggestions quand vide', () => {
    wrap(<AssistantFullPage locale="en" />)
    expect(screen.getByText("Hi, I'm Astra.")).toBeTruthy()           // welcomeTitle
    expect(screen.getByText(/What subjects are underway/)).toBeTruthy() // suggestion1
  })
  it('a une zone de saisie', () => {
    wrap(<AssistantFullPage locale="en" />)
    expect(screen.getByPlaceholderText("Ask about FAME's research…")).toBeTruthy()
  })
})
