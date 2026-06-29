// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AssistButton } from './AssistButton'

afterEach(() => cleanup())

const labels = { generate: 'Generate', generating: 'Generating…', viewPrompt: 'view prompt', hidePrompt: 'hide', copyPrompt: 'Copy' }

describe('AssistButton', () => {
  it('déclenche onGenerate et affiche le prompt', () => {
    const onGenerate = vi.fn(); const onToggle = vi.fn()
    const { rerender } = render(
      <AssistButton generating={false} busy={false} displayPrompt="P" showingPrompt={false} labels={labels} onGenerate={onGenerate} onTogglePrompt={onToggle} />)
    fireEvent.click(screen.getByText(/Generate/))
    expect(onGenerate).toHaveBeenCalled()
    fireEvent.click(screen.getByText('view prompt'))
    expect(onToggle).toHaveBeenCalled()
    rerender(<AssistButton generating={false} busy={false} displayPrompt="P" showingPrompt={true} labels={labels} onGenerate={onGenerate} onTogglePrompt={onToggle} />)
    expect(screen.getByText('P')).toBeTruthy()
  })
})
