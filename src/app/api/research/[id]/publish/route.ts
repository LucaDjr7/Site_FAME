import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// Covers both "republish a rejected paper" and "unhide a hidden paper" —
// same transition (→ published), same admin action.
export async function POST(_req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()

  const { data: paper } = await service.from('research_papers').select('id, status').eq('id', id).single()
  if (!paper) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (paper.status === 'published') {
    return NextResponse.json({ error: 'Already published' }, { status: 409 })
  }

  const { data, error } = await service.from('research_papers')
    .update({ status: 'published', manual_override: true, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
