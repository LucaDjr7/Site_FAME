import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  const strong = typeof password === 'string' && password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
  if (!token || !strong) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Validate token
  const { data: invitation, error: invErr } = await service
    .from('invitations')
    .select('*, members(*)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (invErr || !invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 })
  }

  // Update Supabase Auth password
  const { error: pwErr } = await service.auth.admin.updateUserById(
    invitation.member_id,
    { password }
  )
  if (pwErr) {
    console.error('Activation password update failed:', pwErr)
    return NextResponse.json({ error: 'Activation failed' }, { status: 500 })
  }

  // Mark member as activated
  const { error: actErr } = await service.from('members')
    .update({ activated_at: new Date().toISOString() })
    .eq('id', invitation.member_id)
  if (actErr) {
    console.error('Activation member update failed:', actErr)
    return NextResponse.json({ error: 'Activation failed' }, { status: 500 })
  }

  // Delete the invitation (non-blocking cleanup)
  const { error: delErr } = await service.from('invitations').delete().eq('id', invitation.id)
  if (delErr) console.error('Invitation cleanup failed:', delErr)

  return NextResponse.json({ ok: true })
}
