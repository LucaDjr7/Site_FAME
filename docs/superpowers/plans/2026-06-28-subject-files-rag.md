# Subject Files into RAG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Indexer le texte des documents uploadés sur une fiche dans le RAG (`rag_chunks`), pour enrichir la génération assistée (docs de la fiche) et l'assistant Astra (selon le statut confidentiel/public du sujet).

**Architecture:** Extraction de texte par type MIME (pdf via `unpdf`, office via `fflate`+XML, txt/csv natif) → chunking générique → embeddings dans `rag_chunks` (`source_type='subject_file'`, visibilité héritée du sujet, `metadata={subject_id,file_name}`), indexé en arrière-plan (`after()`) à l'upload. Génération : RPC `match_subject_files` scopée au sujet. Astra : `match_rag_chunks` (déjà filtré par visibilité) + citations vers le sujet parent.

**Tech Stack:** Next.js 16, Supabase (service-role + Storage + pgvector RPC), TypeScript, vitest, `unpdf`, `fflate`.

## Global Constraints

- Tous writes via `createServiceClient()` (service-role, sans cookies). Génération/upload = `requireMember()`.
- `confidentiel=true` n'est JAMAIS servi à un visiteur ; la visibilité des chunks de documents est héritée du sujet et resynchronisée.
- Embeddings via `getEmbeddingProvider()` (OpenAI), comptés ; bucket Storage privé `subject-files` (constante `SUBJECT_FILES_BUCKET` dans `src/lib/subjects/file-upload.ts`).
- `RawChunk = { content: string }` (`src/lib/rag/chunk.ts`). `EmbeddingProvider.embed(texts: string[]): Promise<number[][]>`.
- Migrations numérotées (dernière = `010`) → cette feature ajoute `011`. Tests : vitest, mock `@/lib/supabase/server`, `@/lib/llm`, `@/lib/auth` selon le pattern des `route.test.ts` existants. jsdom pour les composants.
- i18n en/fr à parité (test `src/messages-parity.test.ts`).

---

### Task 1: Dépendances, migration `011`, type `RagSourceType`

**Files:**
- Modify: `package.json` (deps `unpdf`, `fflate`)
- Create: `supabase/migrations/011_subject_files_rag.sql`
- Modify: `src/types/index.ts:261` (RagSourceType)

**Interfaces:**
- Produces: `source_type='subject_file'` autorisé ; RPC `match_rag_chunks(...)` retourne désormais `metadata jsonb` ; RPC `match_subject_files(query_embedding vector(1536), p_subject_id text, match_count int)`.

- [ ] **Step 1: Installer les dépendances**

Run: `npm install unpdf fflate`
Expected: ajout dans `dependencies`, exit 0.

- [ ] **Step 2: Écrire la migration**

Create `supabase/migrations/011_subject_files_rag.sql`:

```sql
-- Autoriser le type 'subject_file' dans rag_chunks.
alter table rag_chunks drop constraint rag_chunks_source_type_check;
alter table rag_chunks add constraint rag_chunks_source_type_check
  check (source_type in ('subject','task','publication','prompt','member','kb','subject_file'));

-- match_rag_chunks renvoie désormais metadata (pour les citations de documents).
create or replace function match_rag_chunks(
  query_embedding vector(1536),
  match_count int,
  include_member boolean
)
returns table (
  id uuid, source_type text, source_id text, content text,
  labo text, lang text, metadata jsonb, similarity float
)
language sql stable as $$
  select
    c.id, c.source_type, c.source_id, c.content, c.labo, c.lang, c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from rag_chunks c
  where c.embedding is not null
    and (include_member or c.visibility = 'public')
  order by c.embedding <=> query_embedding
  limit match_count
$$;

-- Recherche vectorielle scopée aux documents d'UN sujet (génération assistée).
create or replace function match_subject_files(
  query_embedding vector(1536),
  p_subject_id text,
  match_count int
)
returns table (
  id uuid, source_type text, source_id text, content text,
  labo text, lang text, metadata jsonb, similarity float
)
language sql stable as $$
  select
    c.id, c.source_type, c.source_id, c.content, c.labo, c.lang, c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from rag_chunks c
  where c.embedding is not null
    and c.source_type = 'subject_file'
    and c.metadata->>'subject_id' = p_subject_id
  order by c.embedding <=> query_embedding
  limit match_count
$$;
```

- [ ] **Step 3: Étendre `RagSourceType`**

In `src/types/index.ts` line 261, replace:

