import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

// Bookmarks are private per-member data. This repo has no RLS policies, so the
// scoping happens here: every query is explicitly filtered by the caller's own
// user_id — never trust a user_id from the request body/query for reads.
export async function GET(_req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const service = await createServiceClient()
  const { data, error } = await service.from('research_bookmarks').select('*').eq('user_id', member.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { paper_id } = await req.json()
  if (!paper_id) return NextResponse.json({ error: 'paper_id required' }, { status: 400 })
  const service = await createServiceClient()
  const { error } = await service.from('research_bookmarks').upsert({ user_id: member.id, paper_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const paperId = req.nextUrl.searchParams.get('paper_id')
  if (!paperId) return NextResponse.json({ error: 'paper_id required' }, { status: 400 })
  const service = await createServiceClient()
  const { error } = await service.from('research_bookmarks').delete().eq('user_id', member.id).eq('paper_id', paperId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
