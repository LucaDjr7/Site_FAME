# Assistant RAG — P1 : Socle données & indexation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le modèle de données vectoriel, le provider d'embeddings OpenAI, la transformation du contenu FAME en chunks vectorisés (BDD + KB Markdown), l'indexation à l'écriture + un backfill, et rendre les membres publics (sans email).

**Architecture:** Une migration additive (`006`) ajoute `subjects.confidentiel`, l'extension `pgvector`, la table `rag_chunks` (qui porte les colonnes de filtrage `visibility/labo/confidentiel/is_transversal/lang`) et les tables d'exploitation du chat. Un provider d'embeddings derrière une interface swappable (OpenAI via `fetch`). Un module `rag/` pur (chunking) + intégration (indexeur lisant la BDD, embeddant, upsertant). Les routes d'écriture existantes déclenchent une ré-indexation post-réponse via `after()`.

**Tech Stack:** Next.js 16.2.9 (App Router, `after` de `next/server`), TypeScript strict (`noUncheckedIndexedAccess`), Supabase (`@supabase/supabase-js` service-role sans cookies), pgvector, OpenAI Embeddings API (`text-embedding-3-large`, `dimensions: 1536`), Vitest 3 (env `node`).

## Global Constraints

- **Secrets server-only** : `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ne sont JAMAIS préfixés `NEXT_PUBLIC_`. Seuls `NEXT_PUBLIC_{SUPABASE_URL,SUPABASE_ANON_KEY,APP_URL}` le sont.
- **Écritures via service-role SANS cookies** : utiliser `createServiceClient()` de `src/lib/supabase/server.ts` (jamais le client cookie pour les mutations). Le service-role contourne RLS, c'est intentionnel.
- **Lab slug** : `paris` | `montreal`, minuscules, validé via `VALID_LABS` de `src/lib/constants.ts`.
- **Embeddings** : modèle `text-embedding-3-large`, `dimensions: 1536` (réduction native) → `vector(1536)`.
- **Email membre = PII** : ne JAMAIS faire figurer un email dans `rag_chunks.content` ni dans une projection publique.
- **Confidentialité = filtre query-time** : un sujet confidentiel EST vectorisé avec `visibility='member'` + `confidentiel=true` ; il n'est jamais renvoyé à un visiteur (filtre appliqué en P2, pas à l'indexation).
- **Tests** : Vitest, fichiers `src/**/*.test.ts`, env `node`. Mocker `@/lib/supabase/server` et le provider (pattern : `src/app/api/proposals/route.test.ts`).
- **Pas de dépendance npm `openai`** : appels via `fetch` (injectable pour les tests).
- **TS strict** : `noUncheckedIndexedAccess` actif — tout accès indexé (`arr[0]`, `data[i]`) est `T | undefined`, à garder.
- **Commits atomiques** ; message terminé par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- `supabase/migrations/006_assistant_rag.sql` — migration additive (confidentiel + pgvector + tables).
- `src/types/index.ts` — ajout `Subject.confidentiel` + nouveaux types RAG.
- `src/lib/llm/provider.ts` — interfaces `EmbeddingProvider` (+ `ChatProvider` ajouté en P2).
- `src/lib/llm/openai.ts` — implémentation OpenAI (embeddings) via `fetch`.
- `src/lib/llm/index.ts` — factory `getEmbeddingProvider()` (sélection par env).
- `src/lib/rag/chunk.ts` — fonctions pures de découpage par type de source.
- `src/lib/rag/kb.ts` — chargement + découpage des fichiers `docs/kb/*.md`.
- `src/lib/rag/index-source.ts` — indexeur (lit BDD, chunke, embedde, upsert/delete).
- `src/lib/rag/schedule.ts` — `scheduleReindex(type, id)` via `after()`.
- `src/scripts/index-rag.ts` — script de backfill (`npm run index:rag`).
- `docs/kb/about-fame.md`, `docs/kb/faq.md` — KB de démarrage (placeholder éditorial assumé, voir Task 4).
- Modifs : `src/app/api/subjects/route.ts`, `src/app/api/subjects/[id]/route.ts`, `src/app/api/publications/route.ts`, `src/app/api/publications/[id]/route.ts`, `src/app/api/prompts/route.ts`, `src/app/api/prompts/[id]/route.ts` (hooks embed-on-write).
- Modifs : `src/app/api/members/route.ts` (lecture publique sans email) + page Team (accès visiteur).

---

### Task 1: Migration 006 + types

**Files:**
- Create: `supabase/migrations/006_assistant_rag.sql`
- Modify: `src/types/index.ts`
- Test: `src/lib/rag/types.test.ts`

**Interfaces:**
- Produces: `Subject.confidentiel: boolean` ; types `RagSourceType`, `RagVisibility`, `RagChunkRow`, `ChatUsageRow`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/006_assistant_rag.sql`:

```sql
-- Assistant RAG — socle données (additif, réversible).
-- Confidentialité des sujets + extension vecteurs + index RAG + tables d'exploitation chat.

-- 1. Flag de confidentialité (public par défaut — comportement actuel préservé).
alter table subjects add column confidentiel boolean not null default false;

-- 2. Extension vecteurs (Supabase la fournit ; idempotent).
create extension if not exists vector;

-- 3. Index vectoriel : un chunk = un extrait vectorisé d'une source.
--    visibility/labo/confidentiel/is_transversal/lang = colonnes de FILTRAGE query-time.
create table rag_chunks (
  id              uuid primary key default gen_random_uuid(),
  source_type     text not null check (source_type in ('subject','task','publication','prompt','member','kb')),
  source_id       text not null,
  labo            text check (labo in ('paris','montreal')),
  is_transversal  boolean not null default false,
  confidentiel    boolean not null default false,
  visibility      text not null check (visibility in ('public','member')),
  lang            text not null default 'en',
  content         text not null,
  embedding       vector(1536),
  token_count     integer not null default 0,
  embedding_stale boolean not null default false,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index rag_chunks_source_idx on rag_chunks (source_type, source_id);
create index rag_chunks_embedding_idx on rag_chunks using hnsw (embedding vector_cosine_ops);
alter table rag_chunks enable row level security; -- service-role only (aucune policy)

-- 4. Rate-limit persistant (fenêtre fixe bucketée : key + window_start).
create table chat_rate_limit (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);
alter table chat_rate_limit enable row level security;

-- 5. Comptabilité mensuelle (base du kill-switch budget).
create table chat_usage (
  month        text primary key,            -- 'YYYY-MM'
  tokens_in    bigint not null default 0,
  tokens_out   bigint not null default 0,
  est_cost_usd numeric not null default 0,
  updated_at   timestamptz not null default now()
);
alter table chat_usage enable row level security;

-- 6. Journalisation ciblée (conservation C — pas de transcription intégrale).
create table chat_unanswered (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  lang       text not null default 'en',
  ip_hash    text,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table chat_unanswered enable row level security;

create table chat_flagged (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  reason     text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);
alter table chat_flagged enable row level security;

-- 7. Réglages applicatifs (kill-switch manuel, doublé par env ASSISTANT_DISABLED).
create table app_settings (
  key   text primary key,
  value jsonb not null
);
alter table app_settings enable row level security;
insert into app_settings (key, value) values ('assistant_enabled', 'true'::jsonb)
  on conflict (key) do nothing;
```

- [ ] **Step 2: Write the failing type test**

Create `src/lib/rag/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Subject } from '@/types'
import type { RagSourceType, RagVisibility, RagChunkRow } from '@/types'

describe('RAG types', () => {
  it('Subject porte confidentiel:boolean', () => {
    const s: Pick<Subject, 'confidentiel'> = { confidentiel: false }
    expect(s.confidentiel).toBe(false)
  })
  it('RagChunkRow a la forme attendue', () => {
    const row: RagChunkRow = {
      id: '1', source_type: 'subject' as RagSourceType, source_id: 'x',
      labo: 'paris', is_transversal: false, confidentiel: false,
      visibility: 'public' as RagVisibility, lang: 'en', content: 'c',
      embedding: null, token_count: 0, embedding_stale: false, metadata: {},
    }
    expect(row.visibility).toBe('public')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/rag/types.test.ts`
Expected: FAIL — `confidentiel` / `RagChunkRow` n'existent pas encore.

- [ ] **Step 4: Add the types**

In `src/types/index.ts`, add `confidentiel: boolean` to the `Subject` interface (next to `is_transversal`), then append:

```ts
// ── Assistant RAG ────────────────────────────────────────────────────────
export type RagSourceType = 'subject' | 'task' | 'publication' | 'prompt' | 'member' | 'kb'
export type RagVisibility = 'public' | 'member'

export interface RagChunkRow {
  id: string
  source_type: RagSourceType
  source_id: string
  labo: 'paris' | 'montreal' | null
  is_transversal: boolean
  confidentiel: boolean
  visibility: RagVisibility
  lang: string
  content: string
  embedding: number[] | null
  token_count: number
  embedding_stale: boolean
  metadata: Record<string, unknown>
}

export interface ChatUsageRow {
  month: string
  tokens_in: number
  tokens_out: number
  est_cost_usd: number
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/rag/types.test.ts && npx tsc --noEmit`
Expected: PASS, 0 erreur TS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/006_assistant_rag.sql src/types/index.ts src/lib/rag/types.test.ts
git commit -m "feat(rag): migration 006 (confidentiel + pgvector + tables chat) + types RAG

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Provider d'embeddings OpenAI (swappable)

**Files:**
- Create: `src/lib/llm/provider.ts`, `src/lib/llm/openai.ts`, `src/lib/llm/index.ts`
- Test: `src/lib/llm/openai.test.ts`

**Interfaces:**
- Produces:
  - `interface EmbeddingProvider { embed(texts: string[]): Promise<number[][]> }`
  - `createOpenAIEmbeddingProvider(opts: { apiKey: string; model: string; dimensions: number; fetchImpl?: typeof fetch }): EmbeddingProvider`
  - `getEmbeddingProvider(): EmbeddingProvider` (lit `OPENAI_API_KEY`, `ASSISTANT_EMBED_MODEL`)

- [ ] **Step 1: Write the failing test**

Create `src/lib/llm/openai.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { createOpenAIEmbeddingProvider } from './openai'

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch
}

describe('createOpenAIEmbeddingProvider', () => {
  it('poste model+input+dimensions et renvoie les vecteurs dans l’ordre', async () => {
    const fetchImpl = fakeFetch({ data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }] })
    const p = createOpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'm', dimensions: 1536, fetchImpl })
    const out = await p.embed(['a', 'b'])
    expect(out).toEqual([[0.1, 0.2], [0.3, 0.4]])
    const call = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!
    expect(call[0]).toBe('https://api.openai.com/v1/embeddings')
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body).toMatchObject({ model: 'm', input: ['a', 'b'], dimensions: 1536 })
    expect((call[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sk-x' })
  })

  it('chaîne vide → renvoie [] sans appel réseau', async () => {
    const fetchImpl = fakeFetch({ data: [] })
    const p = createOpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'm', dimensions: 1536, fetchImpl })
    expect(await p.embed([])).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('statut non-2xx → lève', async () => {
    const p = createOpenAIEmbeddingProvider({ apiKey: 'sk-x', model: 'm', dimensions: 1536, fetchImpl: fakeFetch({ error: 'x' }, 500) })
    await expect(p.embed(['a'])).rejects.toThrow(/embeddings/i)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/llm/openai.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Implement the provider interface and OpenAI impl**

Create `src/lib/llm/provider.ts`:

```ts
// Interface fournisseur LLM — swappable par env. P1 : embeddings uniquement.
// (ChatProvider sera ajouté en P2.)
export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}
```

Create `src/lib/llm/openai.ts`:

```ts
import type { EmbeddingProvider } from './provider'

interface OpenAIEmbeddingResponse {
  data: { embedding: number[] }[]
}

export function createOpenAIEmbeddingProvider(opts: {
  apiKey: string
  model: string
  dimensions: number
  fetchImpl?: typeof fetch
}): EmbeddingProvider {
  const doFetch = opts.fetchImpl ?? fetch
  return {
    async embed(texts) {
      if (texts.length === 0) return []
      const res = await doFetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: opts.model, input: texts, dimensions: opts.dimensions }),
      })
      if (!res.ok) {
        throw new Error(`OpenAI embeddings failed: ${res.status}`)
      }
      const json = (await res.json()) as OpenAIEmbeddingResponse
      return json.data.map(d => d.embedding)
    },
  }
}
```

Create `src/lib/llm/index.ts`:

```ts
import type { EmbeddingProvider } from './provider'
import { createOpenAIEmbeddingProvider } from './openai'

export type { EmbeddingProvider } from './provider'

const EMBED_DIMENSIONS = 1536

export function getEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  const model = process.env.ASSISTANT_EMBED_MODEL ?? 'text-embedding-3-large'
  return createOpenAIEmbeddingProvider({ apiKey, model, dimensions: EMBED_DIMENSIONS })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/llm/openai.test.ts && npx tsc --noEmit`
Expected: PASS, 0 erreur TS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/
git commit -m "feat(rag): provider d'embeddings OpenAI swappable (fetch, dim 1536)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Chunking des sources (fonctions pures)

**Files:**
- Create: `src/lib/rag/chunk.ts`
- Test: `src/lib/rag/chunk.test.ts`

**Interfaces:**
- Consumes: types `Subject`, `Publication`, `Prompt`, `Member`, `Task` de `@/types`.
- Produces : pour chaque source, une fonction `chunk<X>(row): RawChunk[]` où
  `interface RawChunk { content: string }`. Le contenu préfixe le titre du sujet pour l'ancrage. **Aucun email** dans un chunk membre.

- [ ] **Step 1: Write the failing test**

Create `src/lib/rag/chunk.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { chunkSubject, chunkPublication, chunkPrompt, chunkMember } from './chunk'

describe('chunkSubject', () => {
  const base = {
    id: 's1', labo: 'paris' as const, titre: 'Inflation dynamics', kicker: 'Macro',
    statut: 'active' as const, context: 'Ctx text', method: 'Method text', results: '',
    keywords: ['inflation'], auteurs: [], difficulte: 'intermediate' as const,
    dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 0,
    is_transversal: false, confidentiel: false,
    created_at: '', updated_at: '',
  }
  it('crée un chunk par champ non vide, préfixé du titre', () => {
    const chunks = chunkSubject(base)
    expect(chunks.length).toBe(2) // context + method (results vide ignoré)
    expect(chunks[0]!.content).toContain('Inflation dynamics')
    expect(chunks[0]!.content).toContain('Ctx text')
  })
  it('ignore les champs vides', () => {
    expect(chunkSubject({ ...base, context: '', method: '', results: '' }).length).toBe(0)
  })
})

describe('chunkMember', () => {
  it('n’inclut jamais l’email', () => {
    const chunks = chunkMember({
      id: 'm1', prenom: 'Ada', nom: 'Lovelace', email: 'ada@x.org',
      role: 'researcher', labo: 'paris', domaines: ['finance'], photo_url: null, is_admin: false,
    })
    expect(chunks.length).toBe(1)
    expect(chunks[0]!.content).toContain('Ada Lovelace')
    expect(chunks[0]!.content).not.toContain('ada@x.org')
  })
})

describe('chunkPublication / chunkPrompt', () => {
  it('publication → 1 chunk bibliographique', () => {
    const c = chunkPublication({ id: 'p1', labo: 'paris', titre: 'Paper T', auteurs: ['X'], annee: 2024, type: 'article', revue_ou_conf: 'JE', lien: null, created_at: '' })
    expect(c.length).toBe(1)
    expect(c[0]!.content).toContain('Paper T')
    expect(c[0]!.content).toContain('2024')
  })
  it('prompt → 1 chunk (titre + texte)', () => {
    const c = chunkPrompt({ id: 'pr1', labo: 'paris', titre: 'Lit review', type_cible: 'subject', texte: 'Do X', is_transversal: false, created_by: null, created_at: '' })
    expect(c[0]!.content).toContain('Lit review')
    expect(c[0]!.content).toContain('Do X')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/rag/chunk.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Implement chunk.ts**

Create `src/lib/rag/chunk.ts`:

```ts
import type { Subject, Publication, Prompt, Member, Task } from '@/types'

export interface RawChunk {
  content: string
}

/** Un chunk par champ logique du sujet (context/method/results), préfixé du titre + kicker pour l'ancrage. */
export function chunkSubject(s: Subject): RawChunk[] {
  const head = s.kicker ? `${s.titre} — ${s.kicker}` : s.titre
  const fields: [string, string][] = [
    ['Context', s.context],
    ['Method', s.method],
    ['Results', s.results],
  ]
  return fields
    .filter(([, v]) => v && v.trim().length > 0)
    .map(([label, v]) => ({ content: `${head}\n${label}: ${v.trim()}` }))
}