```ts
export type RagSourceType = 'subject' | 'task' | 'publication' | 'prompt' | 'member' | 'kb' | 'subject_file'
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json supabase/migrations/011_subject_files_rag.sql src/types/index.ts
git commit -m "feat(rag): deps + migration 011 (subject_file source_type, RPCs) + type"
```

---

### Task 2: Extraction de texte

**Files:**
- Create: `src/lib/subjects/extract-text.ts`
- Test: `src/lib/subjects/extract-text.test.ts`

**Interfaces:**
- Produces: `extractText(bytes: Uint8Array, mime: string): Promise<string>` — texte extrait (tronqué à 200000 car., trim), `''` si type inconnu / vide / erreur.

- [ ] **Step 1: Write the failing test**

Create `src/lib/subjects/extract-text.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { extractText } from './extract-text'

vi.mock('unpdf', () => ({
  getDocumentProxy: async () => ({}),
  extractText: async () => ({ totalPages: 1, text: 'Texte du PDF' }),
}))

describe('extractText', () => {
  it('décode txt et csv', async () => {
    expect(await extractText(strToU8('bonjour'), 'text/plain')).toBe('bonjour')
    expect(await extractText(strToU8('a,b,c'), 'text/csv')).toBe('a,b,c')
  })
  it('extrait un docx (<w:t>)', async () => {
    const docx = zipSync({ 'word/document.xml': strToU8('<w:body><w:p><w:r><w:t>Hello docx</w:t></w:r></w:p></w:body>') })
    expect(await extractText(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toContain('Hello docx')
  })
  it('extrait un pptx (<a:t>)', async () => {
    const pptx = zipSync({ 'ppt/slides/slide1.xml': strToU8('<p:sld><a:t>Slide text</a:t></p:sld>') })
    expect(await extractText(pptx, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toContain('Slide text')
  })
  it('extrait un xlsx (sharedStrings <t>)', async () => {
    const xlsx = zipSync({ 'xl/sharedStrings.xml': strToU8('<sst><si><t>Cell value</t></si></sst>') })
    expect(await extractText(xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toContain('Cell value')
  })
  it('extrait un pdf (lib mockée)', async () => {
    expect(await extractText(new Uint8Array([1, 2, 3]), 'application/pdf')).toBe('Texte du PDF')
  })
  it('renvoie vide pour un type inconnu', async () => {
    expect(await extractText(strToU8('x'), 'image/png')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/subjects/extract-text.test.ts`
Expected: FAIL — `Cannot find module './extract-text'`.

- [ ] **Step 3: Implement**

Create `src/lib/subjects/extract-text.ts`:

```ts
import { unzipSync, strFromU8 } from 'fflate'

const MAX_CHARS = 200_000

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Concatène le texte des nœuds <tag>…</tag> d'un XML, en retirant les balises internes.
function xmlText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) out.push(m[1].replace(/<[^>]+>/g, ''))
  return out.join(' ')
}

function unzipText(bytes: Uint8Array, match: (name: string) => boolean, tag: string): string {
  const files = unzipSync(bytes)
  const parts: string[] = []
  for (const name of Object.keys(files)) {
    if (match(name)) parts.push(xmlText(strFromU8(files[name]), tag))
  }
  return parts.join('\n')
}

export async function extractText(bytes: Uint8Array, mime: string): Promise<string> {
  try {
    let text = ''
    if (mime === 'text/plain' || mime === 'text/csv') {
      text = new TextDecoder().decode(bytes)
    } else if (mime === 'application/pdf') {
      const { getDocumentProxy, extractText: pdfExtract } = await import('unpdf')
      const pdf = await getDocumentProxy(bytes)
      const r = await pdfExtract(pdf, { mergePages: true })
      text = Array.isArray(r.text) ? r.text.join('\n') : r.text
    } else if (mime === DOCX) {
      text = unzipText(bytes, (n) => n === 'word/document.xml', 'w:t')
    } else if (mime === PPTX) {
      text = unzipText(bytes, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n), 'a:t')
    } else if (mime === XLSX) {
      text = unzipText(bytes, (n) => n === 'xl/sharedStrings.xml', 't')
    }
    return text.slice(0, MAX_CHARS).trim()
  } catch (e) {
    console.error('extractText failed', mime, e instanceof Error ? e.message : e)
    return ''
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/subjects/extract-text.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/subjects/extract-text.ts src/lib/subjects/extract-text.test.ts
git commit -m "feat(rag): text extraction (pdf/txt/csv/docx/pptx/xlsx)"
```

---

### Task 3: Chunker générique `chunkText`

**Files:**
- Modify: `src/lib/rag/chunk.ts` (ajout en fin de fichier)
- Test: `src/lib/rag/chunk.test.ts` (ajout)

