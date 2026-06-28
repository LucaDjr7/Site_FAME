import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { checkIpRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  if (!await checkIpRateLimit(req, 'signin', 10, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
