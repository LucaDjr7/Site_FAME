import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { sujet_id, texte, visitor_prenom, visitor_nom } = await req.json()
  if (!sujet_id || !texte?.trim()) {
    return NextResponse.json({ error: 'sujet_id and texte required' }, { status: 400 })
  }
  if (typeof texte !== 'string' || texte.length > 4000) {
    return NextResponse.json({ error: 'texte too long' }, { status: 400 })
  }

  const session = await getSession()
  const service = await createServiceClient()

  let auteur_type: 'visitor' | 'member'
  let auteur_nom: string
  let membre_id: string | null = null

  if (session?.member) {
    auteur_type = 'member'
    auteur_nom = `${session.member.prenom} ${session.member.nom}`
    membre_id = session.member.id
  } else {
    if (!visitor_prenom?.trim() || !visitor_nom?.trim()) {
      return NextResponse.json({ error: 'First name and last name required for visitors' }, { status: 400 })
    }
    if (visitor_prenom.trim().length > 80 || visitor_nom.trim().length > 80) {
      return NextResponse.json({ error: 'visitor name too long' }, { status: 400 })
    }
    auteur_type = 'visitor'
    auteur_nom = `${visitor_prenom.trim()} ${visitor_nom.trim()}`
  }

  const { data, error } = await service
    .from('comments')
    .insert({ sujet_id, auteur_type, auteur_nom, membre_id, texte })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
