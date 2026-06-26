// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { ChatComposer } from './ChatComposer'
import en from '../../../messages/en.json'

afterEach(() => cleanup())
function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>)
}

describe('ChatComposer', () => {
  it('Entrée envoie le texte et vide le champ', () => {
    const onSend = vi.fn()
    wrap(<ChatComposer onSend={onSend} />)
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hello' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('hello')
    expect(ta.value).toBe('')
  })
  it("Shift+Entrée n'envoie pas", () => {
    const onSend = vi.fn()
    wrap(<ChatComposer onSend={onSend} />)
    const ta = screen.getByRole('textbox')
    fireEvent.change(ta, { target: { value: 'x' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })
})
