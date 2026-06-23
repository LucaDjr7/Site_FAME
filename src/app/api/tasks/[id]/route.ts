import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const service = await createServiceClient()
  const { data, error } = await service
    .from('tasks')
    .select(`*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*, subtask_assignees(member_id, members(id,prenom,nom,photo_url)))`)
    .eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  let session
  try { ({ session } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json()
  const allowed = ['titre','description','statut','difficulte','sujet_id','date_echeance']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) updates[key] = body[key] }

  const service = await createServiceClient()

  // Record history for status change
  if ('statut' in body) {
    const { data: old } = await service.from('tasks').select('statut').eq('id', id).single()
    if (old && old.statut !== body.statut) {
      const name = session.member ? `${session.member.prenom} ${session.member.nom}` : 'Unknown'
      await service.from('task_history').insert({
        task_id: id, auteur_id: session.user.id, auteur_nom: name,
        champ: 'statut', valeur_avant: old.statut, valeur_apres: body.statut,
      })
    }
  }

  const { data, error } = await service.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()
  const { error } = await service.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