export function chunkPublication(p: Publication): RawChunk[] {
  const parts = [p.titre, p.auteurs.join(', '), String(p.annee), p.revue_ou_conf ?? '', p.type]
    .filter(x => x && x.length > 0)
  return [{ content: parts.join(' · ') }]
}

export function chunkPrompt(p: Prompt): RawChunk[] {
  return [{ content: `${p.titre}\n${p.texte}`.trim() }]
}

/** Membre : nom, rôle, labo, domaines — JAMAIS l'email (PII). */
export function chunkMember(m: Member): RawChunk[] {
  const domaines = m.domaines.length ? ` — ${m.domaines.join(', ')}` : ''
  return [{ content: `${m.prenom} ${m.nom} (${m.role}, ${m.labo})${domaines}` }]
}

export function chunkTask(t: Task): RawChunk[] {
  const desc = t.description ? `\n${t.description}` : ''
  return [{ content: `${t.titre} [${t.statut}]${desc}`.trim() }]
}
```

> Note implémenteur : adapter les noms de champs aux types réels de `@/types` (vérifier `Member` : pas de champ email dans le chunk même si le type en a un ; `Task.description` peut être vide). `noUncheckedIndexedAccess` impose le `!` sur les accès `chunks[0]` dans les tests.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/rag/chunk.test.ts && npx tsc --noEmit`
Expected: PASS, 0 erreur TS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/chunk.ts src/lib/rag/chunk.test.ts
git commit -m "feat(rag): chunking pur des sources (sujet/publi/prompt/membre/tâche), sans email

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: KB Markdown (chargement + découpage) + fichiers de démarrage

