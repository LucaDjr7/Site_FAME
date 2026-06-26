import { NextResponse, after, type NextRequest } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import { reindexAll } from '@/lib/rag/index-source'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  after(async () => {
    try { await reindexAll() } catch { /* journalisé côté reindexAll */ }
  })
  return NextResponse.json({ started: true }, { status: 202 })
}
