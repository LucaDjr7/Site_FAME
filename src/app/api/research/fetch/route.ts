import { NextRequest, NextResponse } from 'next/server'
import { runResearchFetch } from '@/lib/research/fetch-pipeline'
import { runRetention } from '@/lib/research/retention'

// Vercel Cron only ever issues GET, with `Authorization: Bearer <CRON_SECRET>`
// auto-attached when CRON_SECRET is set on the project — see vercel.json.
export const maxDuration = 60

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
