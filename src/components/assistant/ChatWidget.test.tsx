// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { ChatWidget } from './ChatWidget'
import en from '../../../messages/en.json'

vi.mock('next/navigation', () => ({ usePathname: () => '/en/paris' }))

afterEach(() => cleanup())
function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>)
}

describe('ChatWidget', () => {
  it('ouvre le panneau au clic sur la bulle', () => {
    wrap(<ChatWidget locale="en" isMember={false} />)
    fireEvent.click(screen.getByLabelText('Ask Astra'))
    expect(screen.getByPlaceholderText("Ask about FAME's research…")).toBeTruthy()
  })
  it('greeting visiteur par défaut', () => {
    wrap(<ChatWidget locale="en" isMember={false} />)
    fireEvent.click(screen.getByLabelText('Ask Astra'))
    expect(screen.getByText(/How can I help/)).toBeTruthy()
  })
})
