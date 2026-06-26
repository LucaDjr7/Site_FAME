import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, requireAdmin, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()
  const { data, error } = await service
    .from('members')
    .select('id,prenom,nom,role,labo,domaines,photo_url,is_admin,email,activated_at,created_at')
    .eq('id', id)
    .single()
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  let session
  try { ({ session } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const isAdmin = !!session.member?.is_admin
  const isSelf = session.user.id === id
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const SELF_FIELDS = ['email', 'domaines', 'photo_url']
  const ADMIN_FIELDS = ['prenom', 'nom', 'role', 'is_admin', ...SELF_FIELDS]
  const allowed = isAdmin ? ADMIN_FIELDS : SELF_FIELDS
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) updates[k] = body[k]
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No editable fields' }, { status: 400 })

  const service = await createServiceClient()
  const { data, error } = await service.from('members').update(updates).eq('id', id).select().single()
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()
  // No DB cascade between auth.users and members — delete BOTH explicitly.
  // Deleting the member row cascades its invitations (FK on delete cascade).
  await service.auth.admin.deleteUser(id)            // ignore "user not found"
  const { data, error } = await service.from('members').delete().eq('id', id).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
