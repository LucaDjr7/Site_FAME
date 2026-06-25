import { describe, it, expect, vi } from 'vitest'
import { moderateInput } from './moderation'

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch
}

describe('moderateInput', () => {
  it('flagged=true remonté', async () => {
    const out = await moderateInput('bad', { apiKey: 'sk', fetchImpl: fakeFetch({ results: [{ flagged: true, categories: { hate: true, violence: false } }] }) })
    expect(out.flagged).toBe(true)
    expect(out.categories).toContain('hate')
  })
  it('flagged=false', async () => {
    const out = await moderateInput('hi', { apiKey: 'sk', fetchImpl: fakeFetch({ results: [{ flagged: false, categories: {} }] }) })
    expect(out.flagged).toBe(false)
  })
  it('erreur réseau → fail-open (flagged=false)', async () => {
    const out = await moderateInput('hi', { apiKey: 'sk', fetchImpl: fakeFetch({}, 500) })
    expect(out.flagged).toBe(false)
  })
})
