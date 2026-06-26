import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  let body: { enabled?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }) }
  if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'enabled boolean required' }, { status: 400 })

  const service = await createServiceClient()
  const { error } = await service.from('app_settings')
    .upsert({ key: 'assistant_enabled', value: body.enabled }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: 'write failed' }, { status: 500 })
  return NextResponse.json({ enabled: body.enabled })
}
