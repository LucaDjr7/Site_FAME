import { createServiceClient } from '@/lib/supabase/server'
import { maskPII } from '@/lib/rag/guardrails'
type SupabaseLike = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function logFlagged(question: string, reason: string, ipHash: string, deps: { service?: SupabaseLike } = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('chat_flagged').insert({ question: maskPII(question).slice(0, 2000), reason, ip_hash: ipHash })
}

export async function logUnanswered(question: string, lang: string, ipHash: string, deps: { service?: SupabaseLike } = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('chat_unanswered').insert({ question: maskPII(question).slice(0, 2000), lang, ip_hash: ipHash })
}
