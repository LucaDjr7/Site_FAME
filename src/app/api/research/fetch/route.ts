import { NextRequest, NextResponse } from 'next/server'
import { runResearchFetch } from '@/lib/research/fetch-pipeline'
import { runRetention } from '@/lib/research/retention'

// Vercel Cron only ever issues GET, with `Authorization: Bearer <CRON_SECRET>`
// auto-attached when CRON_SECRET is set on the project — see vercel.json.

// 300s is the max duration Vercel Functions allow with Fluid Compute (default
// since 2025) — verified live against https://vercel.com/docs/functions/configuring-functions/duration
// on 2026-09-13: this is now the ceiling for BOTH Hobby and Pro (an earlier
// version of this comment claimed Hobby capped at 60s and required a Pro
// upgrade — that limit no longer applies).
// This is headroom, not the fix: the real reduction is in fetch-pipeline.ts
// (batched embeddings, one dedup read per run, and per-source pacing that
// respects each API's actual documented rate limit).
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
