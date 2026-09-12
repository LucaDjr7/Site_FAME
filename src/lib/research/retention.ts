// src/lib/research/retention.ts
// Purge policy (see spec § Rétention):
//   - rejected, older than 90 days → row deleted entirely (noise, no admin decision).
//   - hidden, older than 90 days → abstract + embedding stripped, row KEPT forever
//     (deleting it would let the fingerprint resurface and get silently
//     auto-republished on the next fetch, overwriting the admin's decision).
// `manual_override` rows are never touched by this job outside of these two
// well-defined, always-safe transitions.
import { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

const RETENTION_DAYS = 90

function cutoffIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - RETENTION_DAYS)
  return d.toISOString()
}

export async function runRetention(
  deps: { service?: ServiceClient } = {}
): Promise<{ deletedRejected: number; strippedHidden: number }> {
  const service = deps.service ?? (await createServiceClient())
  const cutoff = cutoffIso()

  const { data: deleted, error: deleteError } = await service
    .from('research_papers')
    .delete()
    .eq('status', 'rejected')
    .lt('updated_at', cutoff)
    .select()
  if (deleteError) throw new Error(deleteError.message)

  const { data: stripped, error: updateError } = await service
    .from('research_papers')
    .update({ abstract: null, embedding: null })
    .eq('status', 'hidden')
    .lt('updated_at', cutoff)
    .select()
  if (updateError) throw new Error(updateError.message)

  return { deletedRejected: deleted?.length ?? 0, strippedHidden: stripped?.length ?? 0 }
}
