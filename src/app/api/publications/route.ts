import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { scheduleReindex } from '@/lib/rag/schedule'
import type { Lab } from '@/types'
import { VALID_LABS } from '@/lib/constants'

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab')
  if (lab === null || !VALID_LABS.includes(lab as Lab)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  const service = await createServiceClient()
  const { data, error } = await service
    .from('publications')
    .select('*')
    .order('annee', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const body = await req.json()
  const { labo, titre, auteurs, annee, type, revue_ou_conf, lien } = body
  if (!VALID_LABS.includes(labo) || !titre?.trim() || !annee || !type) {
    return NextResponse.json({ error: 'labo, titre, annee, type required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data, error } = await service
    .from('publications')
    .insert({
      labo,
      titre,
      auteurs: auteurs ?? [],
      annee,
      type,
      revue_ou_conf: revue_ou_conf || null,
      lien: lien || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  scheduleReindex('publication', data.id)
  return NextResponse.json(data, { status: 201 })
}
