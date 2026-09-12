import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

// Surfaces the weekly cron's own log so an admin can spot a silently-failed
// run (see spec § Fetch & cron — the exact failure mode found in the Papyrus audit).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const service = await createServiceClient()
  const { data, error } = await service.from('research_fetch_log').select('*').order('run_at', { ascending: false }).limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
