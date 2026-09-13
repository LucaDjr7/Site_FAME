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

  // The documented exception to "manual_override rows are never touched by the
  // weekly job" (see the NOTE in retention.ts and spec § Rétention): a hidden
  // row is manual_override = true by construction — only an admin can hide a
  // paper — so filtering it out would make the strip a no-op in every real case.
  // The admin's decision is preserved (status stays hidden, row never deleted);
  // only abstract + embedding are reclaimed.
  it('strips an old hidden row even when manual_override is true, without filtering on it', async () => {
    const updateFilters: [string, unknown][] = []
    const deleteCall = vi.fn(() => ({ eq: () => ({ lt: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }) }))
    const updateCall = vi.fn(() => ({
      eq: (col: string, value: unknown) => {
        updateFilters.push([col, value])
        return {
          lt: (col2: string, value2: unknown) => {
            updateFilters.push([col2, value2])
            return {
              select: () => Promise.resolve({
                data: [{ id: 'h1', status: 'hidden', manual_override: true }],
                error: null,
              }),
            }
          },
        }
      },
    }))
    const service = { from: () => ({ delete: deleteCall, update: updateCall }) }

    const result = await runRetention({ service: service as never })

    expect(updateCall).toHaveBeenCalledWith({ abstract: null, embedding: null })
    // Exactly two filters: status + age. No `manual_override` filter — a
    // manual_override row past the cutoff is in scope on purpose.
    expect(updateFilters.map(([col]) => col)).toEqual(['status', 'updated_at'])
    expect(updateFilters[0]).toEqual(['status', 'hidden'])
    expect(result.strippedHidden).toBe(1)
  })
})
