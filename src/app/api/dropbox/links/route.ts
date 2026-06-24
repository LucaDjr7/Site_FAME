import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

export async function GET(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  if (!lab || !LABS.includes(lab)) {
    return NextResponse.json({ error: 'Invalid or missing lab' }, { status: 400 })
  }
  const subject_id = req.nextUrl.searchParams.get('subject_id')
  const task_id = req.nextUrl.searchParams.get('task_id')

  const service = await createServiceClient()
  let query = service
    .from('dropbox_links')
    .select('*')
    .eq('labo', lab)
    .order('created_at', { ascending: true })

  if (subject_id) query = query.eq('subject_id', subject_id)
  if (task_id) query = query.eq('task_id', task_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const body = await req.json()
  const { node_id, node_path, node_name, labo, subject_id, task_id } = body

  if (!node_id || !LABS.includes(labo) || (!subject_id && !task_id)) {
    return NextResponse.json(
      { error: 'node_id, labo, and (subject_id or task_id) are required' },
      { status: 400 }
    )
  }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('dropbox_links')
    .insert({
      node_id,
      node_path,
      node_name,
      labo,
      subject_id: subject_id || null,
      task_id: task_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
