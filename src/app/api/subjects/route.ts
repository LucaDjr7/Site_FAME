import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

const VALID_LABS: Lab[] = ['paris', 'montreal']

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  if (!VALID_LABS.includes(lab)) {
    return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data, error } = await service
    .from('subjects')
    .select('*')
    .eq('labo', lab)
    .order('ordre', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    await requireMember()
  } catch (e) { return authErrorResponse(e) }

  const body = await req.json()
  const { labo, titre, kicker = '', statut = 'active', context = '', method = '',
    results = '', keywords = [], auteurs = [], dimensions } = body

  if (!VALID_LABS.includes(labo) || !titre?.trim()) {
    return NextResponse.json({ error: 'labo and titre required' }, { status: 400 })
  }

  const service = await createServiceClient()
  // Get current max ordre for this lab
  const { data: last } = await service
    .from('subjects')
    .select('ordre')
    .eq('labo', labo)
    .order('ordre', { ascending: false })
    .limit(1)
    .single()

  const ordre = (last?.ordre ?? -1) + 1

  const { data, error } = await service
    .from('subjects')
    .insert({ labo, titre, kicker, statut, context, method, results, keywords, auteurs,
      dimensions: dimensions ?? { method: '', data: '', theory: '', writing: '' }, ordre })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