**Files:**
- Create: `src/lib/rag/kb.ts`, `docs/kb/about-fame.md`, `docs/kb/faq.md`
- Test: `src/lib/rag/kb.test.ts`

**Interfaces:**
- Produces:
  - `interface KbDoc { slug: string; lang: string; labo: 'paris'|'montreal'|null; chunks: RawChunk[] }`
  - `parseKbFile(slug: string, raw: string): KbDoc` (frontmatter `lang`/`labo`, découpage par titres `##`)
  - `loadKbDir(dir: string): Promise<KbDoc[]>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/rag/kb.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseKbFile } from './kb'

const RAW = `---
lang: en
labo:
---
# About FAME

Intro paragraph.

## Mission

FAME studies macro questions.

## Team

Two labs: Paris and Montreal.
`

describe('parseKbFile', () => {
  it('lit le frontmatter lang/labo', () => {
    const doc = parseKbFile('about-fame', RAW)
    expect(doc.lang).toBe('en')
    expect(doc.labo).toBeNull()
    expect(doc.slug).toBe('about-fame')
  })
  it('découpe par sections ## (au moins une par titre)', () => {
    const doc = parseKbFile('about-fame', RAW)
    expect(doc.chunks.length).toBeGreaterThanOrEqual(2)
    expect(doc.chunks.some(c => c.content.includes('Mission'))).toBe(true)
    expect(doc.chunks.some(c => c.content.includes('Two labs'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/rag/kb.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Implement kb.ts**

Create `src/lib/rag/kb.ts`:

```ts
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RawChunk } from './chunk'

