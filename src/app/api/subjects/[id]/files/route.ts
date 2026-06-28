import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { validateUpload, SUBJECT_FILES_BUCKET } from '@/lib/subjects/file-upload'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const v = validateUpload({ mimeType: body.mime_type, sizeBytes: body.size_bytes, fileName: body.file_name })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  // Le chemin doit appartenir au dossier du sujet (anti-forgerie).
  if (typeof body.storage_path !== 'string' || !body.storage_path.startsWith(`${id}/`)) {
    return NextResponse.json({ error: 'invalid storage_path' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: subject } = await service.from('subjects').select('id,labo').eq('id', id).single()
  if (!subject) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await service.from('subject_files').insert({
    subject_id: id, labo: subject.labo, storage_path: body.storage_path,
    file_name: body.file_name, mime_type: body.mime_type, size_bytes: body.size_bytes,
    uploaded_by: member.id,
  }).select().single()

  if (error) {
    // Compensation : pas de ligne → on retire l'objet orphelin du bucket.
    await service.storage.from(SUBJECT_FILES_BUCKET).remove([body.storage_path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
