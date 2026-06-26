import { createServiceClient } from '@/lib/supabase/server'
type SupabaseLike = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

// Tarifs OpenAI (USD / 1M tokens) — étage mini. Ajustables ; source unique de vérité ici.
const PRICE_IN_PER_M = 0.15
const PRICE_OUT_PER_M = 0.60

function currentMonth(now = Date.now()): string {
  const d = new Date(now)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function recordUsage(tokensIn: number, tokensOut: number, deps: { service?: SupabaseLike; now?: number } = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const month = currentMonth(deps.now)
  const cost = (tokensIn / 1e6) * PRICE_IN_PER_M + (tokensOut / 1e6) * PRICE_OUT_PER_M
  const { data } = await service.from('chat_usage').select('*').eq('month', month).maybeSingle()
  const prev = data ?? { tokens_in: 0, tokens_out: 0, est_cost_usd: 0 }
  await service.from('chat_usage').upsert({
    month,
    tokens_in: prev.tokens_in + tokensIn,
    tokens_out: prev.tokens_out + tokensOut,
    est_cost_usd: Number(prev.est_cost_usd) + cost,
    updated_at: new Date(deps.now ?? Date.now()).toISOString(),
  }, { onConflict: 'month' })
}

export async function isOverBudget(deps: { service?: SupabaseLike; budget?: number; now?: number } = {}): Promise<boolean> {
  const service = deps.service ?? (await createServiceClient())
  const budget = deps.budget ?? Number(process.env.ASSISTANT_MONTHLY_BUDGET_USD ?? '50')
  const { data } = await service.from('chat_usage').select('est_cost_usd').eq('month', currentMonth(deps.now)).maybeSingle()
  return Number(data?.est_cost_usd ?? 0) >= budget
}
