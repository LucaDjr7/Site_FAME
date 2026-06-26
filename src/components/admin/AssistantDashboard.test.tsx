// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { AssistantDashboard } from './AssistantDashboard'
import en from '../../../messages/en.json'

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ enabled: false }), { status: 200 }))
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockClear() })
afterEach(() => { cleanup() })

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en as never}>{ui}</NextIntlClientProvider>)
}

describe('AssistantDashboard', () => {
  const props = { enabled: true, usage: { month: '2026-06', estCost: 12.5, budget: 50 }, unanswered: [{ question: 'q?', lang: 'en' }] }
  it('affiche le coût et les questions', () => {
    wrap(<AssistantDashboard {...props} />)
    expect(screen.getByText(/12.5/)).toBeTruthy()
    expect(screen.getByText('q?')).toBeTruthy()
  })
  it('le toggle POST vers /api/assistant/toggle', async () => {
    wrap(<AssistantDashboard {...props} />)
    fireEvent.click(screen.getByText('Disable'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/assistant/toggle', expect.objectContaining({ method: 'POST' })))
  })
})
