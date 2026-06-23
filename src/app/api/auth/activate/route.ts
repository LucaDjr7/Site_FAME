import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password || password.length < 8) {
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
  await service.from('members').update({ activated_at: new Date().toISOString() })
    .eq('id', invitation.member_id)

  // Delete the invitation
  await service.from('invitations').delete().eq('id', invitation.id)

  return NextResponse.json({ ok: true })
}
