# Assistant RAG — P3 : Tool-calling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'assistant trois outils en lecture seule — `get_subject_progress`, `find_tasks`, `get_subject_files` — pour répondre à des questions structurées (« où en est le sujet X ? », « quelles tâches restent ? », « quels fichiers pour Y ? »), **chaque handler ré-appliquant le filtre de permissions** selon le tier, puis intégrer la boucle d'appel d'outils dans `POST /api/assistant/chat`.

**Architecture:** Chaque outil = une fonction pure `(args, tier) => Promise<result>` + une définition JSON-schema OpenAI. Un registre central mappe nom→handler+def. L'endpoint expose les définitions au modèle (champ `tools`), exécute la boucle « le modèle demande un appel → on exécute → on renvoie le résultat → le modèle continue », puis streame la réponse finale. Les outils ne renvoient JAMAIS d'email ; `get_subject_files` et le contenu confidentiel sont réservés aux membres.

**Tech Stack:** OpenAI Chat Completions `tools`/`tool_calls` (non-stream pour la phase d'outils, stream pour la réponse finale), Supabase service-role (lecture filtrée applicativement par tier), Vitest (node).

## Global Constraints

- **Re-check de permission DANS CHAQUE handler** : ne jamais se fier au filtre amont. Un visiteur appelant `get_subject_progress` sur un sujet `confidentiel` reçoit « non disponible » ; `get_subject_files` est **refusé aux visiteurs** (fichiers = membres only).
- **Zéro PII** : aucun handler ne renvoie d'email. `find_tasks` renvoie des noms d'assignés (prénom/nom), jamais d'email.
- **Lecture seule** : aucun outil n'écrit. Service-role sans cookies (RLS bypass intentionnel — voir `src/lib/supabase/server.ts`).
- **Lab validé** `paris|montreal` minuscules ; `is_transversal` visible partout (décision B5 — pas d'isolation cross-lab).
- **Borne dure** : max 3 itérations d'outils par requête (anti-boucle). Au-delà → on force une réponse texte.
- Tests déterministes (mock supabase + provider). Commits atomiques ; `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure

- `src/lib/rag/tools/types.ts` — `ToolContext`, `ToolDef`, `ToolResult`.
- `src/lib/rag/tools/get-subject-progress.ts`
- `src/lib/rag/tools/find-tasks.ts`
- `src/lib/rag/tools/get-subject-files.ts`
- `src/lib/rag/tools/index.ts` — registre `TOOLS`, `runTool(name, args, ctx)`, `toolDefs()`.
- `src/lib/llm/provider.ts` — `ChatProvider.complete()` (non-stream, supporte `tools`).
- `src/lib/llm/openai.ts` — implémentation `complete`.
- `src/app/api/assistant/chat/route.ts` — boucle d'outils avant le stream final.

---

### Task 1: Types d'outils

**Files:**
- Create: `src/lib/rag/tools/types.ts`
- Test: aucun (types purs — validés par `tsc` dans les tasks suivantes).

**Interfaces:**
- Produces:
  - `interface ToolContext { tier: Tier; service: SupabaseLike }`
  - `interface ToolDef { name: string; description: string; parameters: Record<string, unknown> }` (JSON-schema OpenAI)
  - `type ToolResult = Record<string, unknown>`
  - `type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>`
  - `interface RegisteredTool { def: ToolDef; handler: ToolHandler }`
  - `type SupabaseLike = { from: (t: string) => any }`

- [ ] **Step 1: Write the file**

```ts
import type { Tier } from '@/lib/rag/retrieve'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseLike = { from: (t: string) => any }

export interface ToolContext {
  tier: Tier
  service: SupabaseLike
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ToolResult = Record<string, unknown>
export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>

export interface RegisteredTool {
  def: ToolDef
  handler: ToolHandler
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (aucune erreur de type).

- [ ] **Step 3: Commit**

```bash
git add src/lib/rag/tools/types.ts
git commit -m "feat(rag): types des outils (ToolContext/ToolDef/ToolHandler)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Outil `get_subject_progress`

**Files:**
- Create: `src/lib/rag/tools/get-subject-progress.ts`
- Test: `src/lib/rag/tools/get-subject-progress.test.ts`

**Interfaces:**
- Consumes: `ToolContext`, `ToolDef`, `ToolResult` (Task 1).
- Produces: `getSubjectProgress: RegisteredTool` — args `{ subject_id: string }` ; renvoie `{ found: boolean, titre?, statut?, tasks_total?, tasks_done?, tasks_in_progress?, tasks_todo? }`. **Refuse** (`{ found: false }`) si le sujet est `confidentiel` et `tier === 'visitor'`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { getSubjectProgress } from './get-subject-progress'
import type { ToolContext } from './types'

function ctx(tier: 'visitor' | 'member', subject: unknown, tasks: unknown[]): ToolContext {
  return {
    tier,
    service: {
      from: (t: string) => ({
        select: () => ({
          eq: () => (t === 'subjects'
            ? { maybeSingle: async () => ({ data: subject, error: null }) }
            : { data: tasks, error: null }),
        }),
      }),
    } as never,
  }
}

const subj = { id: 's1', titre: 'Inflation', statut: 'active', confidentiel: false }
const tasks = [{ statut: 'done' }, { statut: 'done' }, { statut: 'in-progress' }, { statut: 'to-do' }]

describe('get_subject_progress', () => {
  it('agrège l’avancement', async () => {
    const r = await getSubjectProgress.handler({ subject_id: 's1' }, ctx('visitor', subj, tasks))
    expect(r).toMatchObject({ found: true, tasks_total: 4, tasks_done: 2, tasks_in_progress: 1, tasks_todo: 1 })
  })
  it('refuse un sujet confidentiel à un visiteur', async () => {
    const r = await getSubjectProgress.handler({ subject_id: 's1' }, ctx('visitor', { ...subj, confidentiel: true }, tasks))
    expect(r).toEqual({ found: false })
  })
  it('autorise un sujet confidentiel à un membre', async () => {
    const r = await getSubjectProgress.handler({ subject_id: 's1' }, ctx('member', { ...subj, confidentiel: true }, tasks))
    expect(r).toMatchObject({ found: true })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/rag/tools/get-subject-progress.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { RegisteredTool, ToolContext, ToolResult } from './types'

async function handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const subjectId = String(args.subject_id ?? '')
  if (!subjectId) return { found: false }

  const { data: subject } = await ctx.service.from('subjects')
    .select('id, titre, statut, confidentiel').eq('id', subjectId).maybeSingle()
  if (!subject) return { found: false }
  if (subject.confidentiel && ctx.tier !== 'member') return { found: false }

  const { data: tasks } = await ctx.service.from('tasks').select('statut').eq('sujet_id', subjectId)
  const rows: { statut: string }[] = tasks ?? []
  return {
    found: true,
    titre: subject.titre,
    statut: subject.statut,
    tasks_total: rows.length,
    tasks_done: rows.filter(t => t.statut === 'done').length,
    tasks_in_progress: rows.filter(t => t.statut === 'in-progress').length,
    tasks_todo: rows.filter(t => t.statut === 'to-do').length,
  }
}

export const getSubjectProgress: RegisteredTool = {
  def: {
    name: 'get_subject_progress',
    description: 'Get the status and task progress (done/in-progress/to-do counts) of a FAME research subject by its id.',
    parameters: {
      type: 'object',
      properties: { subject_id: { type: 'string', description: 'The subject UUID' } },
      required: ['subject_id'],
    },
  },
  handler,
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/rag/tools/get-subject-progress.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/tools/get-subject-progress.ts src/lib/rag/tools/get-subject-progress.test.ts
git commit -m "feat(rag): outil get_subject_progress (re-check confidentiel)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Outil `find_tasks`

**Files:**
- Create: `src/lib/rag/tools/find-tasks.ts`
- Test: `src/lib/rag/tools/find-tasks.test.ts`

**Interfaces:**
- Produces: `findTasks: RegisteredTool` — args `{ labo?: 'paris'|'montreal', statut?: 'to-do'|'in-progress'|'done', subject_id?: string }` ; renvoie `{ tasks: { id, titre, statut, labo, assignees: string[] }[] }`. **Exclut les tâches de sujets confidentiels pour un visiteur** ; `assignees` = noms (« Prénom Nom »), jamais d'email.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { findTasks } from './find-tasks'
import type { ToolContext } from './types'

const taskRows = [
  { id: 't1', titre: 'Run regressions', statut: 'to-do', labo: 'paris', sujet_id: 's1',
    subjects: { confidentiel: false },
    task_assignees: [{ members: { prenom: 'Ada', nom: 'Lovelace', email: 'ada@x.org' } }] },
  { id: 't2', titre: 'Secret', statut: 'to-do', labo: 'paris', sujet_id: 's2',
    subjects: { confidentiel: true }, task_assignees: [] },
]

function ctx(tier: 'visitor' | 'member'): ToolContext {
  const builder: any = {
    select: () => builder, eq: () => builder, limit: () => builder,
    then: (res: (v: { data: unknown; error: null }) => void) => res({ data: taskRows, error: null }),
  }
  return { tier, service: { from: () => builder } as never }
}

describe('find_tasks', () => {
  it('exclut les sujets confidentiels pour un visiteur et masque les emails', async () => {
    const r = await findTasks.handler({ labo: 'paris', statut: 'to-do' }, ctx('visitor'))
    const tasks = r.tasks as { id: string; assignees: string[] }[]
    expect(tasks.map(t => t.id)).toEqual(['t1'])
    expect(tasks[0].assignees).toEqual(['Ada Lovelace'])
    expect(JSON.stringify(r)).not.toContain('ada@x.org')
  })
  it('inclut les sujets confidentiels pour un membre', async () => {
    const r = await findTasks.handler({ labo: 'paris', statut: 'to-do' }, ctx('member'))
    expect((r.tasks as unknown[]).length).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/rag/tools/find-tasks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { RegisteredTool, ToolContext, ToolResult } from './types'

const VALID_STATUT = ['to-do', 'in-progress', 'done']

async function handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  let query = ctx.service.from('tasks').select(
    'id, titre, statut, labo, sujet_id, subjects(confidentiel), task_assignees(members(prenom, nom))',
  )
  if (args.labo === 'paris' || args.labo === 'montreal') query = query.eq('labo', args.labo)
  if (typeof args.statut === 'string' && VALID_STATUT.includes(args.statut)) query = query.eq('statut', args.statut)
  if (typeof args.subject_id === 'string' && args.subject_id) query = query.eq('sujet_id', args.subject_id)
  query = query.limit(25)

  const { data } = await query
  const rows: any[] = data ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any

  const tasks = rows
    .filter(r => ctx.tier === 'member' || !r.subjects?.confidentiel)
    .map(r => ({
      id: r.id,
      titre: r.titre,
      statut: r.statut,
      labo: r.labo,
      assignees: (r.task_assignees ?? [])
        .map((a: any) => a.members) // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter(Boolean)
        .map((m: { prenom: string; nom: string }) => `${m.prenom} ${m.nom}`),
    }))
  return { tasks }
}

export const findTasks: RegisteredTool = {
  def: {
    name: 'find_tasks',
    description: 'List FAME tasks, optionally filtered by lab (paris/montreal), status (to-do/in-progress/done), or subject id. Returns task titles, status, and assignee names.',
    parameters: {
      type: 'object',
      properties: {
        labo: { type: 'string', enum: ['paris', 'montreal'] },
        statut: { type: 'string', enum: ['to-do', 'in-progress', 'done'] },
        subject_id: { type: 'string' },
      },
    },
  },
  handler,
}
```

> Note implémenteur : le `select` n'inclut PAS `email`. Le test « not.toContain ada@x.org » le garantit même si une jointure ramenait l'email.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/rag/tools/find-tasks.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/tools/find-tasks.ts src/lib/rag/tools/find-tasks.test.ts
git commit -m "feat(rag): outil find_tasks (filtre confidentiel + noms sans email)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Outil `get_subject_files` (membres uniquement)

**Files:**
- Create: `src/lib/rag/tools/get-subject-files.ts`
- Test: `src/lib/rag/tools/get-subject-files.test.ts`

**Interfaces:**
- Produces: `getSubjectFiles: RegisteredTool` — args `{ subject_id: string }` ; renvoie `{ allowed: boolean, files?: { name, path }[] }`. **`allowed:false` pour tout visiteur** (les fichiers Dropbox = membres only, cf. AGENTS).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { getSubjectFiles } from './get-subject-files'
import type { ToolContext } from './types'

function ctx(tier: 'visitor' | 'member', rows: unknown[]): ToolContext {
  return {
    tier,
    service: { from: () => ({ select: () => ({ eq: () => ({ data: rows, error: null }) }) }) } as never,
  }
}
const links = [{ node_name: 'data.csv', node_path: '/paris/s1/data.csv' }]

describe('get_subject_files', () => {
  it('refuse aux visiteurs', async () => {
    const r = await getSubjectFiles.handler({ subject_id: 's1' }, ctx('visitor', links))
    expect(r).toEqual({ allowed: false })
  })
  it('liste pour un membre', async () => {
    const r = await getSubjectFiles.handler({ subject_id: 's1' }, ctx('member', links))
    expect(r).toMatchObject({ allowed: true, files: [{ name: 'data.csv', path: '/paris/s1/data.csv' }] })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/rag/tools/get-subject-files.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { RegisteredTool, ToolContext, ToolResult } from './types'

async function handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  if (ctx.tier !== 'member') return { allowed: false }
  const subjectId = String(args.subject_id ?? '')
  if (!subjectId) return { allowed: true, files: [] }

  const { data } = await ctx.service.from('dropbox_links')
    .select('node_name, node_path').eq('subject_id', subjectId)
  const files = (data ?? []).map((r: { node_name: string; node_path: string }) => ({ name: r.node_name, path: r.node_path }))
  return { allowed: true, files }
}

export const getSubjectFiles: RegisteredTool = {
  def: {
    name: 'get_subject_files',
    description: 'List Dropbox files linked to a FAME subject. Members only — visitors are not allowed.',
    parameters: {
      type: 'object',
      properties: { subject_id: { type: 'string' } },
      required: ['subject_id'],
    },
  },
  handler,
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/rag/tools/get-subject-files.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/tools/get-subject-files.ts src/lib/rag/tools/get-subject-files.test.ts
git commit -m "feat(rag): outil get_subject_files (membres uniquement)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Registre d'outils

**Files:**
- Create: `src/lib/rag/tools/index.ts`
- Test: `src/lib/rag/tools/index.test.ts`

**Interfaces:**
- Consumes: les trois `RegisteredTool`.
- Produces:
  - `TOOLS: Record<string, RegisteredTool>`
  - `toolDefs(): { type: 'function'; function: ToolDef }[]` (format OpenAI)
  - `runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>` — outil inconnu → `{ error: 'unknown_tool' }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { TOOLS, toolDefs, runTool } from './index'
import type { ToolContext } from './types'

describe('registre d’outils', () => {
  it('expose les 3 outils', () => {
    expect(Object.keys(TOOLS).sort()).toEqual(['find_tasks', 'get_subject_files', 'get_subject_progress'])
  })
  it('toolDefs() au format OpenAI', () => {
    const defs = toolDefs()
    expect(defs[0]).toHaveProperty('type', 'function')
    expect(defs[0].function).toHaveProperty('name')
  })
  it('runTool inconnu → erreur', async () => {
    const ctx = { tier: 'visitor', service: {} } as unknown as ToolContext
    expect(await runTool('nope', {}, ctx)).toEqual({ error: 'unknown_tool' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/rag/tools/index.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { RegisteredTool, ToolContext, ToolResult } from './types'
import { getSubjectProgress } from './get-subject-progress'
import { findTasks } from './find-tasks'
import { getSubjectFiles } from './get-subject-files'

export const TOOLS: Record<string, RegisteredTool> = {
  get_subject_progress: getSubjectProgress,
  find_tasks: findTasks,
  get_subject_files: getSubjectFiles,
}

export function toolDefs(): { type: 'function'; function: RegisteredTool['def'] }[] {
  return Object.values(TOOLS).map(t => ({ type: 'function', function: t.def }))
}

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const tool = TOOLS[name]
  if (!tool) return { error: 'unknown_tool' }
  return tool.handler(args, ctx)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/rag/tools/index.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/tools/index.ts src/lib/rag/tools/index.test.ts
git commit -m "feat(rag): registre d'outils (toolDefs + runTool)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `ChatProvider.complete()` (non-stream, supporte tools)

**Files:**
- Modify: `src/lib/llm/provider.ts`, `src/lib/llm/openai.ts`
- Test: `src/lib/llm/complete.test.ts`

**Interfaces:**
- Produces (ajout à `ChatProvider`):
  - `complete(messages: ChatMessage[], opts?: { tools?: unknown[]; maxTokens?: number }): Promise<ChatCompletion>`
  - `interface ToolCall { id: string; name: string; arguments: string }`
  - `interface ChatCompletion { content: string | null; toolCalls: ToolCall[] }`
  - `ChatMessage` étendu pour porter les tours d'outils : `tool_call_id?: string`, `name?: string`, `tool_calls?: unknown[]` (rôle `'tool'` ajouté).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { createOpenAIChatProvider } from './openai'

function jsonResponse(payload: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch
}

describe('ChatProvider.complete', () => {
  it('extrait les tool_calls', async () => {
    const fetchImpl = jsonResponse({
      choices: [{ message: { content: null, tool_calls: [
        { id: 'c1', function: { name: 'find_tasks', arguments: '{"labo":"paris"}' } },
      ] } }],
    })
    const p = createOpenAIChatProvider({ apiKey: 'sk', model: 'm', fetchImpl })
    const out = await p.complete([{ role: 'user', content: 'tasks?' }], { tools: [] })
    expect(out.toolCalls).toEqual([{ id: 'c1', name: 'find_tasks', arguments: '{"labo":"paris"}' }])
    expect(out.content).toBeNull()
  })
  it('renvoie le contenu quand pas d’outils', async () => {
    const fetchImpl = jsonResponse({ choices: [{ message: { content: 'Hello', tool_calls: undefined } }] })
    const p = createOpenAIChatProvider({ apiKey: 'sk', model: 'm', fetchImpl })
    const out = await p.complete([{ role: 'user', content: 'hi' }])
    expect(out).toEqual({ content: 'Hello', toolCalls: [] })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/llm/complete.test.ts`
Expected: FAIL.

- [ ] **Step 3: Extend provider.ts and openai.ts**

Replace the `ChatMessage`/`ChatProvider` block in `src/lib/llm/provider.ts`:

```ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: unknown[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface ChatCompletion {
  content: string | null
  toolCalls: ToolCall[]
}

export interface ChatProvider {
  stream(messages: ChatMessage[], opts?: { maxTokens?: number }): AsyncIterable<string>
  complete(messages: ChatMessage[], opts?: { tools?: unknown[]; maxTokens?: number }): Promise<ChatCompletion>
}
```

Add to the object returned by `createOpenAIChatProvider` in `src/lib/llm/openai.ts`:

```ts
    async complete(messages, opts) {
      const res = await doFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts?.apiKey ?? opts}`, 'Content-Type': 'application/json' }, // see note
        body: JSON.stringify({
          model: opts2Model, messages,
          ...(opts?.tools && opts.tools.length ? { tools: opts.tools } : {}),
          max_tokens: opts?.maxTokens ?? 600,
        }),
      })
      if (!res.ok) throw new Error(`OpenAI complete failed: ${res.status}`)
      const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] }
      const msg = json.choices?.[0]?.message
      return {
        content: msg?.content ?? null,
        toolCalls: (msg?.tool_calls ?? []).map(tc => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments })),
      }
    },
