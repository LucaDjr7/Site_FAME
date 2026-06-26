// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { EditMemberModal } from './EditMemberModal'
import en from '../../../messages/en.json'
import type { Member } from '@/types'

const memberSansEmail: Member = {
  id: 'm1',
  prenom: 'Ada',
  nom: 'Lovelace',
  role: 'researcher',
  labo: 'paris',
  domaines: ['math'],
  photo_url: null,
  is_admin: false,
  activated_at: null,
  created_at: '2024-01-01',
  // email intentionally omitted (public projection)
} as unknown as Member

const enrichedMember = { ...memberSansEmail, email: 'ada@fame.org' }

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response(JSON.stringify(enrichedMember), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup() })

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>
  )
}

const noop = () => {}

describe('EditMemberModal — enrichissement email admin', () => {
  it("quand admin ouvre la modale, fetch GET /api/members/{id} et affiche l'email", async () => {
    wrap(
      <EditMemberModal
        open={true}
        member={memberSansEmail}
        isAdmin={true}
        onClose={noop}
        onSaved={noop}
      />
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/members/m1'))
    await waitFor(() => {
      const input = screen.getByDisplayValue('ada@fame.org')
      expect(input).toBeTruthy()
    })
  })

  it('quand non-admin, NE fetch PAS /api/members/{id}', async () => {
    wrap(
      <EditMemberModal
        open={true}
        member={memberSansEmail}
        isAdmin={false}
        onClose={noop}
        onSaved={noop}
      />
    )

    // Wait a tick to confirm no fetch happened
    await new Promise(r => setTimeout(r, 50))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
