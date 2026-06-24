import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  if (!LABS.includes(lab)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  const service = await createServiceClient()
  const { data, error } = await service
    .from('members')
    .select('id,prenom,nom,email,role,labo,domaines,photo_url,is_admin,activated_at,created_at')
    .eq('labo', lab).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