export interface KbDoc {
  slug: string
  lang: string
  labo: 'paris' | 'montreal' | null
  chunks: RawChunk[]
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of m[1]!.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { meta, body: m[2] ?? '' }
}

export function parseKbFile(slug: string, raw: string): KbDoc {
  const { meta, body } = parseFrontmatter(raw)
  const lang = meta.lang || 'en'
  const labo = meta.labo === 'paris' || meta.labo === 'montreal' ? meta.labo : null
  // Découpe par titres de niveau 2 (## ...). Le préambule (avant le 1er ##) forme un chunk.
  const sections = body.split(/\n(?=## )/).map(s => s.trim()).filter(s => s.length > 0)
  const chunks: RawChunk[] = sections.map(content => ({ content }))
  return { slug, lang, labo, chunks }
}

export async function loadKbDir(dir: string): Promise<KbDoc[]> {
  let files: string[]
  try {
    files = (await readdir(dir)).filter(f => f.endsWith('.md'))
  } catch {
    return []
  }
  const docs: KbDoc[] = []
  for (const f of files) {
    const raw = await readFile(join(dir, f), 'utf8')
    docs.push(parseKbFile(f.replace(/\.md$/, ''), raw))
  }
  return docs
}
```

- [ ] **Step 4: Create the starter KB files**

Create `docs/kb/about-fame.md` (contenu éditorial de démarrage — **à raffiner avec l'utilisateur** ; ce premier jet vient de la spec produit) :

```markdown
---
lang: en
labo:
---
# About FAME

FAME is a research initiative run by two independent labs, in Paris and Montreal,
studying questions in economics and finance.

## Mission

FAME produces academic research and shares it publicly. Visitors can read about
ongoing subjects, browse publications, meet the team, and propose new research topics.

## How it works

Each lab maintains research subjects, tasks tracking their progress, and publications.
Members contribute actively; visitors can read public content and propose subjects.
```

Create `docs/kb/faq.md`:

```markdown
---
lang: en
labo:
---
# FAQ

## What is FAME?

FAME is a two-lab research initiative (Paris and Montreal) in economics and finance.

## Can I propose a research topic?

Yes. Use the "Propose" page to submit a subject; the team reviews proposals.

## How do I contact a researcher?

Researcher contact details are not published here. Use the Propose page to reach the team.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/rag/kb.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rag/kb.ts src/lib/rag/kb.test.ts docs/kb/
git commit -m "feat(rag): chargement KB Markdown (frontmatter + découpage par sections) + KB de démarrage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Indexeur (lecture BDD → chunks → embeddings → upsert)

**Files:**
- Create: `src/lib/rag/index-source.ts`
- Test: `src/lib/rag/index-source.test.ts`

**Interfaces:**
- Consumes: `chunkSubject/...` (Task 3), `loadKbDir` (Task 4), `getEmbeddingProvider` (Task 2), `createServiceClient` (`@/lib/supabase/server`).
- Produces:
  - `indexSource(type: RagSourceType, id: string, deps?: IndexDeps): Promise<void>` — re-chunke + ré-embedde + remplace les chunks de cette source.
  - `deleteSourceChunks(type: RagSourceType, id: string, deps?: IndexDeps): Promise<void>`
  - `reindexAll(deps?: IndexDeps): Promise<{ indexed: number }>`
  - `interface IndexDeps { service?: SupabaseLike; provider?: EmbeddingProvider; kbDir?: string }` (injection pour tests).
  - Règle visibilité (déterminée ici, stockée sur la ligne) :
    - `subject` → `visibility = confidentiel ? 'member' : 'public'`, `labo`, `is_transversal`, `confidentiel` de la ligne.
    - `task` → `visibility = (sujet parent confidentiel) ? 'member' : 'public'`, `labo`.
    - `publication` → `'public'`, `labo`.
    - `prompt` → `'member'`, `labo`, `is_transversal`.
    - `member` → `'public'`, `labo`.
    - `kb` → `'public'`, `labo` du frontmatter (souvent `null`), `lang` du frontmatter.

- [ ] **Step 1: Write the failing test**

Create `src/lib/rag/index-source.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { indexSource } from './index-source'
import type { EmbeddingProvider } from '@/lib/llm'

function makeService(row: Record<string, unknown>) {
  const deleted: unknown[] = []
  const inserted: unknown[] = []
  const service = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }),
      delete: () => ({ eq: (_c: string, v: string) => { deleted.push(v); return Promise.resolve({ error: null }) } }),
      insert: (rows: unknown[]) => { inserted.push(...rows); return Promise.resolve({ error: null }) },
      _table: table,
    }),
  }
  return { service, deleted, inserted }
}

const provider: EmbeddingProvider = { embed: async (t) => t.map(() => [0.1, 0.2]) }

describe('indexSource(subject)', () => {
  it('sujet confidentiel → chunks visibility=member + confidentiel=true', async () => {
    const subject = {
      id: 's1', labo: 'paris', titre: 'T', kicker: '', statut: 'active',
      context: 'ctx', method: '', results: '', keywords: [], auteurs: [],
      difficulte: 'easy', dimensions: {}, ordre: 0, is_transversal: false,
      confidentiel: true, created_at: '', updated_at: '',
    }
    const { service, inserted, deleted } = makeService(subject)
    await indexSource('subject', 's1', { service: service as never, provider })
    expect(deleted).toContain('s1')            // purge des anciens chunks
    expect(inserted.length).toBe(1)            // un seul champ non vide (context)
    expect(inserted[0]).toMatchObject({
      source_type: 'subject', source_id: 's1', visibility: 'member',
      confidentiel: true, labo: 'paris', embedding: [0.1, 0.2],
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/rag/index-source.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Implement index-source.ts**

Create `src/lib/rag/index-source.ts`. Implémentation : un client service-role injectable, une fonction par type pour (a) lire la/les ligne(s) source, (b) produire `RawChunk[]` + métadonnées de visibilité, puis un cœur commun qui embedde et remplace.

```ts
import { createServiceClient } from '@/lib/supabase/server'
import { getEmbeddingProvider, type EmbeddingProvider } from '@/lib/llm'
import { chunkSubject, chunkPublication, chunkPrompt, chunkMember, chunkTask, type RawChunk } from './chunk'
import { loadKbDir } from './kb'
import type { RagSourceType } from '@/types'

// Forme minimale du client service-role utilisée ici (assez pour typer/mock).
type SupabaseLike = {
  from: (table: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface IndexDeps {
  service?: SupabaseLike
  provider?: EmbeddingProvider
  kbDir?: string
}

interface ChunkBatch {
  chunks: RawChunk[]
  labo: 'paris' | 'montreal' | null
  is_transversal: boolean
  confidentiel: boolean
  visibility: 'public' | 'member'
  lang: string
}

async function buildBatch(service: SupabaseLike, type: RagSourceType, id: string): Promise<ChunkBatch | null> {
  if (type === 'subject') {
    const { data } = await service.from('subjects').select('*').eq('id', id).single()
    if (!data) return null
    return {
      chunks: chunkSubject(data), labo: data.labo, is_transversal: data.is_transversal,
      confidentiel: data.confidentiel, visibility: data.confidentiel ? 'member' : 'public', lang: 'en',
    }
  }
  if (type === 'publication') {
    const { data } = await service.from('publications').select('*').eq('id', id).single()
    if (!data) return null
    return { chunks: chunkPublication(data), labo: data.labo, is_transversal: false, confidentiel: false, visibility: 'public', lang: 'en' }
  }
  if (type === 'prompt') {
    const { data } = await service.from('prompts').select('*').eq('id', id).single()
    if (!data) return null
    return { chunks: chunkPrompt(data), labo: data.labo, is_transversal: data.is_transversal, confidentiel: false, visibility: 'member', lang: 'en' }
  }
  if (type === 'member') {
    const { data } = await service.from('members').select('*').eq('id', id).single()
    if (!data) return null
    return { chunks: chunkMember(data), labo: data.labo, is_transversal: false, confidentiel: false, visibility: 'public', lang: 'en' }
  }
  if (type === 'task') {
    const { data } = await service.from('tasks').select('*').eq('id', id).single()
    if (!data) return null
    const { data: subj } = await service.from('subjects').select('confidentiel').eq('id', data.sujet_id).single()
    const conf = !!subj?.confidentiel
    return { chunks: chunkTask(data), labo: data.labo, is_transversal: false, confidentiel: conf, visibility: conf ? 'member' : 'public', lang: 'en' }
  }
  return null
}

async function replaceChunks(
  service: SupabaseLike, provider: EmbeddingProvider,
  type: RagSourceType, id: string, batch: ChunkBatch,
): Promise<void> {
  await service.from('rag_chunks').delete().eq('source_id', id) // purge (par source_id ; source_type implicite ici car ids uuid uniques, sauf kb traité à part)
  if (batch.chunks.length === 0) return
  const embeddings = await provider.embed(batch.chunks.map(c => c.content))
  const rows = batch.chunks.map((c, i) => ({
    source_type: type, source_id: id, labo: batch.labo,
    is_transversal: batch.is_transversal, confidentiel: batch.confidentiel,
    visibility: batch.visibility, lang: batch.lang, content: c.content,
    embedding: embeddings[i] ?? null, token_count: Math.ceil(c.content.length / 4), embedding_stale: false,
  }))
  await service.from('rag_chunks').insert(rows)
}

export async function indexSource(type: RagSourceType, id: string, deps: IndexDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const provider = deps.provider ?? getEmbeddingProvider()
  const batch = await buildBatch(service, type, id)
  if (!batch) { await deleteSourceChunks(type, id, { service }); return }
  await replaceChunks(service, provider, type, id, batch)
}

export async function deleteSourceChunks(_type: RagSourceType, id: string, deps: IndexDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('rag_chunks').delete().eq('source_id', id)
}

export async function reindexAll(deps: IndexDeps = {}): Promise<{ indexed: number }> {
  const service = deps.service ?? (await createServiceClient())
  const provider = deps.provider ?? getEmbeddingProvider()
  let indexed = 0
  for (const table of ['subjects', 'publications', 'prompts', 'members', 'tasks'] as const) {
    const { data } = await service.from(table).select('id')
    for (const row of (data ?? []) as { id: string }[]) {
      const type = ({ subjects: 'subject', publications: 'publication', prompts: 'prompt', members: 'member', tasks: 'task' } as const)[table]
      await indexSource(type, row.id, { service, provider })
      indexed++
    }
  }
  // KB
  const kbDir = deps.kbDir ?? `${process.cwd()}/docs/kb`
  const docs = await loadKbDir(kbDir)
  for (const doc of docs) {
    await service.from('rag_chunks').delete().eq('source_id', `kb:${doc.slug}`)
    if (doc.chunks.length === 0) continue
    const embeddings = await provider.embed(doc.chunks.map(c => c.content))
    const rows = doc.chunks.map((c, i) => ({
      source_type: 'kb', source_id: `kb:${doc.slug}`, labo: doc.labo, is_transversal: false,
      confidentiel: false, visibility: 'public', lang: doc.lang, content: c.content,
      embedding: embeddings[i] ?? null, token_count: Math.ceil(c.content.length / 4), embedding_stale: false,
    }))
    await service.from('rag_chunks').insert(rows)
    indexed++
  }
  return { indexed }
}
```

> Note implémenteur : le `any` sur `SupabaseLike.from` est toléré ici (le builder PostgREST est difficile à typer finement) — c'est le seul endroit. Garder la suppression eslint locale. Adapter les noms de colonnes lus aux types réels.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/rag/index-source.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/index-source.ts src/lib/rag/index-source.test.ts
git commit -m "feat(rag): indexeur (chunks→embeddings→upsert) + règle de visibilité + reindexAll

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Script de backfill `index:rag`

**Files:**
- Create: `src/scripts/index-rag.ts`
- Modify: `package.json` (script `index:rag`)

**Interfaces:**
- Consumes: `reindexAll` (Task 5).

- [ ] **Step 1: Implement the script**

Create `src/scripts/index-rag.ts` (s'inspire de `src/scripts/seed-admin.ts` pour le chargement d'env via `dotenv`) :

```ts
import 'dotenv/config'
import { reindexAll } from '@/lib/rag/index-source'

async function main() {
  console.log('Indexation RAG : démarrage…')
  const { indexed } = await reindexAll()
  console.log(`Indexation RAG terminée : ${indexed} sources traitées.`)
}

main().catch((e) => { console.error('Échec indexation RAG:', e); process.exit(1) })
```

- [ ] **Step 2: Add the npm script**

In `package.json` `scripts`, after `"seed:admin"`, add:

```json
    "index:rag": "npx tsx src/scripts/index-rag.ts"
```

- [ ] **Step 3: Verify it typechecks and resolves**

Run: `npx tsc --noEmit`
Expected: 0 erreur. (Le script n'est pas exécuté ici — il requiert `OPENAI_API_KEY` + BDD réelle, fournis par l'utilisateur au déploiement.)

- [ ] **Step 4: Commit**

```bash
git add src/scripts/index-rag.ts package.json
git commit -m "feat(rag): script de backfill index:rag (reindexAll)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Embed-on-write sur les routes d'écriture

**Files:**
- Create: `src/lib/rag/schedule.ts`
- Test: `src/lib/rag/schedule.test.ts`
- Modify: `src/app/api/subjects/route.ts` (POST), `src/app/api/subjects/[id]/route.ts` (PATCH, DELETE), `src/app/api/publications/route.ts` (POST), `src/app/api/publications/[id]/route.ts` (PATCH, DELETE), `src/app/api/prompts/route.ts` (POST), `src/app/api/prompts/[id]/route.ts` (PATCH, DELETE)

**Interfaces:**
- Produces: `scheduleReindex(type: RagSourceType, id: string): void` — planifie une ré-indexation après la réponse via `after()`, en isolant les erreurs (marque `embedding_stale` si l'embedding échoue).

- [ ] **Step 1: Write the failing test**

Create `src/lib/rag/schedule.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const afterMock = vi.fn((cb: () => unknown) => { void cb() })
vi.mock('next/server', () => ({ after: (cb: () => unknown) => afterMock(cb) }))
const indexSourceMock = vi.fn(async () => {})
const markStaleMock = vi.fn(async () => {})
vi.mock('./index-source', () => ({
  indexSource: (...a: unknown[]) => indexSourceMock(...a),
  markSourceStale: (...a: unknown[]) => markStaleMock(...a),
}))

import { scheduleReindex } from './schedule'

beforeEach(() => { afterMock.mockClear(); indexSourceMock.mockClear(); markStaleMock.mockClear() })

describe('scheduleReindex', () => {
  it('planifie l’indexation via after()', async () => {
    scheduleReindex('subject', 's1')
    expect(afterMock).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(indexSourceMock).toHaveBeenCalledWith('subject', 's1')
  })
  it('si indexSource lève, marque la source stale (n’explose pas)', async () => {
    indexSourceMock.mockRejectedValueOnce(new Error('embed down'))
    scheduleReindex('subject', 's2')
    await new Promise(r => setTimeout(r, 0))
    expect(markStaleMock).toHaveBeenCalledWith('subject', 's2')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/rag/schedule.test.ts`
Expected: FAIL — `scheduleReindex` / `markSourceStale` n'existent pas.

- [ ] **Step 3: Add markSourceStale to index-source.ts**

Append to `src/lib/rag/index-source.ts`:

```ts
export async function markSourceStale(_type: RagSourceType, id: string, deps: IndexDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  await service.from('rag_chunks').update({ embedding_stale: true }).eq('source_id', id)
}
```

- [ ] **Step 4: Implement schedule.ts**

Create `src/lib/rag/schedule.ts`:

```ts
import { after } from 'next/server'
import { indexSource, markSourceStale } from './index-source'
import type { RagSourceType } from '@/types'

/** Ré-indexe une source APRÈS la réponse HTTP, sans bloquer ni faire échouer la requête. */
export function scheduleReindex(type: RagSourceType, id: string): void {
  after(async () => {
    try {
      await indexSource(type, id)
    } catch {
      try { await markSourceStale(type, id) } catch { /* avalé : un cron de rattrapage reprendra */ }
    }
  })
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/rag/schedule.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Wire the hooks into the routes**

Pour chaque route, importer `scheduleReindex` et l'appeler avec l'id concerné **après** un succès, juste avant le `return NextResponse.json(...)`. Exemples :

`src/app/api/subjects/route.ts` (POST), après `if (error) ...` et avant le `return` 201 :

```ts
import { scheduleReindex } from '@/lib/rag/schedule'
// ...
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  scheduleReindex('subject', data.id)
  return NextResponse.json(data, { status: 201 })
```

`src/app/api/subjects/[id]/route.ts` — PATCH : `scheduleReindex('subject', id)` avant le `return` succès ; DELETE : `scheduleReindex('subject', id)` avant le `return { ok: true }` (l'indexeur, ne trouvant plus la ligne, purge les chunks via `deleteSourceChunks`).

Idem pour `publications` (`scheduleReindex('publication', …)`) et `prompts` (`scheduleReindex('prompt', …)`) sur POST/PATCH/DELETE. Pour les DELETE qui n'ont que l'`id` du param, utiliser cet `id`. Pour les POST, utiliser `data.id` de la ligne insérée.

> Note : `publications/[id]/route.ts` n'a pas été lu ici ; s'il n'expose pas PATCH/DELETE, n'ajouter le hook que sur les handlers présents. Ne pas créer de handler manquant dans cette tâche.

- [ ] **Step 7: Verify build + existing route tests still pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 erreur TS ; toute la suite passe (les tests de routes existants mockent leurs deps ; `scheduleReindex` appelle `after`, no-op hors requête — si un test de route échoue car `after` n'est pas mocké, ajouter `vi.mock('@/lib/rag/schedule', () => ({ scheduleReindex: () => {} }))` en tête du fichier de test concerné).

- [ ] **Step 8: Commit**

```bash
git add src/lib/rag/schedule.ts src/lib/rag/schedule.test.ts src/lib/rag/index-source.ts src/app/api/subjects src/app/api/publications src/app/api/prompts
git commit -m "feat(rag): embed-on-write via after() sur subjects/publications/prompts (+ markSourceStale)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Membres publics (lecture sans email) + page Team accessible aux visiteurs

**Files:**
- Modify: `src/app/api/members/route.ts`
- Test: `src/app/api/members/route.test.ts`
- Modify: page/composant Team (à localiser : `src/app/[locale]/[lab]/team/page.tsx` et/ou son composant data-fetch)

**Interfaces:**
- `GET /api/members?lab=` devient **public** et projette `id,prenom,nom,role,labo,domaines,photo_url,is_admin` (**jamais** `email`).

- [ ] **Step 1: Write the failing test**

Create `src/app/api/members/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

let lastSelect = ''
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: (cols: string) => { lastSelect = cols; return { eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) } },
    }),
  }),
}))
import { GET } from './route'

describe('GET /api/members — public sans PII', () => {
  it('répond 200 sans authentification', async () => {
    const res = await GET(new NextRequest('http://localhost/api/members?lab=paris'))
    expect(res.status).toBe(200)
  })
  it('le select ne contient jamais email', async () => {
    await GET(new NextRequest('http://localhost/api/members?lab=paris'))
    expect(lastSelect).not.toContain('email')
    expect(lastSelect).not.toBe('*')
  })
  it('refuse un lab invalide (400)', async () => {
    expect((await GET(new NextRequest('http://localhost/api/members?lab=berlin'))).status).toBe(400)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/members/route.test.ts`
Expected: FAIL — la route exige aujourd'hui `requireMember` et sélectionne `email`.

- [ ] **Step 3: Make the route public, drop email**

In `src/app/api/members/route.ts` GET : supprimer le bloc `try { await requireMember() } catch ...` et retirer `email` du select :

```ts
export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab')
  if (lab === null || !VALID_LABS.includes(lab as Lab)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  const validLab = lab as Lab
  const service = await createServiceClient()
  const { data, error } = await service
    .from('members')
    .select('id,prenom,nom,role,labo,domaines,photo_url,is_admin,activated_at,created_at')
    .eq('labo', validLab).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

Retirer l'import `requireMember`/`authErrorResponse` s'il n'est plus utilisé dans le fichier (sinon lint `no-unused-vars`).

- [ ] **Step 4: Make the Team page reachable by visitors**

Localiser la page Team (`src/app/[locale]/[lab]/team/page.tsx`) et son composant. Si elle redirige les non-membres ou exige une session pour s'afficher, retirer ce gardiennage de lecture : la liste des membres (sans email) est désormais publique. Conserver tout contrôle d'édition réservé aux membres. Si la page est déjà un RSC en lecture seule consommant `/api/members`, vérifier simplement qu'aucun email n'y était affiché (et le retirer le cas échéant).

> Note implémenteur : si le composant Team affichait l'email, supprimer ce rendu. Vérifier qu'aucun autre consommateur de `/api/members` ne dépendait du champ `email` (grep `\.email` sur les composants `team/`). Le type `Member` garde `email` (utilisé côté admin/invitations) — seule la projection publique l'exclut.

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: PASS, 0 erreur, lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/members/route.ts src/app/api/members/route.test.ts "src/app/[locale]/[lab]/team"
git commit -m "feat(members): lecture publique sans email + page Team accessible aux visiteurs (révision B4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (P1)

- **Couverture spec §5 (data model)** : migration 006 couvre `confidentiel`, pgvector, `rag_chunks`, `chat_rate_limit`, `chat_usage`, `chat_unanswered`, `chat_flagged`, `app_settings` ✅ (Task 1).
- **§6 indexation** : chunking (Task 3), KB (Task 4), indexeur + visibilité (Task 5), backfill (Task 6), embed-on-write (Task 7) ✅.
- **§7 embeddings** : provider OpenAI dim 1536 (Task 2) ✅.
- **§2/§3/§17 membres publics** : Task 8 ✅.
- **Placeholder scan** : KB de démarrage marqué « à raffiner avec l'utilisateur » — contenu réel fourni, pas un TODO de code. RAS bloquant.
- **Cohérence types** : `RawChunk`, `IndexDeps`, `EmbeddingProvider`, `RagSourceType` cohérents entre tasks 2/3/4/5/7. `getEmbeddingProvider` exporté depuis `@/lib/llm` et consommé en 5.
- **Non couvert ici (volontaire, → P2+)** : retrieve/filtre query-time, génération, endpoint chat, rate-limit runtime, budget, UI, admin, RGPD.
