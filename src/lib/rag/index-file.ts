import { createServiceClient } from '@/lib/supabase/server'
import { getEmbeddingProvider, type EmbeddingProvider } from '@/lib/llm'
import { chunkText } from './chunk'
import { extractText } from '@/lib/subjects/extract-text'
import { SUBJECT_FILES_BUCKET } from '@/lib/subjects/file-upload'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (t: string) => any; storage: { from: (b: string) => any } }
export interface IndexFileDeps {
  service?: SupabaseLike
  provider?: EmbeddingProvider
  extract?: typeof extractText
}

export async function deleteFileChunks(fileId: string, deps: IndexFileDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('rag_chunks').delete().eq('source_id', fileId).eq('source_type', 'subject_file')
}

export async function deleteSubjectFileChunks(subjectId: string, deps: IndexFileDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('rag_chunks').delete().eq('source_type', 'subject_file').eq('metadata->>subject_id', subjectId)
}

export async function syncSubjectFileVisibility(
  subjectId: string,
  vals: { labo: string | null; confidentiel: boolean; is_transversal: boolean; visibility: 'public' | 'member' },
  deps: IndexFileDeps = {},
): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('rag_chunks').update(vals).eq('source_type', 'subject_file').eq('metadata->>subject_id', subjectId)
}

/** Re-tier léger des chunks d'un fichier (au toggle de confidentialité) — pas de ré-embed. */
export async function retierFile(fileId: string, deps: IndexFileDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const { data: file } = await service.from('subject_files').select('subject_id,confidentiel').eq('id', fileId).single()
  if (!file) return
  const { data: subject } = await service.from('subjects').select('confidentiel').eq('id', file.subject_id).single()
  const confidentiel = (subject ? !!subject.confidentiel : true) || !!file.confidentiel
  const visibility: 'public' | 'member' = confidentiel ? 'member' : 'public'
  await service.from('rag_chunks').update({ confidentiel, visibility })
    .eq('source_type', 'subject_file').eq('source_id', fileId)
}

export async function indexSubjectFile(fileId: string, deps: IndexFileDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const provider = deps.provider ?? getEmbeddingProvider()
  const extract = deps.extract ?? extractText

  const { data: file } = await service.from('subject_files').select('*').eq('id', fileId).single()
  if (!file) { await deleteFileChunks(fileId, { service }); return }

  const { data: subject } = await service.from('subjects').select('confidentiel,labo,is_transversal').eq('id', file.subject_id).single()
  // Confidentiel si le sujet l'est (fail-closed si introuvable) OU si le doc l'est.
  const confidentiel = (subject ? !!subject.confidentiel : true) || !!file.confidentiel
  const visibility: 'public' | 'member' = confidentiel ? 'member' : 'public'

  const dl = await service.storage.from(SUBJECT_FILES_BUCKET).download(file.storage_path)
  if (dl.error || !dl.data) return
  const bytes = new Uint8Array(await dl.data.arrayBuffer())
  const text = await extract(bytes, file.mime_type)

  await deleteFileChunks(fileId, { service })
  const chunks = chunkText(text)
  if (chunks.length === 0) return

  const embeddings = await provider.embed(chunks.map((c) => c.content))
  const rows = chunks.map((c, i) => ({
    source_type: 'subject_file',
    source_id: fileId,
    labo: subject?.labo ?? null,
    is_transversal: subject ? !!subject.is_transversal : false,
    confidentiel,
    visibility,
    lang: 'en',
    content: c.content,
    embedding: embeddings[i] ?? null,
    token_count: Math.ceil(c.content.length / 4),
    embedding_stale: false,
    metadata: { subject_id: file.subject_id, file_name: file.file_name },
  }))
  await service.from('rag_chunks').insert(rows)
}
