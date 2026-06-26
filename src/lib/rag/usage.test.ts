import { describe, it, expect, vi } from 'vitest'
import { isOverBudget, recordUsage } from './usage'

function service(cost: number) {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { est_cost_usd: cost }, error: null }) }) }) }) }
}

describe('isOverBudget', () => {
  it('true au-delà du plafond', async () => {
    expect(await isOverBudget({ service: service(60) as never, budget: 50 })).toBe(true)
  })
  it('false sous le plafond', async () => {
    expect(await isOverBudget({ service: service(12) as never, budget: 50 })).toBe(false)
  })
})

describe('recordUsage', () => {
  it('accumule correctement et traite est_cost_usd comme nombre (pas concaténation string)', async () => {
    // Simule le driver Postgres qui renvoie les numériques sous forme de string
    const existingRow = { tokens_in: 100, tokens_out: 50, est_cost_usd: '0.10' }
    const upsertSpy = vi.fn().mockResolvedValue({ error: null })
    const svc = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingRow, error: null }) }) }),
        upsert: upsertSpy,
      }),
    }

    const tokensIn = 200
    const tokensOut = 100
    const now = Date.now()
    await recordUsage(tokensIn, tokensOut, { service: svc as never, now })

    expect(upsertSpy).toHaveBeenCalledTimes(1)
    const call = upsertSpy.mock.calls[0]!
    const payload = call[0] as Record<string, unknown>
    const options = call[1] as Record<string, unknown>

    // Les tokens s'accumulent
    expect(payload.tokens_in).toBe(100 + tokensIn)
    expect(payload.tokens_out).toBe(50 + tokensOut)

    // est_cost_usd doit être un nombre, pas une string concaténée
    const computedCost = (tokensIn / 1e6) * 0.15 + (tokensOut / 1e6) * 0.60
    const expectedCost = Number('0.10') + computedCost
    expect(typeof payload.est_cost_usd).toBe('number')
    expect(payload.est_cost_usd).toBeCloseTo(expectedCost, 10)

    // onConflict doit être 'month'
    expect(options).toMatchObject({ onConflict: 'month' })
  })
})
