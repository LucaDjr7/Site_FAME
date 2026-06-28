import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { validateUpload, SUBJECT_FILES_BUCKET } from '@/lib/subjects/file-upload'
import crypto from 'crypto'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const v = validateUpload({ mimeType: body.mime_type, sizeBytes: body.size_bytes, fileName: body.file_name })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const service = await createServiceClient()
  const { data: subject } = await service.from('subjects').select('id').eq('id', id).single()
  if (!subject) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const path = `${id}/${crypto.randomUUID()}`
  const { data, error } = await service.storage.from(SUBJECT_FILES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'sign failed' }, { status: 500 })
  return NextResponse.json({ path: data.path, token: data.token })
}
