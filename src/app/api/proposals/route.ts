import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { PROPOSAL_DOMAINS } from '@/lib/constants'
import type { Lab, Difficulty } from '@/types'

const VALID_LABS: Lab[] = ['paris', 'montreal']
const VALID_DIFF: Difficulty[] = ['easy', 'intermediate', 'advanced']

// GET ?ids=a,b,c  → public, returns just those proposals (visitor tracker)
// GET ?lab=paris  → member only, returns all proposals for the lab
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids')
  const lab = req.nextUrl.searchParams.get('lab') as Lab | null

  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100)
    if (ids.length === 0) return NextResponse.json([])
    const service = await createServiceClient()
    const { data, error } = await service
      .from('proposals').select('*').in('id', ids).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (lab) {
    if (!VALID_LABS.includes(lab)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
    try { await requireMember() } catch (e) { return authErrorResponse(e) }
    const service = await createServiceClient()
    const { data, error } = await service
      .from('proposals').select('*').eq('labo', lab).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'ids or lab required' }, { status: 400 })
}

// POST → public submission
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { labo, titre, domaine, difficulte, description,
    proposant_prenom, proposant_nom, proposant_email = null } = body

  if (!VALID_LABS.includes(labo)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  if (
    typeof titre !== 'string' || !titre.trim() ||
    typeof description !== 'string' || !description.trim() ||
    typeof proposant_prenom !== 'string' || !proposant_prenom.trim() ||
    typeof proposant_nom !== 'string' || !proposant_nom.trim()
  ) {
    return NextResponse.json({ error: 'titre, description, prenom, nom required' }, { status: 400 })
  }
  if (!PROPOSAL_DOMAINS.includes(domaine)) return NextResponse.json({ error: 'Invalid domaine' }, { status: 400 })
  if (!VALID_DIFF.includes(difficulte)) return NextResponse.json({ error: 'Invalid difficulte' }, { status: 400 })

  const service = await createServiceClient()
  const { data, error } = await service.from('proposals').insert({
    labo, titre: titre.trim(), domaine, difficulte, description: description.trim(),
    proposant_prenom: proposant_prenom.trim(), proposant_nom: proposant_nom.trim(),
    proposant_email: typeof proposant_email === 'string' ? proposant_email.trim() || null : null, statut: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
