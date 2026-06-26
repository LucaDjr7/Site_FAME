// src/lib/rag/rate-limit-db.ts
import { createServiceClient } from '@/lib/supabase/server'

type SupabaseLike = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function checkRateLimitDb(
  key: string, limit: number, windowMs: number,
  deps: { service?: SupabaseLike; now?: number } = {},
): Promise<boolean> {
  const service = deps.service ?? (await createServiceClient())
  const now = deps.now ?? Date.now()
  const bucket = new Date(Math.floor(now / windowMs) * windowMs).toISOString()

  const { data } = await service.from('chat_rate_limit')
    .select('count').eq('key', key).eq('window_start', bucket).maybeSingle()
  const current = (data?.count as number | undefined) ?? 0
  if (current >= limit) return false

  await service.from('chat_rate_limit')
    .upsert({ key, window_start: bucket, count: current + 1 }, { onConflict: 'key,window_start' })
  return true
}
