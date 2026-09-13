import { NextRequest, NextResponse } from 'next/server'
import { runResearchFetch } from '@/lib/research/fetch-pipeline'
import { runRetention } from '@/lib/research/retention'

// Vercel Cron only ever issues GET, with `Authorization: Bearer <CRON_SECRET>`
// auto-attached when CRON_SECRET is set on the project — see vercel.json.

// 300s is the ceiling Vercel's Pro plan allows for a Node.js function; the
// Hobby plan caps functions far below that (10s by default, 60s ceiling), which
// cannot run this pipeline at all — the deployment needs Pro.
// This is headroom, not the fix: the real reduction is in fetch-pipeline.ts
// (batched embeddings, one dedup read per run, throttled + narrowed fan-out).
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  const got = req.headers.get('authorization')
  if (!expected || got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await runResearchFetch()
  const retention = await runRetention()
  return NextResponse.json({ results, retention })
}
