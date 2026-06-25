import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { PROPOSAL_DOMAINS, VALID_LABS } from '@/lib/constants'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type { Lab, Difficulty } from '@/types'
const VALID_DIFF: Difficulty[] = ['easy', 'intermediate', 'advanced']

// GET ?ids=a,b,c  → public, returns just those proposals (visitor tracker)
// GET ?lab=paris  → member only, returns all proposals for the lab
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids')
  const lab = req.nextUrl.searchParams.get('lab')

  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100)
    if (ids.length === 0) return NextResponse.json([])
    const service = await createServiceClient()
    const { data, error } = await service
      .from('proposals')
      .select('id,labo,titre,domaine,difficulte,description,proposant_prenom,proposant_nom,statut,created_at')
      .in('id', ids).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (lab) {
    if (!VALID_LABS.includes(lab as Lab)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
    const validLab = lab as Lab
    try { await requireMember() } catch (e) { return authErrorResponse(e) }
    const service = await createServiceClient()
    const { data, error } = await service
      .from('proposals').select('*').eq('labo', validLab).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'ids or lab required' }, { status: 400 })
}

// POST → public submission
export async function POST(req: NextRequest) {
  if (!rateLimit('proposal:' + clientIp(req), 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
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
  if (titre.trim().length > 300 || description.trim().length > 5000) {
    return NextResponse.json({ error: 'titre or description too long' }, { status: 400 })
  }
  if (typeof proposant_email === 'string' && proposant_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proposant_email.trim())) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
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
