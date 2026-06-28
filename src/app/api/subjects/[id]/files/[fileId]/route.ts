import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession, requireMember, authErrorResponse } from '@/lib/auth'
import { SUBJECT_FILES_BUCKET } from '@/lib/subjects/file-upload'
import { scheduleDeleteFileChunks } from '@/lib/rag/schedule'

type Params = { params: Promise<{ id: string; fileId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, fileId } = await params
  const isMember = !!(await getSession())?.member
  const service = await createServiceClient()

  const { data: subject } = await service.from('subjects').select('confidentiel').eq('id', id).single()
  if (!subject) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Visiteur : un fichier de sujet confidentiel n'existe pas.
  if (subject.confidentiel && !isMember) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: file } = await service.from('subject_files').select('*').eq('id', fileId).single()
  if (!file || file.subject_id !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: signed, error } = await service.storage.from(SUBJECT_FILES_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.file_name })
  if (error || !signed) return NextResponse.json({ error: 'download failed' }, { status: 500 })
  return NextResponse.redirect(signed.signedUrl, 302)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id, fileId } = await params
  const service = await createServiceClient()
  const { data: file } = await service.from('subject_files').select('storage_path,subject_id').eq('id', fileId).single()
  if (!file || file.subject_id !== id) return NextResponse.json({ ok: true }) // idempotent
  await service.storage.from(SUBJECT_FILES_BUCKET).remove([file.storage_path])
  await service.from('subject_files').delete().eq('id', fileId)
  scheduleDeleteFileChunks(fileId)
  return NextResponse.json({ ok: true })
}
