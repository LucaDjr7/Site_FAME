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

/** Purge des objets Storage. Les chemins doivent être lus AVANT le DELETE du sujet
 *  (le FK `on delete cascade` supprime les lignes `subject_files`, donc les paths). */
export async function deleteSubjectFilesStorage(storagePaths: string[], deps: IndexFileDeps = {}): Promise<void> {
  if (!storagePaths.length) return
  const service = deps.service ?? (await createServiceClient())
  await service.storage.from(SUBJECT_FILES_BUCKET).remove(storagePaths)
}

export async function syncSubjectFileVisibility(
  subjectId: string,
  vals: { labo: string | null; confidentiel: boolean; is_transversal: boolean },
  deps: IndexFileDeps = {},
): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const base = { labo: vals.labo, is_transversal: vals.is_transversal }
  if (vals.confidentiel) {
    // Sujet confidentiel : tous ses docs sont member, quel que soit leur flag.
    await service.from('rag_chunks').update({ ...base, confidentiel: true, visibility: 'member' })
      .eq('source_type', 'subject_file').eq('metadata->>subject_id', subjectId)
    return
  }
  // Sujet public : la visibilité de chaque doc suit son propre flag.
  const { data: files } = await service.from('subject_files').select('id,confidentiel').eq('subject_id', subjectId)
  for (const f of (files ?? []) as Array<{ id: string; confidentiel: boolean }>) {
    const confidentiel = !!f.confidentiel
    await service.from('rag_chunks').update({ ...base, confidentiel, visibility: confidentiel ? 'member' : 'public' })
      .eq('source_type', 'subject_file').eq('source_id', f.id)
  }
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

  const dl = await service.storage.from(SUBJECT_FILES_BUCKET).download(file.storage_path)
  if (dl.error || !dl.data) return
  const bytes = new Uint8Array(await dl.data.arrayBuffer())
  const text = await extract(bytes, file.mime_type)

  await deleteFileChunks(fileId, { service })
  const chunks = chunkText(text)
  if (chunks.length === 0) return

  const embeddings = await provider.embed(chunks.map((c) => c.content))

  // Relire la confidentialité JUSTE avant l'insert : un toggle survenu pendant
  // l'embedding (fenêtre réseau longue) ne doit pas laisser un chunk en tier périmé.
  const { data: freshFile } = await service.from('subject_files').select('confidentiel,subject_id').eq('id', fileId).single()
  if (!freshFile) { await deleteFileChunks(fileId, { service }); return }
  const { data: freshSubject } = await service.from('subjects').select('confidentiel').eq('id', freshFile.subject_id).single()
  // Confidentiel si le sujet l'est (fail-closed si introuvable) OU si le doc l'est.
  const confidentiel = (freshSubject ? !!freshSubject.confidentiel : true) || !!freshFile.confidentiel
  const visibility: 'public' | 'member' = confidentiel ? 'member' : 'public'

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