**Interfaces:**
- Consumes: `RawChunk` (déjà exporté).
- Produces: `chunkText(text: string, size?: number, overlap?: number): RawChunk[]` (défauts 1500 / 150).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/rag/chunk.test.ts`:

```ts
import { chunkText } from './chunk'

describe('chunkText', () => {
  it('renvoie [] pour vide', () => {
    expect(chunkText('   ')).toEqual([])
  })
  it('un seul chunk si court', () => {
    const c = chunkText('court texte')
    expect(c).toHaveLength(1)
    expect(c[0].content).toBe('court texte')
  })
  it('découpe un texte long en plusieurs chunks qui se chevauchent', () => {
    const text = 'a'.repeat(4000)
    const c = chunkText(text, 1500, 150)
    expect(c.length).toBeGreaterThan(1)
    expect(c.every((x) => x.content.length <= 1500)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/chunk.test.ts`
Expected: FAIL — `chunkText is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/rag/chunk.ts`:

```ts
/** Découpe un texte libre en segments ~`size` caractères avec `overlap` de chevauchement,
 *  en cherchant une frontière (saut de ligne / phrase / espace) près de la fin de chaque segment. */
export function chunkText(text: string, size = 1500, overlap = 150): RawChunk[] {
  const t = text.trim()
  if (!t) return []
  const chunks: RawChunk[] = []
  let i = 0
  while (i < t.length) {
    let end = Math.min(i + size, t.length)
    if (end < t.length) {
      const slice = t.slice(i, end)
      const br = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '))
      if (br > size - 200) end = i + br + 1
    }
    const content = t.slice(i, end).trim()
    if (content) chunks.push({ content })
    if (end >= t.length) break
    i = Math.max(end - overlap, i + 1)
  }
  return chunks
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/chunk.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/chunk.ts src/lib/rag/chunk.test.ts
git commit -m "feat(rag): generic chunkText splitter"
```

---

### Task 4: Indexation des documents `index-file.ts`

**Files:**
- Create: `src/lib/rag/index-file.ts`
- Test: `src/lib/rag/index-file.test.ts`

**Interfaces:**
- Consumes: `extractText` (Task 2), `chunkText` (Task 3), `SUBJECT_FILES_BUCKET`, `getEmbeddingProvider`, `createServiceClient`.
- Produces:
  - `indexSubjectFile(fileId: string, deps?): Promise<void>`
  - `deleteFileChunks(fileId: string, deps?): Promise<void>`
  - `deleteSubjectFileChunks(subjectId: string, deps?): Promise<void>`
  - `syncSubjectFileVisibility(subjectId: string, vals: { labo: string|null; confidentiel: boolean; is_transversal: boolean; visibility: 'public'|'member' }, deps?): Promise<void>`
  - `IndexFileDeps = { service?; provider?; extract? }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/rag/index-file.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

let fileRow: unknown = { id: 'f1', subject_id: 's1', storage_path: 's1/u', file_name: 'doc.pdf', mime_type: 'application/pdf' }
let subjectRow: unknown = { confidentiel: false, labo: 'paris', is_transversal: false }
let inserted: Record<string, unknown>[] = []
const deletedBy: Array<[string, unknown]> = []
const updated: Array<{ vals: unknown; filters: Array<[string, unknown]> }> = []

function chain(table: string) {
  const filters: Array<[string, unknown]> = []
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.eq = (c: string, v: unknown) => { filters.push([c, v]); return b }
  b.single = () => Promise.resolve({ data: table === 'subjects' ? subjectRow : fileRow, error: null })
  b.insert = (rows: Record<string, unknown>[]) => { inserted = rows; return Promise.resolve({ error: null }) }
  b.delete = () => ({ eq: (c: string, v: unknown) => { deletedBy.push([c, v]); const e2 = { eq: (c2: string, v2: unknown) => { deletedBy.push([c2, v2]); return Promise.resolve({ error: null }) } }; return Object.assign(Promise.resolve({ error: null }), e2) } })
  b.update = (vals: unknown) => { const f: Array<[string, unknown]> = []; const u = { eq: (c: string, v: unknown) => { f.push([c, v]); return u } }; updated.push({ vals, filters: f }); return Object.assign(Promise.resolve({ error: null }), u) }
  return b
}
const service = {
  from: (t: string) => chain(t),
  storage: { from: () => ({ download: async () => ({ data: { arrayBuffer: async () => new TextEncoder().encode('x').buffer }, error: null }) }) },
}
const provider = { embed: async (texts: string[]) => texts.map(() => [0.1, 0.2]) }

import { indexSubjectFile } from './index-file'

beforeEach(() => {
  fileRow = { id: 'f1', subject_id: 's1', storage_path: 's1/u', file_name: 'doc.pdf', mime_type: 'application/pdf' }
  subjectRow = { confidentiel: false, labo: 'paris', is_transversal: false }
  inserted = []; deletedBy.length = 0; updated.length = 0
})

describe('indexSubjectFile', () => {
  it('insère des chunks publics avec metadata pour un sujet public', async () => {
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => 'contenu du document' })
    expect(inserted.length).toBeGreaterThan(0)
    expect(inserted[0].source_type).toBe('subject_file')
    expect(inserted[0].source_id).toBe('f1')
    expect(inserted[0].visibility).toBe('public')
    expect(inserted[0].metadata).toEqual({ subject_id: 's1', file_name: 'doc.pdf' })
  })
  it('hérite visibility=member d\'un sujet confidentiel', async () => {
    subjectRow = { confidentiel: true, labo: 'paris', is_transversal: false }
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => 'contenu' })
    expect(inserted[0].visibility).toBe('member')
    expect(inserted[0].confidentiel).toBe(true)
  })
  it('n\'insère rien si l\'extraction est vide', async () => {
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => '' })
    expect(inserted).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/index-file.test.ts`
Expected: FAIL — `Cannot find module './index-file'`.

- [ ] **Step 3: Implement**

Create `src/lib/rag/index-file.ts`:

```ts
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
  await service.from('rag_chunks').delete().eq('source_id', fileId)
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

export async function indexSubjectFile(fileId: string, deps: IndexFileDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const provider = deps.provider ?? getEmbeddingProvider()
  const extract = deps.extract ?? extractText

  const { data: file } = await service.from('subject_files').select('*').eq('id', fileId).single()
  if (!file) { await deleteFileChunks(fileId, { service }); return }

  const { data: subject } = await service.from('subjects').select('confidentiel,labo,is_transversal').eq('id', file.subject_id).single()
  // FAIL-CLOSED : sujet introuvable → confidentiel (jamais de fuite).
  const confidentiel = subject ? !!subject.confidentiel : true
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/index-file.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/index-file.ts src/lib/rag/index-file.test.ts
git commit -m "feat(rag): index/delete/sync subject file chunks"
```

---

### Task 5: Retrieval — `metadata` + `retrieveSubjectFiles`

**Files:**
- Modify: `src/lib/rag/retrieve.ts`
- Test: `src/lib/rag/retrieve.test.ts` (ajout)

**Interfaces:**
- Produces: `RetrievedChunk` gagne `metadata?: Record<string, unknown>` ; `retrieveSubjectFiles(query: string, subjectId: string, deps?: RetrieveDeps): Promise<RetrievedChunk[]>`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/rag/retrieve.test.ts`:

```ts
import { retrieveSubjectFiles } from './retrieve'

describe('retrieveSubjectFiles', () => {
  const provider = { embed: async () => [[0.1, 0.2]] }
  it('appelle match_subject_files scopé au sujet et filtre par seuil', async () => {
    const calls: Array<[string, Record<string, unknown>]> = []
    const service = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push([fn, args])
        return { data: [
          { id: '1', source_type: 'subject_file', source_id: 'f1', content: 'a', labo: 'paris', lang: 'en', metadata: { subject_id: 's1' }, similarity: 0.9 },
          { id: '2', source_type: 'subject_file', source_id: 'f2', content: 'b', labo: 'paris', lang: 'en', metadata: { subject_id: 's1' }, similarity: 0.1 },
        ], error: null }
      },
    }
    const out = await retrieveSubjectFiles('query', 's1', { service: service as never, provider: provider as never, threshold: 0.3 })
    expect(calls[0][0]).toBe('match_subject_files')
    expect(calls[0][1].p_subject_id).toBe('s1')
    expect(out).toHaveLength(1)
    expect(out[0].source_id).toBe('f1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/retrieve.test.ts`
Expected: FAIL — `retrieveSubjectFiles is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/rag/retrieve.ts`, add `metadata` to the interface (after `similarity: number`):

```ts
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
```

Append at the end of the file:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/rag/retrieve.test.ts`
Expected: PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/retrieve.ts src/lib/rag/retrieve.test.ts
git commit -m "feat(rag): retrieve returns metadata + retrieveSubjectFiles (subject-scoped)"
```

---

### Task 6: Hooks d'indexation (upload/suppression/sync visibilité)

**Files:**
- Modify: `src/lib/rag/schedule.ts`
- Modify: `src/lib/rag/index-source.ts` (sync visibilité dans la branche `subject`)
- Modify: `src/app/api/subjects/[id]/files/route.ts` (register → index)
- Modify: `src/app/api/subjects/[id]/files/[fileId]/route.ts` (delete → purge)
- Modify: `src/app/api/subjects/[id]/route.ts` (DELETE sujet → purge chunks docs)
- Test: `src/lib/rag/schedule.test.ts` (ajout)

**Interfaces:**
- Consumes: `indexSubjectFile`, `deleteFileChunks`, `deleteSubjectFileChunks`, `syncSubjectFileVisibility` (Task 4).
- Produces: `scheduleIndexFile(fileId: string): void`, `scheduleDeleteFileChunks(fileId: string): void`, `scheduleDeleteSubjectFiles(subjectId: string): void`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/rag/schedule.test.ts`:

```ts
import { scheduleIndexFile, scheduleDeleteFileChunks, scheduleDeleteSubjectFiles } from './schedule'
import * as indexFile from './index-file'

describe('schedule file helpers', () => {
  it('scheduleIndexFile appelle indexSubjectFile', async () => {
    const spy = vi.spyOn(indexFile, 'indexSubjectFile').mockResolvedValue()
    scheduleIndexFile('f1')
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith('f1')
  })
  it('scheduleDeleteFileChunks appelle deleteFileChunks', async () => {
    const spy = vi.spyOn(indexFile, 'deleteFileChunks').mockResolvedValue()
    scheduleDeleteFileChunks('f1')
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith('f1')
  })
  it('scheduleDeleteSubjectFiles appelle deleteSubjectFileChunks', async () => {
    const spy = vi.spyOn(indexFile, 'deleteSubjectFileChunks').mockResolvedValue()
    scheduleDeleteSubjectFiles('s1')
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith('s1')
  })
})
```

> NB : `schedule.test.ts` doit mocker `next/server`'s `after` pour exécuter le callback immédiatement. Si ce n'est pas déjà le cas en tête de fichier, ajouter : `vi.mock('next/server', () => ({ after: (fn: () => void) => { fn() } }))`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/rag/schedule.test.ts`
Expected: FAIL — `scheduleIndexFile is not a function`.

- [ ] **Step 3: Implement schedule helpers**

In `src/lib/rag/schedule.ts`, add the import and three helpers:

```ts
import { indexSubjectFile, deleteFileChunks, deleteSubjectFileChunks } from './index-file'

export function scheduleIndexFile(fileId: string): void {
  after(async () => { try { await indexSubjectFile(fileId) } catch { /* avalé */ } })
}
export function scheduleDeleteFileChunks(fileId: string): void {
  after(async () => { try { await deleteFileChunks(fileId) } catch { /* avalé */ } })
}
export function scheduleDeleteSubjectFiles(subjectId: string): void {
  after(async () => { try { await deleteSubjectFileChunks(subjectId) } catch { /* avalé */ } })
}
```

- [ ] **Step 4: Sync visibilité à la réindexation du sujet**

In `src/lib/rag/index-source.ts`, add import:

```ts
import { syncSubjectFileVisibility } from './index-file'
```

In `indexSource`, after `await replaceChunks(service, provider, type, id, batch)`, add:

```ts
  if (type === 'subject') {
    await syncSubjectFileVisibility(id, {
      labo: batch.labo, confidentiel: batch.confidentiel,
      is_transversal: batch.is_transversal, visibility: batch.visibility,
    }, { service })
  }
```

- [ ] **Step 5: Wire the endpoints**

In `src/app/api/subjects/[id]/files/route.ts`, add import `import { scheduleIndexFile } from '@/lib/rag/schedule'` and, just before `return NextResponse.json(data, { status: 201 })`, add: `scheduleIndexFile(data.id)`.

In `src/app/api/subjects/[id]/files/[fileId]/route.ts` (DELETE), add import `import { scheduleDeleteFileChunks } from '@/lib/rag/schedule'` and call `scheduleDeleteFileChunks(fileId)` just before the final `return NextResponse.json({ ok: true })` of DELETE.

In `src/app/api/subjects/[id]/route.ts` (DELETE), add import `import { scheduleDeleteSubjectFiles } from '@/lib/rag/schedule'` and call `scheduleDeleteSubjectFiles(id)` after the existing `scheduleReindex('subject', id)`.

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run src/lib/rag/schedule.test.ts && npx tsc --noEmit`
Expected: schedule tests PASS ; tsc exit 0.

> If existing route tests for `files/route.ts`, `files/[fileId]/route.ts`, or `subjects/[id]/route.ts` now fail because the new schedule import calls `after` outside a request, add `vi.mock('@/lib/rag/schedule', () => ({ scheduleIndexFile: () => {}, scheduleDeleteFileChunks: () => {}, scheduleDeleteSubjectFiles: () => {}, scheduleReindex: () => {} }))` to those test files (preserving any helpers they already use). Run `npx vitest run src/app/api/subjects` to confirm green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rag/schedule.ts src/lib/rag/schedule.test.ts src/lib/rag/index-source.ts "src/app/api/subjects/[id]/files/route.ts" "src/app/api/subjects/[id]/files/[fileId]/route.ts" "src/app/api/subjects/[id]/route.ts"
git commit -m "feat(rag): index files on upload, purge on delete, sync visibility on subject reindex"
```

---

### Task 7: Génération assistée enrichie par les documents

**Files:**
- Modify: `src/lib/subjects/field-prompts.ts` (`buildFieldPrompt` + param `context`)
- Modify: `src/lib/subjects/generate-field.ts` (passe `context`)
- Modify: `src/app/api/subjects/assist/route.ts` (retrieve + passe context)
- Modify: `src/components/lab/VitrineEditor.tsx:165` (envoie `subjectId`)
- Test: `src/lib/subjects/field-prompts.test.ts` (ajout) ; `src/app/api/subjects/assist/route.test.ts` (créer si absent)

**Interfaces:**
- Consumes: `retrieveSubjectFiles` (Task 5).
- Produces: `buildFieldPrompt(field, draft, locale, context?: string)` ; `generateField(field, draft, locale, deps?, context?: string)`.

- [ ] **Step 1: Write the failing test (prompt)**

Append to `src/lib/subjects/field-prompts.test.ts`:

```ts
it('injecte les extraits de documents quand context est fourni', () => {
  const p = buildFieldPrompt('context', { titre: 'T' }, 'fr', 'EXTRAIT DOC ABC')
  expect(p.user).toContain('EXTRAIT DOC ABC')
  expect(p.displayPrompt).toContain('EXTRAIT DOC ABC')
})
it('ne change pas le prompt sans context', () => {
  const p = buildFieldPrompt('context', { titre: 'T' }, 'fr')
  expect(p.user).not.toContain('Extraits des documents')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/subjects/field-prompts.test.ts`
Expected: FAIL (extraits absents).

- [ ] **Step 3: Implement `buildFieldPrompt`**

In `src/lib/subjects/field-prompts.ts`, change the signature and body of `buildFieldPrompt`:

```ts
export function buildFieldPrompt(field: AssistField, draft: FieldDraft, locale: Locale, context?: string): FieldPrompt {
  const fr = locale === 'fr'
  const system = fr
    ? "Tu es un assistant de rédaction scientifique pour un laboratoire de recherche (finance, économie, IA). Écris dans un français idiomatique, mais garde tels quels les termes que les chercheurs laissent en l'état : sigles/acronymes (LLM, LLMs, NLP, GPT, RAG, API, ML…), termes techniques anglais usuels (machine learning, embedding, transformer, dataset, benchmark, prompt…), noms propres, produits, modèles, jeux de données, code, symboles et unités. Ne traduis pas et n'explicite pas ces termes. Réponds uniquement avec le texte demandé : pas de guillemets, pas de préambule, pas d'explication."
    : 'You are a scientific writing assistant for a research lab (finance, economics, AI). Write idiomatically, but keep verbatim the terms researchers leave as-is: acronyms/initialisms (LLM, LLMs, NLP, GPT, RAG, API, ML…), established English technical terms (machine learning, embedding, transformer, dataset, benchmark, prompt…), proper nouns, products, models, datasets, code, symbols and units. Do not translate or expand these terms. Reply with only the requested text: no quotes, no preamble, no explanation.'
  const ctxLabel = fr ? 'Informations du sujet' : 'Subject information'
  let user = `${INSTRUCTIONS[field][locale]}\n\n${ctxLabel} :\n${draftContext(draft, locale)}`
  if (context && context.trim()) {
    const docLabel = fr ? 'Extraits des documents joints (utilise-les si pertinents)' : 'Excerpts from attached documents (use if relevant)'
    user += `\n\n${docLabel} :\n${context.trim().slice(0, 3000)}`
  }
  return { system, user, displayPrompt: user }
}
```

> NB : ce `system` reprend la règle « garder les termes techniques » déjà en place ; ne pas la perdre en éditant.

- [ ] **Step 4: Implement `generateField` context passthrough**

In `src/lib/subjects/generate-field.ts`, change the signature to add `context` after `deps`, and pass it:

```ts
export async function generateField(
  field: AssistField,
  draft: FieldDraft,
  locale: Locale,
  deps: GenerateDeps = {},
  context?: string,
): Promise<string> {
  const { system, user } = buildFieldPrompt(field, draft, locale, context)
  // …reste inchangé…
```

- [ ] **Step 5: Wire the assist route**

In `src/app/api/subjects/assist/route.ts`:
- add import `import { retrieveSubjectFiles } from '@/lib/rag/retrieve'`
- read `subjectId`: `const { field, draft = {}, locale = 'en', subjectId } = body as { field?: string; draft?: FieldDraft; locale?: string; subjectId?: string }`
- replace the generation block with:

```ts
  try {
    let context: string | undefined
    if (subjectId && typeof subjectId === 'string') {
      const query = `${draft.titre ?? ''} ${draft.question ?? ''} ${field}`.trim() || field
      const chunks = await retrieveSubjectFiles(query, subjectId, { matchCount: 4 })
      if (chunks.length) context = chunks.map((c) => c.content).join('\n\n')
    }
    const text = await generateField(field, draft, locale === 'fr' ? 'fr' : 'en', {}, context)
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
```

- [ ] **Step 6: Editor sends subjectId**

In `src/components/lab/VitrineEditor.tsx` (the `generate` function, ~line 165), change the fetch body to include the subject id:

```ts
        body: JSON.stringify({ field, draft: currentDraft(), locale, subjectId: subject?.id }),
```

(`subject` is the `Subject | null` prop; `subject?.id` is `undefined` for a new fiche — the route then skips retrieval.)

- [ ] **Step 7: Run tests + typecheck + build**

Run: `npx vitest run src/lib/subjects/field-prompts.test.ts src/lib/subjects/generate-field.test.ts && npx tsc --noEmit`
Expected: PASS ; exit 0.

> If `src/app/api/subjects/assist/route.test.ts` exists and breaks, update it to mock `@/lib/rag/retrieve` (`retrieveSubjectFiles: async () => []`). If it does not exist, no new test is required here (the prompt-level behavior is covered by Step 1).

- [ ] **Step 8: Commit**

```bash
git add src/lib/subjects/field-prompts.ts src/lib/subjects/field-prompts.test.ts src/lib/subjects/generate-field.ts "src/app/api/subjects/assist/route.ts" src/components/lab/VitrineEditor.tsx
git commit -m "feat(subjects): assisted generation uses this subject's indexed documents"
```

---

### Task 8: Astra — citations attribuables vers le sujet parent

**Files:**
- Modify: `src/lib/assistant/types.ts:1` (`SourceRef`)
- Modify: `src/app/api/assistant/chat/route.ts:102` (mapping `sources`)
- Modify: `src/lib/rag/system-prompt.ts:4` (libellé `subject_file`)
- Modify: `src/components/assistant/SourceCitations.tsx` (lien `subject_file`)
- Test: `src/lib/rag/system-prompt.test.ts` (ajout) ; `src/components/assistant/SourceCitations.test.tsx` (créer)

**Interfaces:**
- Consumes: `RetrievedChunk.metadata` (Task 5).
- Produces: `SourceRef` gagne `subject_id?: string`, `file_name?: string`.

- [ ] **Step 1: Write the failing test (system-prompt label)**

Append to `src/lib/rag/system-prompt.test.ts`:

```ts
it('étiquette un chunk subject_file avec le nom de fichier', () => {
  const chunks = [{ id: '1', source_type: 'subject_file' as const, source_id: 'f1', content: 'C', labo: 'paris', lang: 'en', similarity: 0.9, metadata: { file_name: 'rapport.pdf' } }]
  const prompt = buildSystemPrompt('member', chunks) // signature confirmée : (tier, chunks)
  expect(prompt).toContain('rapport.pdf')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/rag/system-prompt.test.ts`
Expected: FAIL (nom de fichier absent).

- [ ] **Step 3: Implement label**

In `src/lib/rag/system-prompt.ts`, change the context map (line ~4) so a `subject_file` chunk shows its file name:

```ts
  const context = chunks.map((c, i) => {
    const label = c.source_type === 'subject_file'
      ? `subject_file:${(c.metadata as { file_name?: string } | undefined)?.file_name ?? c.source_id}`
      : `${c.source_type}:${c.source_id}`
    return `[Source ${i + 1} | ${label}]\n${c.content}`
  }).join('\n\n')
```

- [ ] **Step 4: Extend `SourceRef` + chat mapping**

In `src/lib/assistant/types.ts` line 1:

```ts
export interface SourceRef { source_type: string; source_id: string; labo: string | null; subject_id?: string; file_name?: string }
```

In `src/app/api/assistant/chat/route.ts` line ~102, replace the `sources` map:

```ts
  const sources = chunks.map(c => c.source_type === 'subject_file'
    ? { source_type: c.source_type, source_id: c.source_id, labo: c.labo, subject_id: (c.metadata as { subject_id?: string } | undefined)?.subject_id, file_name: (c.metadata as { file_name?: string } | undefined)?.file_name }
    : { source_type: c.source_type, source_id: c.source_id, labo: c.labo })
```

- [ ] **Step 5: Write the failing test (citation render)**

Create `src/components/assistant/SourceCitations.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceCitations } from './SourceCitations'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))

describe('SourceCitations', () => {
  it('lie un document au sujet parent avec le nom de fichier', () => {
    render(<SourceCitations sources={[{ source_type: 'subject_file', source_id: 'f1', labo: 'paris', subject_id: 's1', file_name: 'rapport.pdf' }]} locale="fr" lab="paris" />)
    const link = screen.getByText('rapport.pdf').closest('a')
    expect(link?.getAttribute('href')).toBe('/fr/paris/paper/s1')
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/components/assistant/SourceCitations.test.tsx`
Expected: FAIL (pas de lien `subject_file`).

- [ ] **Step 7: Implement citation link**

In `src/components/assistant/SourceCitations.tsx`, replace the `.map` body:

```tsx
      {sources.map((s, i) => {
        const labo = s.labo ?? lab
        const isFile = s.source_type === 'subject_file'
        const target = isFile ? s.subject_id : s.source_id
        if ((s.source_type === 'subject' || isFile) && labo && target) {
          return (
            <Link key={i} href={`/${locale}/${labo}/paper/${target}`} className="underline hover:text-fame-blue mr-2">
              {isFile ? (s.file_name ?? 'document') : `${s.source_type}:${s.source_id.slice(0, 8)}`}
            </Link>
          )
        }
        return <span key={i} className="mr-2">{s.source_type}</span>
      })}
```

- [ ] **Step 8: Run tests + typecheck**

Run: `npx vitest run src/lib/rag/system-prompt.test.ts src/components/assistant/SourceCitations.test.tsx && npx tsc --noEmit`
Expected: PASS ; exit 0.

> If `src/app/api/assistant/chat/route.test.ts` breaks on the `metadata`/sources change, update its retrieved-chunk fixtures to include `metadata` and assert the `subject_file` source carries `subject_id`/`file_name`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/assistant/types.ts "src/app/api/assistant/chat/route.ts" src/lib/rag/system-prompt.ts src/components/assistant/SourceCitations.tsx src/lib/rag/system-prompt.test.ts src/components/assistant/SourceCitations.test.tsx
git commit -m "feat(assistant): attributable citations for document chunks (link to subject)"
```

---

### Task 9: Vérification finale + STATUS

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Full suite + checks**

Run: `npx vitest run && npx tsc --noEmit && npx eslint && npx next build`
Expected: tout vert / exit 0.

- [ ] **Step 2: Update STATUS**

Add under « Où on en est » in `docs/STATUS.md`:

```markdown
- **Documents de fiche dans le RAG** (branche `feat/subject-files-rag`) : à l'upload, le texte d'un document (pdf/txt/csv/docx/xlsx/pptx, via `unpdf`+`fflate`) est extrait, chunké et indexé dans `rag_chunks` (`source_type='subject_file'`, visibilité héritée du sujet, `metadata={subject_id,file_name}`). Génération assistée : RPC `match_subject_files` scopée au sujet (k=4). Assistant Astra : sert ces docs selon confi/public (visibilité resynchronisée à la réindexation du sujet), citations liées au sujet parent. **Migration `011` à appliquer en BDD.** Spec/plan : `docs/superpowers/{specs,plans}/2026-06-28-subject-files-rag*.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): subject files into RAG"
```

---

## Notes de déploiement (hors code)

- **Appliquer `011_subject_files_rag.sql`** (dev + prod) avant usage — sinon `match_subject_files` / le type `subject_file` manquent.
- Non rétroactif : les documents déjà uploadés ne seront indexés qu'au prochain (ré-)upload. Backfill manuel optionnel (hors scope).
- Vérif navigateur : uploader un PDF/Word texte sur une fiche → générer un champ (le contexte doit s'en inspirer) ; demander à Astra (membre) un détail du document → réponse + citation cliquable vers le sujet ; vérifier qu'un visiteur n'obtient rien d'un document de sujet confidentiel.
