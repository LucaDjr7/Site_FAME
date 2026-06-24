import { NextRequest, NextResponse } from 'next/server'
import { buildTree } from '@/lib/dropbox/tree'
import { requireMember, authErrorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const path = req.nextUrl.searchParams.get('path') ?? ''
  try {
    return NextResponse.json(await buildTree(path))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dropbox error'
    if (msg === 'DROPBOX_ACCESS_TOKEN not configured') {
      return NextResponse.json({ error: 'not_configured' }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