```

> Note implémenteur : ne pas copier le `opts?.apiKey ?? opts` ci-dessus tel quel — c'est un repère. Réutiliser exactement la même closure `opts.apiKey`/`opts.model`/`doFetch` que `stream()` (déjà en place depuis P2). La structure du corps et l'extraction des `tool_calls` sont ce qui compte.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/llm/complete.test.ts src/lib/llm/chat.test.ts && npx tsc --noEmit`
Expected: PASS (le test de stream de P2 reste vert).

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/provider.ts src/lib/llm/openai.ts src/lib/llm/complete.test.ts
git commit -m "feat(rag): ChatProvider.complete() avec support tool_calls

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Boucle d'outils dans l'endpoint chat

**Files:**
- Modify: `src/app/api/assistant/chat/route.ts`
- Test: `src/app/api/assistant/chat/tools.test.ts`

**Interfaces:**
- Consumes: `toolDefs`, `runTool` (Task 5), `ChatProvider.complete` (Task 6), `createServiceClient`.
- Behaviour: avant le stream final, faire jusqu'à 3 tours `complete(... tools)` ; pour chaque `tool_call`, exécuter `runTool(name, JSON.parse(args), { tier, service })`, ajouter un message `role:'tool'`, reboucler ; dès qu'il n'y a plus de `tool_calls`, streamer la réponse finale. Les `sources` SSE incluent toujours les chunks RAG ; les résultats d'outils restent internes.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const state = { toolCallsFirst: true }
vi.mock('@/lib/auth', () => ({ getSession: async () => ({ member: { id: 'm1' } }) }))
vi.mock('@/lib/rate-limit', () => ({ clientIp: () => '1.2.3.4' }))
vi.mock('@/lib/rag/settings', () => ({ isAssistantEnabled: async () => true }))
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: async () => false, recordUsage: async () => {} }))
vi.mock('@/lib/rag/rate-limit-db', () => ({ checkRateLimitDb: async () => true }))
vi.mock('@/lib/rag/ip-hash', () => ({ hashIp: (s: string) => s }))
vi.mock('@/lib/rag/moderation', () => ({ moderateInput: async () => ({ flagged: false }) }))
vi.mock('@/lib/rag/guardrails', () => ({ detectInjection: () => ({ flagged: false }), maskPII: (s: string) => s }))
vi.mock('@/lib/rag/retrieve', () => ({ retrieve: async () => [{ id: '1', source_type: 'subject', source_id: 's1', content: 'c', labo: 'paris', lang: 'en', similarity: 0.9 }] }))
vi.mock('@/lib/rag/system-prompt', () => ({ buildSystemPrompt: () => 'sys' }))
vi.mock('@/lib/rag/flagged-log', () => ({ logFlagged: async () => {}, logUnanswered: async () => {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: async () => ({ from: () => ({}) }) }))

const runTool = vi.fn(async () => ({ tasks: [] }))
vi.mock('@/lib/rag/tools', () => ({
  toolDefs: () => [{ type: 'function', function: { name: 'find_tasks' } }],
  runTool,
}))

const provider = {
  // 1er complete → demande un outil ; 2e → plus d'outils
  complete: vi.fn()
    .mockResolvedValueOnce({ content: null, toolCalls: [{ id: 'c1', name: 'find_tasks', arguments: '{"labo":"paris"}' }] })
    .mockResolvedValueOnce({ content: null, toolCalls: [] }),
  async *stream() { yield 'final answer' },
}
vi.mock('@/lib/llm', () => ({ getChatProvider: () => provider }))

import { POST } from './route'
const post = (b: unknown) => new NextRequest('http://localhost/api/assistant/chat', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => { runTool.mockClear() })

describe('boucle d’outils', () => {
  it('exécute l’outil puis streame la réponse finale', async () => {
    const res = await POST(post({ messages: [{ role: 'user', content: 'tasks in paris?' }] }))
    expect(res.status).toBe(200)
    expect(runTool).toHaveBeenCalledWith('find_tasks', { labo: 'paris' }, expect.objectContaining({ tier: 'member' }))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/api/assistant/chat/tools.test.ts`
Expected: FAIL.

- [ ] **Step 3: Modify the route handler**

Dans `src/app/api/assistant/chat/route.ts`, ajouter les imports et insérer la boucle d'outils **entre** la construction de `chatMessages` (étape 7 de P2) et la création du `ReadableStream` :

```ts
import { createServiceClient } from '@/lib/supabase/server'
import { toolDefs, runTool } from '@/lib/rag/tools'
import type { ToolContext } from '@/lib/rag/tools/types'
```

```ts
  // 7bis. Boucle d'outils (max 3 tours) avant le stream final.
  const service = await createServiceClient()
  const toolCtx: ToolContext = { tier, service: service as unknown as ToolContext['service'] }
  const defs = toolDefs()
  for (let i = 0; i < 3; i++) {
    const completion = await provider.complete(chatMessages, { tools: defs, maxTokens: 600 })
    if (completion.toolCalls.length === 0) break
    chatMessages.push({ role: 'assistant', content: completion.content, tool_calls: completion.toolCalls.map(tc => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } })) })
    for (const call of completion.toolCalls) {
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(call.arguments) as Record<string, unknown> } catch { parsed = {} }
      const result = await runTool(call.name, parsed, toolCtx)
      chatMessages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify(result) })
    }
  }
