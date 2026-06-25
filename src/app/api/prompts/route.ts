import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab, PromptTarget } from '@/types'
import { VALID_LABS } from '@/lib/constants'

const TARGETS: PromptTarget[] = ['subject', 'publication', 'data', 'member', 'task']

export async function GET(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const lab = req.nextUrl.searchParams.get('lab')
  if (lab === null || !VALID_LABS.includes(lab as Lab)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  const validLab = lab as Lab
  const service = await createServiceClient()
  const { data, error } = await service
    .from('prompts')
    .select('*')
    .or(`labo.eq.${validLab},is_transversal.eq.true`)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  let session
  try { ({ session } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { labo, titre, type_cible, texte } = await req.json()
  if (!VALID_LABS.includes(labo) || !TARGETS.includes(type_cible) || !titre?.trim()) {
    return NextResponse.json({ error: 'labo, titre, type_cible required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { data, error } = await service
    .from('prompts')
    .insert({
      labo,
      titre: titre.trim(),
      type_cible,
      texte: texte ?? '',
      created_by: session.member?.id ?? null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
