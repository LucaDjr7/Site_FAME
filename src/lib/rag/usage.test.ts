import { describe, it, expect } from 'vitest'
import { isOverBudget } from './usage'

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
