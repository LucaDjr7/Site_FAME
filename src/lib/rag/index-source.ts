import { createServiceClient } from '@/lib/supabase/server'
import { getEmbeddingProvider, type EmbeddingProvider } from '@/lib/llm'
import {
  chunkSubject,
  chunkPublication,
  chunkPrompt,
  chunkMember,
  chunkTask,
  type RawChunk,
} from './chunk'
import { loadKbDir } from './kb'
import type { RagSourceType } from '@/types'
import { syncSubjectFileVisibility } from './index-file'

// Forme minimale du client service-role utilisée ici (assez pour typer/mock).
type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: { from: (b: string) => any }
}

export interface IndexDeps {
  service?: SupabaseLike
  provider?: EmbeddingProvider
  kbDir?: string
}

type Labo = 'paris' | 'montreal' | null

interface ChunkBatch {
  chunks: RawChunk[]
  labo: Labo
  is_transversal: boolean
  confidentiel: boolean
  visibility: 'public' | 'member'
  lang: string
}

async function buildBatch(
  service: SupabaseLike,
  type: RagSourceType,
  id: string,
): Promise<ChunkBatch | null> {
  if (type === 'subject') {
    const { data } = await service.from('subjects').select('*').eq('id', id).single()
    if (!data) return null
    return {
      chunks: chunkSubject(data),
      labo: data.labo,
      is_transversal: data.is_transversal,
      confidentiel: data.confidentiel,
      visibility: data.confidentiel ? 'member' : 'public',
      lang: 'en',
    }
  }
  if (type === 'publication') {
    const { data } = await service.from('publications').select('*').eq('id', id).single()
    if (!data) return null
    return {
      chunks: chunkPublication(data),
      labo: data.labo,
      is_transversal: false,
      confidentiel: false,
      visibility: 'public',
      lang: 'en',
    }
  }
  if (type === 'prompt') {
    const { data } = await service.from('prompts').select('*').eq('id', id).single()
    if (!data) return null
    return {
      chunks: chunkPrompt(data),
      labo: data.labo,
      is_transversal: data.is_transversal,
      confidentiel: false,
      visibility: 'member',
      lang: 'en',
    }
  }
  if (type === 'member') {
    const { data } = await service.from('members').select('*').eq('id', id).single()
    if (!data) return null
    return {
      chunks: chunkMember(data),
      labo: data.labo,
      is_transversal: false,
      confidentiel: false,
      visibility: 'public',
      lang: 'en',
    }
  }
  if (type === 'task') {
    const { data } = await service.from('tasks').select('*').eq('id', id).single()
    if (!data) return null
    // FK réelle vérifiée : tasks.sujet_id → subjects(id) (migration 001).
    // FAIL-CLOSED : si la lecture du sujet parent échoue ou ne renvoie aucune ligne,
    // on traite la tâche comme confidentielle (jamais de fuite publique sur erreur transitoire).
    // Seul un parent récupéré avec succès ET explicitement non confidentiel donne 'public'.
    const { data: subj, error: subjError } = await service
      .from('subjects')
      .select('confidentiel')
      .eq('id', data.sujet_id)
      .single()
    const conf = subjError || !subj ? true : !!subj.confidentiel
    return {
      chunks: chunkTask(data),
      labo: data.labo,
      is_transversal: false,
      confidentiel: conf,
      visibility: conf ? 'member' : 'public',
      lang: 'en',
    }
  }
  return null
}

async function replaceChunks(
  service: SupabaseLike,
  provider: EmbeddingProvider,
  type: RagSourceType,
  id: string,
  batch: ChunkBatch,
): Promise<void> {
  // Purge des anciens chunks de cette source AVANT insertion (source_id est unique : uuid ou kb:<slug>).
  await service.from('rag_chunks').delete().eq('source_id', id)
  if (batch.chunks.length === 0) return
  const embeddings = await provider.embed(batch.chunks.map((c) => c.content))
  const rows = batch.chunks.map((c, i) => ({
    source_type: type,
    source_id: id,
    labo: batch.labo,
    is_transversal: batch.is_transversal,
    confidentiel: batch.confidentiel,
    visibility: batch.visibility,
    lang: c.lang ?? batch.lang,
    content: c.content,
    embedding: embeddings[i] ?? null,
    token_count: Math.ceil(c.content.length / 4),
    embedding_stale: false,
  }))
  await service.from('rag_chunks').insert(rows)
}

export async function indexSource(
  type: RagSourceType,
  id: string,
  deps: IndexDeps = {},
): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const provider = deps.provider ?? getEmbeddingProvider()
  const batch = await buildBatch(service, type, id)
  if (!batch) {
    // Source disparue : on purge ses chunks résiduels.
    await deleteSourceChunks(type, id, { service })
    return
  }
  await replaceChunks(service, provider, type, id, batch)
  if (type === 'subject') {
    await syncSubjectFileVisibility(id, {
      labo: batch.labo, confidentiel: batch.confidentiel,
      is_transversal: batch.is_transversal, visibility: batch.visibility,
    }, { service })
  }
}

export async function deleteSourceChunks(
  _type: RagSourceType,
  id: string,
  deps: IndexDeps = {},
): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('rag_chunks').delete().eq('source_id', id)
}

export async function markSourceStale(
  _type: RagSourceType,
  id: string,
  deps: IndexDeps = {},
): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('rag_chunks').update({ embedding_stale: true }).eq('source_id', id)
}

export async function reindexAll(deps: IndexDeps = {}): Promise<{ indexed: number }> {
  const service = deps.service ?? (await createServiceClient())
  const provider = deps.provider ?? getEmbeddingProvider()
  let indexed = 0

  const tableToType = {
    subjects: 'subject',
    publications: 'publication',
    prompts: 'prompt',
    members: 'member',
    tasks: 'task',
  } as const

  for (const table of ['subjects', 'publications', 'prompts', 'members', 'tasks'] as const) {
    const { data } = await service.from(table).select('id')
    for (const row of (data ?? []) as { id: string }[]) {
      await indexSource(tableToType[table], row.id, { service, provider })
      indexed++
    }
  }

  // KB (frontmatter Markdown — source_id = `kb:<slug>`).
  const kbDir = deps.kbDir ?? `${process.cwd()}/docs/kb`
  const docs = await loadKbDir(kbDir)
  for (const doc of docs) {
    const sourceId = `kb:${doc.slug}`
    await service.from('rag_chunks').delete().eq('source_id', sourceId)
    if (doc.chunks.length === 0) continue
    const embeddings = await provider.embed(doc.chunks.map((c) => c.content))
    const rows = doc.chunks.map((c, i) => ({
      source_type: 'kb' as const,
      source_id: sourceId,
      labo: doc.labo,
      is_transversal: false,
      confidentiel: false,
      visibility: 'public' as const,
      lang: doc.lang,
      content: c.content,
      embedding: embeddings[i] ?? null,
      token_count: Math.ceil(c.content.length / 4),
      embedding_stale: false,
    }))
    await service.from('rag_chunks').insert(rows)
    indexed++
  }

  return { indexed }
}
