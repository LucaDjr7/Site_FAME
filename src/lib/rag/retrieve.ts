import { createServiceClient } from '@/lib/supabase/server'
import { getEmbeddingProvider, type EmbeddingProvider } from '@/lib/llm'
import type { RagSourceType } from '@/types'

export type Tier = 'visitor' | 'member'

export interface RetrievedChunk {
  id: string
  source_type: RagSourceType
  source_id: string
  content: string
  labo: string | null
  lang: string
  similarity: number
  metadata?: Record<string, unknown>
}

type SupabaseLike = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }

export interface RetrieveDeps {
  service?: SupabaseLike
  provider?: EmbeddingProvider
  threshold?: number
  matchCount?: number
}

const RAW_THRESHOLD = Number(process.env.ASSISTANT_SIMILARITY_THRESHOLD ?? '0.30')
// Durci contre NaN (var non numérique) : sinon `similarity >= NaN` est toujours faux
// et tous les chunks seraient silencieusement droppés → retrieval vide.
const DEFAULT_THRESHOLD = Number.isFinite(RAW_THRESHOLD) ? RAW_THRESHOLD : 0.30
const DEFAULT_MATCH_COUNT = 8

export async function retrieve(query: string, tier: Tier, deps: RetrieveDeps = {}): Promise<RetrievedChunk[]> {
  const provider = deps.provider ?? getEmbeddingProvider()
  const service = deps.service ?? ((await createServiceClient()) as unknown as SupabaseLike)
  const threshold = deps.threshold ?? DEFAULT_THRESHOLD
  const matchCount = deps.matchCount ?? DEFAULT_MATCH_COUNT

  const embeddings = await provider.embed([query])
  const queryEmbedding = embeddings[0]
  if (!queryEmbedding) return []

  const { data, error } = await service.rpc('match_rag_chunks', {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    include_member: tier === 'member',
  })
  if (error || !data) return []

  return (data as RetrievedChunk[])
    .filter(c => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
}

const DEFAULT_FILE_MATCH_COUNT = 4

export async function retrieveSubjectFiles(
  query: string,
  subjectId: string,
  deps: RetrieveDeps = {},
): Promise<RetrievedChunk[]> {
  const provider = deps.provider ?? getEmbeddingProvider()
  const service = deps.service ?? ((await createServiceClient()) as unknown as SupabaseLike)
  const threshold = deps.threshold ?? DEFAULT_THRESHOLD
  const matchCount = deps.matchCount ?? DEFAULT_FILE_MATCH_COUNT

  const embeddings = await provider.embed([query])
  const queryEmbedding = embeddings[0]
  if (!queryEmbedding) return []

  const { data, error } = await service.rpc('match_subject_files', {
    query_embedding: queryEmbedding,
    p_subject_id: subjectId,
    match_count: matchCount,
  })
  if (error || !data) return []

  return (data as RetrievedChunk[])
    .filter((c) => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
}
