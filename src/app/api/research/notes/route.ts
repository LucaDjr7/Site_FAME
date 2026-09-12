import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

// Notes are private per-member data, same security model as bookmarks. This
// repo has no RLS policies, so the scoping happens here: every query is
// explicitly filtered by the caller's own user_id — never trust a user_id
// from the request body/query.
export async function GET(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const paperId = req.nextUrl.searchParams.get('paper_id')
  if (!paperId) return NextResponse.json({ error: 'paper_id required' }, { status: 400 })
  const service = await createServiceClient()
  const { data, error } = await service.from('research_notes').select('*').eq('user_id', member.id).eq('paper_id', paperId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

export async function PUT(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { paper_id, content } = await req.json()
  if (!paper_id || !content?.trim()) {
    return NextResponse.json({ error: 'paper_id and content required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { error } = await service.from('research_notes').upsert({
    user_id: member.id, paper_id, content, updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
