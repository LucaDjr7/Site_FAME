import { describe, it, expect, vi } from 'vitest'
import { apiFetch } from './api-fetch'

describe('apiFetch', () => {
  it('retourne les données quand ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) })))
    const onError = vi.fn()
    expect(await apiFetch<{ a: number }>('/x', {}, onError, 'err')).toEqual({ a: 1 })
    expect(onError).not.toHaveBeenCalled()
  })
  it('appelle onError et retourne null quand !ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    const onError = vi.fn()
    expect(await apiFetch('/x', {}, onError, 'boom')).toBeNull()
    expect(onError).toHaveBeenCalledWith('boom')
  })
})
