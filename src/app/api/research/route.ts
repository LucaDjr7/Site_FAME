import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import { computeFingerprint } from '@/lib/research/dedup'
import { tagThemes } from '@/lib/research/themes'
import { RESEARCH_PAPER_COLUMNS } from '@/lib/research/columns'

// `research_papers.published_at` is a `date` column.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Admin-only listing across every status — the public /research page reads
// published rows directly (see src/app/[locale]/research/page.tsx), it does
// not use this route.
export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const status = req.nextUrl.searchParams.get('status')
  const service = await createServiceClient()
  // Explicit columns, never `*`: `embedding` is a 1536-float pgvector per row
  // and has no business in a JSON response (see columns.ts).
  let query = service.from('research_papers').select(RESEARCH_PAPER_COLUMNS)
  if (status) query = query.eq('status', status)
  const { data, error } = await query.order('fetched_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Manual add — covers a paper the automated fetch missed. Always published,
// always manual_override so the weekly job never touches it.
export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const body = await req.json()
  const { title, url, authors, abstract, venue, published_at } = body
  if (!title?.trim() || !url?.trim()) {
    return NextResponse.json({ error: 'title and url required' }, { status: 400 })
  }
  // Optional, but worth collecting: the public page groups papers by year and
  // sorts everything with a NULL `published_at` into an "undated" bucket at the
  // very bottom — wrong for a hand-curated paper that has a real date.
  if (published_at != null && published_at !== '' && !ISO_DATE.test(String(published_at))) {
    return NextResponse.json({ error: 'published_at must be YYYY-MM-DD' }, { status: 400 })
  }
  const service = await createServiceClient()
  const fingerprint = computeFingerprint({ doi: null, url, title })
  const { data, error } = await service.from('research_papers').insert({
    fingerprint,
    title,
    authors: authors ?? [],
    abstract: abstract || null,
    url,
    source: 'manual',
    venue: venue || null,
    themes: tagThemes(title, abstract ?? ''),
    fame_score: null,
    published_at: published_at || null,
    status: 'published',
    manual_override: true,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
