import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { scheduleReindex } from '@/lib/rag/schedule'
import type { PromptTarget } from '@/types'

const TARGETS: PromptTarget[] = ['subject', 'publication', 'data', 'member', 'task']

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  if ('titre' in body) {
    if (!body.titre?.trim()) return NextResponse.json({ error: 'titre cannot be empty' }, { status: 400 })
    updates.titre = body.titre.trim()
  }
  if ('type_cible' in body) {
    if (!TARGETS.includes(body.type_cible)) return NextResponse.json({ error: 'Invalid type_cible' }, { status: 400 })
    updates.type_cible = body.type_cible
  }
  if ('texte' in body) {
    updates.texte = body.texte ?? ''
  }
  if ('is_transversal' in body) {
    updates.is_transversal = !!body.is_transversal
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data, error } = await service
    .from('prompts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  scheduleReindex('prompt', id)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()
  const { data, error } = await service.from('prompts').delete().eq('id', id).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  scheduleReindex('prompt', id)
  return NextResponse.json({ ok: true })
}
