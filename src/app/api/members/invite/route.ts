import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import { sendInvitationEmail } from '@/lib/resend/send-invitation'
import crypto from 'crypto'
import type { Lab, Role } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']
const ROLES: Role[] = ['direction', 'researcher', 'phd', 'engineering']

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { email, prenom, nom, role, labo } = await req.json()
  if (!email?.trim() || !prenom?.trim() || !nom?.trim() || !ROLES.includes(role) || !LABS.includes(labo)) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const tmpPassword = crypto.randomBytes(32).toString('hex')
  const { data: authData, error: authErr } = await service.auth.admin.createUser({ email, password: tmpPassword, email_confirm: true })
  if (authErr || !authData?.user) return NextResponse.json({ error: authErr?.message ?? 'Auth user creation failed' }, { status: 500 })

  const { data: member, error: mErr } = await service.from('members')
    .insert({ id: authData.user.id, email, prenom, nom, role, labo, domaines: [], is_admin: false })
    .select().single()
  if (mErr) {
    await service.auth.admin.deleteUser(authData.user.id) // rollback orphan auth user
    return NextResponse.json({ error: mErr.message }, { status: 500 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await service.from('invitations').insert({ email, token, member_id: member.id, expires_at })

  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const activationUrl = `${base}/en/auth/activate/${token}`
  try {
    await sendInvitationEmail({ to: email, prenom, activationUrl, lab: labo })
  } catch (emailErr) {
    // Non-fatal: the invitation row exists; the admin can resend / share the link.
    console.error('Failed to send invitation email:', emailErr)
  }
  return NextResponse.json({ ok: true, activationUrl }, { status: 201 })
}
