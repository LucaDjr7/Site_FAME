// src/lib/research/retention.test.ts
import { describe, it, expect, vi } from 'vitest'
import { runRetention } from './retention'

describe('runRetention', () => {
  it('deletes rejected rows older than 90 days and strips (never deletes) old hidden rows', async () => {
    const deleteCall = vi.fn(() => ({ eq: () => ({ lt: () => ({ select: () => Promise.resolve({ data: [{ id: 'r1' }, { id: 'r2' }], error: null }) }) }) }))
    const updateCall = vi.fn(() => ({ eq: () => ({ lt: () => ({ select: () => Promise.resolve({ data: [{ id: 'h1' }], error: null }) }) }) }))
    const service = {
      from: (table: string) => {
        expect(table).toBe('research_papers')
        return { delete: deleteCall, update: updateCall }
      },
    }

    const result = await runRetention({ service: service as never })

    expect(deleteCall).toHaveBeenCalled()
    expect(updateCall).toHaveBeenCalledWith(expect.objectContaining({ abstract: null, embedding: null }))
    expect(result).toEqual({ deletedRejected: 2, strippedHidden: 1 })
  })
})
