import { NextRequest, NextResponse } from 'next/server'
import { sendReportEmail } from '@/lib/resend/send-report'

const MAX = 5000

export async function POST(req: NextRequest) {
  let body: { message?: unknown; email?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad body' }, { status: 400 }) }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().slice(0, 200) : undefined
  try {
    await sendReportEmail({ message: message.slice(0, MAX), fromEmail: email })
  } catch {
    return NextResponse.json({ error: 'send failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