```

> Note implémenteur : après la boucle, le `provider.stream(chatMessages, …)` existant (P2) produit la réponse finale en s'appuyant sur les messages `tool` injectés. Garder le masquage PII par delta. Le `service` est réutilisé par les outils ; il ne porte pas les cookies (RLS bypass voulu).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/app/api/assistant/chat/ && npx tsc --noEmit && npm run lint`
Expected: PASS (les tests de gardes de P2 restent verts).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/assistant/chat/route.ts src/app/api/assistant/chat/tools.test.ts
git commit -m "feat(rag): boucle d'appel d'outils dans l'endpoint chat (max 3 tours)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (P3)

- **§ outils en lecture seule** : `get_subject_progress`, `find_tasks`, `get_subject_files` livrés (Tasks 2-4) ✅.
- **§3 re-check permission par handler** : confidentiel filtré (2, 3), fichiers membres-only (4) — tests dédiés ✅.
- **Zéro PII** : `find_tasks` ne sélectionne pas l'email, test `not.toContain` ✅.
- **Borne anti-boucle** : max 3 tours (Task 7) ✅.
- **§7 intégration génération** : `complete()` pour la phase outils, `stream()` pour la réponse finale (6, 7) ✅.
- **Type consistency** : `ToolContext`/`ToolDef`/`RegisteredTool`/`ChatMessage` (rôle `tool`)/`ChatCompletion`/`ToolCall` cohérents entre tasks ✅.
- **Placeholder scan** : le repère `opts?.apiKey ?? opts` est explicitement signalé comme NON-littéral avec instruction de réutiliser la closure existante. RAS sinon.
- **Non couvert (→ P4/P5)** : exposition UI des appels d'outils (transparent côté client), page admin.
