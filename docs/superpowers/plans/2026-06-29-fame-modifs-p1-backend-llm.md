# FAME — Lot de modifs, Plan 1 : Backend / LLM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la génération + traduction LLM aux tâches, forcer l'assistant à répondre dans la langue de la question, créer une section admin des logs IA, et rendre le Markdown des réponses de l'assistant.

**Architecture:** On réplique pour les tâches l'infra LLM déjà livrée pour les sujets (`src/lib/subjects/*` → `src/lib/tasks/*`), avec une colonne `i18n jsonb` (migration `012`). L'assistant reçoit la langue détectée dans son system prompt. Une nouvelle page admin lit les tables `chat_unanswered`/`chat_flagged` existantes. Un petit renderer Markdown sans dépendance affiche le gras/italique/listes dans les bulles de l'assistant.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Supabase (`@supabase/ssr` + service-role), next-intl, OpenAI via `getChatProvider()`.

## Global Constraints

- Migration suivante = **`012`** (`011_subject_files_rag.sql` est déjà réservé/à appliquer).
- i18n **EN + FR à parité stricte** (test `src/messages-parity.test.ts`) — ajouter chaque clé dans `messages/en.json` **et** `messages/fr.json`. Zéro chaîne UI hardcodée.
- Tous les writes passent par des routes `/api/` avec `createServiceClient()` (**sans cookies**).
- Kill-switches LLM : `process.env.ASSISTANT_DISABLED === '1'` → 503 ; `await isOverBudget()` → 503.
- Emails membres publics (ne pas remasquer) ; `confidentiel` reste protégé du visiteur.
- Secrets server-only ; jamais de `NEXT_PUBLIC_` sur `OPENAI_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY`.
- Estimation tokens partout : `Math.ceil(text.length / 4)`.
- Valider après chaque tâche : `npx tsc --noEmit`, `npm run lint`, suite de tests. Commits atomiques (`feat:`/`fix:`).

---

## File Structure

**Créés**
- `supabase/migrations/012_task_i18n.sql` — `i18n jsonb` sur `tasks` et `subtasks`.
- `src/lib/tasks/field-prompts.ts` — `TaskAssistField`, `buildTaskFieldPrompt`.
- `src/lib/tasks/generate-field.ts` — `generateTaskField`.
- `src/lib/tasks/translate.ts` — `translateTaskFields`, `buildTaskI18n`.
- `src/lib/tasks/localized.ts` — `localizedTask`.
- `src/app/api/tasks/assist/route.ts` — `POST` génération par champ.
- `src/components/ui/AssistButton.tsx` — bouton ✨ + « voir le prompt » générique (réutilisable).
- `src/app/[locale]/admin/logs/page.tsx` — page admin logs.
- `src/components/admin/LogsDashboard.tsx` — tableaux unanswered/flagged.
- `src/app/api/admin/logs/[id]/route.ts` — `PATCH` toggle `resolved`.
- `src/lib/rag/detect-lang.ts` — détection de langue de la question.
- `src/components/assistant/Markdown.tsx` — renderer Markdown léger, streaming-safe.
- Fichiers de test associés (`*.test.ts(x)`).

**Modifiés**
- `src/types/index.ts` — `TaskI18nFields`, `TaskI18n`, `Task.i18n`, `Subtask.i18n`.
- `src/app/api/tasks/route.ts` — auto-traduction à la création.
- `src/app/api/tasks/[id]/route.ts` — auto-traduction au PATCH.
- `src/app/api/tasks/[id]/subtasks/route.ts` — traduction du label.
- `src/lib/rag/chunk.ts` — `RawChunk.lang`, `chunkTask` bilingue.
- `src/lib/rag/index-source.ts` — lang par chunk (corrige `lang:'en'` codé en dur).
- `src/lib/rag/system-prompt.ts` — `buildSystemPrompt(tier, chunks, lang)`.
- `src/app/api/assistant/chat/route.ts` — détection langue + passage au prompt.
- `src/components/tasks/AddTaskModal.tsx` — ✨ sur titre/description/sous-tâches.
- `src/components/tasks/TaskModal.tsx` — édition inline titre/description + ✨ (membres).
- `src/components/admin/AssistantDashboard.tsx` + `src/app/[locale]/admin/assistant/page.tsx` — lien vers `/admin/logs`, retrait de la liste minimale.
- `src/components/assistant/ChatMessageList.tsx` — rendu Markdown des messages assistant.
- `messages/en.json` + `messages/fr.json` — clés `tasks.editor.*`, `adminLogs.*`, lien admin.

---

## A1 — Génération + traduction LLM sur les tâches

### Task 1: Migration `012` + types i18n des tâches

**Files:**
- Create: `supabase/migrations/012_task_i18n.sql`
- Modify: `src/types/index.ts:89-116` (bloc Tasks)
- Test: `src/types/task-i18n.test.ts`

**Interfaces:**
- Produces:
  - `TaskI18nFields = { titre: string; description: string; subtasks: string[] }`
  - `TaskI18n = Partial<Record<Locale2, Partial<TaskI18nFields>>>`
  - `Task.i18n: TaskI18n`, `Subtask.i18n: Partial<Record<Locale2, { label: string }>>`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/012_task_i18n.sql`:

```sql
-- 012_task_i18n.sql — traduction bilingue des tâches (parité avec subjects.i18n, migration 009).
-- Additif : colonnes JSONB par défaut '{}'. Les colonnes plates restent source/fallback.

alter table tasks    add column if not exists i18n jsonb not null default '{}'::jsonb;
alter table subtasks add column if not exists i18n jsonb not null default '{}'::jsonb;
```

- [ ] **Step 2: Écrire le test des types (échoue à la compilation)**

Create `src/types/task-i18n.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Task, Subtask, TaskI18nFields, TaskI18n } from '@/types'

describe('Task i18n types', () => {
  it('accepte une tâche avec i18n bilingue', () => {
    const fields: TaskI18nFields = { titre: 'Build X', description: 'Do Y', subtasks: ['a', 'b'] }
    const i18n: TaskI18n = { en: fields, fr: { titre: 'Construire X' } }
    const task: Task = {
      id: '1', labo: 'paris', titre: 'Build X', description: 'Do Y',
      statut: 'to-do', difficulte: 'easy', sujet_id: 's1',
      date_creation: '2026-01-01', date_echeance: null, i18n,
    }
    const sub: Subtask['i18n'] = { fr: { label: 'étape' } }
    expect(task.i18n.en?.titre).toBe('Build X')
    expect(sub.fr?.label).toBe('étape')
  })
})
```

- [ ] **Step 3: Vérifier l'échec**

Run: `npx tsc --noEmit`
Expected: erreurs « Property 'i18n' is missing … » sur `Task`/`Subtask`.

- [ ] **Step 4: Étendre les types**

In `src/types/index.ts`, juste avant `export interface Task` (ligne ~91), ajouter :

```ts
export interface TaskI18nFields {
  titre: string
  description: string
  subtasks: string[]
}

export type TaskI18n = Partial<Record<Locale2, Partial<TaskI18nFields>>>
```

Dans `export interface Task`, ajouter après `date_echeance` :

```ts
  i18n: TaskI18n
```

Dans `export interface Subtask`, ajouter après `ordre`:

```ts
  i18n: Partial<Record<Locale2, { label: string }>>
```

- [ ] **Step 5: Vérifier que ça compile + test passe**

Run: `npx tsc --noEmit && npx vitest run src/types/task-i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/012_task_i18n.sql src/types/index.ts src/types/task-i18n.test.ts
git commit -m "feat(tasks): migration 012 + types i18n des tâches"
```

> ⚠️ **À appliquer en BDD** (comme `009`/`011`) avant que la traduction ne persiste réellement — noter dans `docs/STATUS.md` à la dernière tâche.

---

### Task 2: Prompts de génération par champ (tâches)

**Files:**
- Create: `src/lib/tasks/field-prompts.ts`
- Test: `src/lib/tasks/field-prompts.test.ts`

**Interfaces:**
- Consumes: `Lab` (`@/types`).
- Produces:
  - `type TaskAssistField = 'titre' | 'description' | 'subtask'`
  - `type TaskFieldDraft = { titre?: string; description?: string; subtask?: string; subjectTitre?: string; labo?: Lab }`
  - `isTaskAssistField(v: unknown): v is TaskAssistField`
  - `buildTaskFieldPrompt(field, draft, locale, context?): { system; user; displayPrompt }` (même forme que `buildFieldPrompt` des sujets).

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/tasks/field-prompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildTaskFieldPrompt, isTaskAssistField } from './field-prompts'

describe('buildTaskFieldPrompt', () => {
  it('reconnaît les champs valides', () => {
    expect(isTaskAssistField('titre')).toBe(true)
    expect(isTaskAssistField('nope')).toBe(false)
  })
  it('intègre le contexte du sujet et la consigne FR', () => {
    const p = buildTaskFieldPrompt('description', { titre: 'Pipeline', subjectTitre: 'Sentiment' }, 'fr')
    expect(p.system).toMatch(/français/i)
    expect(p.user).toMatch(/Pipeline/)
    expect(p.displayPrompt).toBe(p.user)
  })
  it('garde les termes techniques (instruction présente)', () => {
    const p = buildTaskFieldPrompt('titre', {}, 'en')
    expect(p.system).toMatch(/LLM|acronyms/i)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/tasks/field-prompts.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

Create `src/lib/tasks/field-prompts.ts` (calqué sur `src/lib/subjects/field-prompts.ts`, adapté aux champs de tâche) :

```ts
import type { Lab } from '@/types'

export type TaskAssistField = 'titre' | 'description' | 'subtask'
export const TASK_ASSIST_FIELDS: TaskAssistField[] = ['titre', 'description', 'subtask']
export function isTaskAssistField(v: unknown): v is TaskAssistField {
  return typeof v === 'string' && (TASK_ASSIST_FIELDS as string[]).includes(v)
}

export type Locale = 'en' | 'fr'

export type TaskFieldDraft = {
  titre?: string
  description?: string
  subtask?: string
  subjectTitre?: string
  labo?: Lab
}

export interface TaskFieldPrompt {
  system: string
  user: string
  displayPrompt: string
}

const INSTRUCTIONS: Record<TaskAssistField, { en: string; fr: string }> = {
  titre: {
    en: 'Write a short, action-oriented task title (one line, imperative mood, max ~10 words).',
    fr: "Écris un titre de tâche court et orienté action (une ligne, à l'impératif, max ~10 mots).",
  },
  description: {
    en: 'Write a concise task description (2-4 sentences): what to do, expected outcome, and any constraint. No preamble.',
    fr: 'Écris une description de tâche concise (2 à 4 phrases) : quoi faire, résultat attendu, et toute contrainte. Pas de préambule.',
  },
  subtask: {
    en: 'Write a single short sub-task label (one line, imperative, max ~10 words). Just the label.',
    fr: "Écris un seul libellé de sous-tâche court (une ligne, à l'impératif, max ~10 mots). Juste le libellé.",
  },
}

function draftContext(draft: TaskFieldDraft, locale: Locale): string {
  const fr = locale === 'fr'
  const rows: Array<[string, string | undefined]> = [
    [fr ? 'Sujet de recherche' : 'Research subject', draft.subjectTitre],
    [fr ? 'Titre de la tâche' : 'Task title', draft.titre],
    [fr ? 'Description' : 'Description', draft.description],
    [fr ? 'Sous-tâche en cours' : 'Current sub-task', draft.subtask],
  ]
  const lines = rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (lines.length === 0) return fr ? '(aucune information saisie pour le moment)' : '(no information entered yet)'
  return lines.join('\n')
}

export function buildTaskFieldPrompt(field: TaskAssistField, draft: TaskFieldDraft, locale: Locale, context?: string): TaskFieldPrompt {
  const fr = locale === 'fr'
  const system = fr
    ? "Tu es un assistant de gestion de projet pour un laboratoire de recherche (finance, économie, IA). Écris dans un français idiomatique, mais garde tels quels les termes que les chercheurs laissent en l'état : sigles/acronymes (LLM, LLMs, NLP, GPT, RAG, API, ML…), termes techniques anglais usuels (machine learning, embedding, transformer, dataset, benchmark, prompt…), noms propres, produits, modèles, jeux de données, code, symboles et unités. Ne traduis pas et n'explicite pas ces termes. Réponds uniquement avec le texte demandé : pas de guillemets, pas de préambule, pas d'explication."
    : 'You are a project-management assistant for a research lab (finance, economics, AI). Write idiomatically, but keep verbatim the terms researchers leave as-is: acronyms/initialisms (LLM, LLMs, NLP, GPT, RAG, API, ML…), established English technical terms (machine learning, embedding, transformer, dataset, benchmark, prompt…), proper nouns, products, models, datasets, code, symbols and units. Do not translate or expand these terms. Reply with only the requested text: no quotes, no preamble, no explanation.'
  const ctxLabel = fr ? 'Informations de la tâche' : 'Task information'
  let user = `${INSTRUCTIONS[field][locale]}\n\n${ctxLabel} :\n${draftContext(draft, locale)}`
  if (context && context.trim()) {
    const docLabel = fr ? 'Extraits des documents du sujet (utilise-les si pertinents)' : 'Excerpts from subject documents (use if relevant)'
    user += `\n\n${docLabel} :\n${context.trim().slice(0, 3000)}`
  }
  return { system, user, displayPrompt: user }
}
```

- [ ] **Step 4: Vérifier le test**

Run: `npx vitest run src/lib/tasks/field-prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks/field-prompts.ts src/lib/tasks/field-prompts.test.ts
git commit -m "feat(tasks): prompts de génération par champ"
```

---

### Task 3: Génération d'un champ (tâches)

**Files:**
- Create: `src/lib/tasks/generate-field.ts`
- Test: `src/lib/tasks/generate-field.test.ts`

**Interfaces:**
- Consumes: `buildTaskFieldPrompt`, `getChatProvider`/`ChatProvider` (`@/lib/llm`), `recordUsage` (`@/lib/rag/usage`).
- Produces: `generateTaskField(field, draft, locale, deps?, context?): Promise<string>` avec `GenerateTaskDeps = { provider?; record? }`.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/tasks/generate-field.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { generateTaskField } from './generate-field'

describe('generateTaskField', () => {
  it('appelle le provider et enregistre l’usage', async () => {
    const provider = { complete: vi.fn().mockResolvedValue({ content: '  Build the ingest pipeline  ', toolCalls: [] }), stream: vi.fn() }
    const record = vi.fn().mockResolvedValue(undefined)
    const out = await generateTaskField('titre', { subjectTitre: 'Sentiment' }, 'en', { provider, record })
    expect(out).toBe('Build the ingest pipeline')
    expect(provider.complete).toHaveBeenCalledOnce()
    expect(record).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/tasks/generate-field.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter** (calqué sur `src/lib/subjects/generate-field.ts`)

Create `src/lib/tasks/generate-field.ts`:

```ts
import { buildTaskFieldPrompt, type TaskAssistField, type TaskFieldDraft, type Locale } from './field-prompts'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const MAX_OUT = 220

export interface GenerateTaskDeps {
  provider?: ChatProvider
  record?: (tokensIn: number, tokensOut: number) => Promise<void>
}

export async function generateTaskField(
  field: TaskAssistField,
  draft: TaskFieldDraft,
  locale: Locale,
  deps: GenerateTaskDeps = {},
  context?: string,
): Promise<string> {
  const { system, user } = buildTaskFieldPrompt(field, draft, locale, context)
  const provider = deps.provider ?? getChatProvider()
  const completion = await provider.complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { maxTokens: MAX_OUT },
  )
  const text = (completion.content ?? '').trim()
  const tokensIn = Math.ceil((system.length + user.length) / 4)
  const tokensOut = Math.ceil(text.length / 4)
  await (deps.record ?? recordUsage)(tokensIn, tokensOut)
  return text
}
```

- [ ] **Step 4: Vérifier le test**

Run: `npx vitest run src/lib/tasks/generate-field.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks/generate-field.ts src/lib/tasks/generate-field.test.ts
git commit -m "feat(tasks): génération d'un champ via LLM"
```

---

### Task 4: Traduction groupée + buildTaskI18n

**Files:**
- Create: `src/lib/tasks/translate.ts`
- Test: `src/lib/tasks/translate.test.ts`

**Interfaces:**
- Consumes: `TaskI18nFields`, `Locale2`, `TaskI18n` (`@/types`), `getChatProvider`/`ChatProvider`, `recordUsage`.
- Produces:
  - `translateTaskFields(src: TaskI18nFields, to: Locale2, deps?): Promise<TaskI18nFields>`
  - `buildTaskI18n(src: TaskI18nFields, sourceLocale: Locale2, deps?: TranslateTaskDeps & { disabled?; overBudget? }): Promise<TaskI18n>`

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/tasks/translate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { translateTaskFields, buildTaskI18n } from './translate'
import type { TaskI18nFields } from '@/types'

const src: TaskI18nFields = { titre: 'Build pipeline', description: 'Ingest news', subtasks: ['Fetch RSS', 'Parse'] }

describe('tasks translate', () => {
  it('fusionne le JSON traduit et garde la forme', async () => {
    const provider = { complete: vi.fn().mockResolvedValue({ content: JSON.stringify({ titre: 'Construire le pipeline', description: 'Ingérer les news', subtasks: ['Récupérer RSS', 'Parser'] }), toolCalls: [] }), stream: vi.fn() }
    const out = await translateTaskFields(src, 'fr', { provider, record: vi.fn() })
    expect(out.titre).toBe('Construire le pipeline')
    expect(out.subtasks).toEqual(['Récupérer RSS', 'Parser'])
  })
  it('fallback à la source si JSON invalide', async () => {
    const provider = { complete: vi.fn().mockResolvedValue({ content: 'not json', toolCalls: [] }), stream: vi.fn() }
    const out = await translateTaskFields(src, 'fr', { provider, record: vi.fn() })
    expect(out).toEqual(src)
  })
  it('buildTaskI18n court-circuite si disabled', async () => {
    const provider = { complete: vi.fn(), stream: vi.fn() }
    const i18n = await buildTaskI18n(src, 'en', { provider, disabled: true })
    expect(provider.complete).not.toHaveBeenCalled()
    expect(i18n.en).toEqual(src)
    expect(i18n.fr).toEqual(src)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/tasks/translate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter** (calqué sur `src/lib/subjects/translate.ts`, champs `titre`/`description`/`subtasks`)

Create `src/lib/tasks/translate.ts`:

```ts
import type { TaskI18nFields, Locale2, TaskI18n } from '@/types'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const LANG_NAME: Record<Locale2, string> = { en: 'English', fr: 'French' }
const MAX_OUT = 1200

export interface TranslateTaskDeps {
  provider?: ChatProvider
  record?: (tokensIn: number, tokensOut: number) => Promise<void>
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

function mergeFields(src: TaskI18nFields, p: Partial<TaskI18nFields>): TaskI18nFields {
  return {
    titre: typeof p.titre === 'string' ? p.titre : src.titre,
    description: typeof p.description === 'string' ? p.description : src.description,
    subtasks: Array.isArray(p.subtasks) && p.subtasks.length === src.subtasks.length
      ? p.subtasks.map(String)
      : src.subtasks,
  }
}

export async function translateTaskFields(
  src: TaskI18nFields,
  to: Locale2,
  deps: TranslateTaskDeps = {},
): Promise<TaskI18nFields> {
  const provider = deps.provider ?? getChatProvider()
  const system = `You are a professional translator for an academic research lab (finance, economics, and AI). Translate every value of the given JSON object into ${LANG_NAME[to]}.

Translate idiomatically, NOT word-for-word: the result must read as if originally written by a researcher in ${LANG_NAME[to]}.

Keep VERBATIM (do not translate) any term that researchers in ${LANG_NAME[to]} conventionally leave in its original form: acronyms and initialisms (LLM, NLP, GPT, RAG, API, ML…), established English technical terms used as-is (machine learning, embedding, transformer, benchmark, dataset, prompt), proper nouns, product/model/library/dataset names, code, tickers, math symbols, numbers and units. Do not expand or explain these terms.

Keep "subtasks" an array of strings with EXACTLY the same length and order. If a whole value is already in ${LANG_NAME[to]}, return it unchanged. Reply with ONLY a JSON object with exactly the same keys — no markdown, no commentary.`
  const user = JSON.stringify(src)
  try {
    const completion = await provider.complete(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { maxTokens: MAX_OUT },
    )
    const out = (completion.content ?? '').trim()
    const parsed = JSON.parse(stripFences(out)) as Partial<TaskI18nFields>
    const tokensIn = Math.ceil((system.length + user.length) / 4)
    const tokensOut = Math.ceil(out.length / 4)
    await (deps.record ?? recordUsage)(tokensIn, tokensOut)
    return mergeFields(src, parsed)
  } catch (e) {
    console.error('translateTaskFields: falling back to source', e instanceof Error ? e.message : e)
    return src
  }
}

export async function buildTaskI18n(
  src: TaskI18nFields,
  sourceLocale: Locale2,
  deps: TranslateTaskDeps & { disabled?: boolean; overBudget?: boolean } = {},
): Promise<TaskI18n> {
  const other: Locale2 = sourceLocale === 'en' ? 'fr' : 'en'
  if (deps.disabled || deps.overBudget) {
    return { [sourceLocale]: src, [other]: src } as TaskI18n
  }
  const translated = await translateTaskFields(src, other, deps)
  return { [sourceLocale]: src, [other]: translated } as TaskI18n
}
```

- [ ] **Step 4: Vérifier le test**

Run: `npx vitest run src/lib/tasks/translate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks/translate.ts src/lib/tasks/translate.test.ts
git commit -m "feat(tasks): traduction bilingue groupée + buildTaskI18n"
```

---

### Task 5: Helper localizedTask

**Files:**
- Create: `src/lib/tasks/localized.ts`
- Test: `src/lib/tasks/localized.test.ts`

**Interfaces:**
- Consumes: `Task`, `Subtask`, `Locale2` (`@/types`).
- Produces:
  - `localizedTask(t: Task, locale: Locale2): { titre: string; description: string }`
  - `localizedSubtaskLabel(s: Pick<Subtask,'label'|'i18n'>, locale: Locale2): string`

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/tasks/localized.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { localizedTask, localizedSubtaskLabel } from './localized'
import type { Task } from '@/types'

const base: Task = {
  id: '1', labo: 'paris', titre: 'Build', description: 'Do', statut: 'to-do',
  difficulte: 'easy', sujet_id: 's', date_creation: '', date_echeance: null,
  i18n: { fr: { titre: 'Construire', description: 'Faire' } },
}

describe('localizedTask', () => {
  it('sert la locale demandée', () => {
    expect(localizedTask(base, 'fr')).toEqual({ titre: 'Construire', description: 'Faire' })
  })
  it('fallback aux colonnes plates', () => {
    expect(localizedTask(base, 'en')).toEqual({ titre: 'Build', description: 'Do' })
  })
  it('localise un label de sous-tâche avec fallback', () => {
    expect(localizedSubtaskLabel({ label: 'Fetch', i18n: { fr: { label: 'Récupérer' } } }, 'fr')).toBe('Récupérer')
    expect(localizedSubtaskLabel({ label: 'Fetch', i18n: {} }, 'fr')).toBe('Fetch')
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/tasks/localized.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

Create `src/lib/tasks/localized.ts`:

```ts
import type { Task, Subtask, Locale2 } from '@/types'

export function localizedTask(t: Task, locale: Locale2): { titre: string; description: string } {
  const tr = t.i18n?.[locale]
  return {
    titre: tr?.titre ?? t.titre,
    description: tr?.description ?? t.description,
  }
}

export function localizedSubtaskLabel(s: Pick<Subtask, 'label' | 'i18n'>, locale: Locale2): string {
  return s.i18n?.[locale]?.label ?? s.label
}
```

- [ ] **Step 4: Vérifier le test**

Run: `npx vitest run src/lib/tasks/localized.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks/localized.ts src/lib/tasks/localized.test.ts
git commit -m "feat(tasks): helper localizedTask"
```

---

### Task 6: Route `POST /api/tasks/assist`

**Files:**
- Create: `src/app/api/tasks/assist/route.ts`
- Test: `src/app/api/tasks/assist/route.test.ts`

**Interfaces:**
- Consumes: `requireMember`/`authErrorResponse`, `generateTaskField`, `isTaskAssistField`/`TaskFieldDraft`, `isOverBudget`.
- Produces: `POST` → `{ text }` ; contrat `{ field, draft, locale }` (identique à `/api/subjects/assist`, sans RAG par sujet — voir note).

> **Note** : contrairement aux sujets, on n'enrichit pas via RAG par défaut (les tâches n'ont pas de docs propres). `draft.subjectTitre` fournit le contexte. (Extension possible plus tard : retrouver les docs du sujet parent.)

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/app/api/tasks/assist/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireMember: vi.fn().mockResolvedValue({}), authErrorResponse: () => new Response('x', { status: 401 }) }))
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/tasks/generate-field', () => ({ generateTaskField: vi.fn().mockResolvedValue('Generated') }))

import { POST } from './route'

function req(body: unknown) {
  return new Request('http://x/api/tasks/assist', { method: 'POST', body: JSON.stringify(body) }) as never
}

describe('POST /api/tasks/assist', () => {
  beforeEach(() => { delete process.env.ASSISTANT_DISABLED })
  it('renvoie le texte généré', async () => {
    const res = await POST(req({ field: 'titre', draft: { subjectTitre: 'S' }, locale: 'en' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Generated' })
  })
  it('400 si champ invalide', async () => {
    const res = await POST(req({ field: 'bogus' }))
    expect(res.status).toBe(400)
  })
  it('503 si ASSISTANT_DISABLED', async () => {
    process.env.ASSISTANT_DISABLED = '1'
    const res = await POST(req({ field: 'titre' }))
    expect(res.status).toBe(503)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/app/api/tasks/assist/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter** (calqué sur `src/app/api/subjects/assist/route.ts`, sans le bloc RAG)

Create `src/app/api/tasks/assist/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { generateTaskField } from '@/lib/tasks/generate-field'
import { isTaskAssistField, type TaskFieldDraft } from '@/lib/tasks/field-prompts'
import { isOverBudget } from '@/lib/rag/usage'

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }

  if (process.env.ASSISTANT_DISABLED === '1') {
    return NextResponse.json({ error: 'assistant disabled' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const { field, draft = {}, locale = 'en' } = body as { field?: string; draft?: TaskFieldDraft; locale?: string }

  if (!field || !isTaskAssistField(field)) {
    return NextResponse.json({ error: 'invalid field' }, { status: 400 })
  }
  if (await isOverBudget()) {
    return NextResponse.json({ error: 'budget exceeded' }, { status: 503 })
  }

  try {
    const text = await generateTaskField(field, draft, locale === 'fr' ? 'fr' : 'en')
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Vérifier le test**

Run: `npx vitest run src/app/api/tasks/assist/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/assist
git commit -m "feat(tasks): route POST /api/tasks/assist"
```

---

### Task 7: Auto-traduction à la création / modification des tâches

**Files:**
- Modify: `src/app/api/tasks/route.ts:44-83` (POST)
- Modify: `src/app/api/tasks/[id]/route.ts:24-60` (PATCH)
- Modify: `src/app/api/tasks/[id]/subtasks/route.ts:7-31`
- Test: `src/app/api/tasks/translate-wire.test.ts`

**Interfaces:**
- Consumes: `buildTaskI18n` (Task 4), `isOverBudget`, `isTaskAssistField` n/a. Locale source = `body.locale` (`'en'`|`'fr'`, défaut `'en'`).
- Produces: l'objet `i18n` persistant sur `tasks`/`subtasks`.

> **Pattern** (identique aux sujets, cf. `src/app/api/subjects/route.ts`): construire `srcFields`, calculer `i18n = await buildTaskI18n(src, sourceLocale, { disabled: ASSISTANT_DISABLED, overBudget: await isOverBudget() })`, insérer dans le payload. Fallback gracieux garanti par `buildTaskI18n`.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/app/api/tasks/translate-wire.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

const insertMock = vi.fn()
vi.mock('@/lib/auth', () => ({ requireMember: vi.fn().mockResolvedValue({ session: { user: { id: 'u' } }, member: { prenom: 'A', nom: 'B' } }), getSession: vi.fn(), authErrorResponse: () => new Response('x', { status: 401 }) }))
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/tasks/translate', () => ({ buildTaskI18n: vi.fn().mockResolvedValue({ en: { titre: 'T', description: 'D', subtasks: [] }, fr: { titre: 'Tr', description: 'Dr', subtasks: [] } }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: () => ({
      insert: (rows: unknown) => { insertMock(rows); return { select: () => ({ single: () => ({ data: { id: 't1' }, error: null }) }) } },
    }),
  }),
}))
vi.mock('@/lib/constants', () => ({ VALID_LABS: ['paris', 'montreal'] }))

import { POST } from './route'
function req(body: unknown) { return new Request('http://x/api/tasks', { method: 'POST', body: JSON.stringify(body) }) as never }

describe('POST /api/tasks auto-translate', () => {
  it('persiste i18n calculé par buildTaskI18n', async () => {
    const res = await POST(req({ labo: 'paris', titre: 'T', sujet_id: 's', description: 'D', locale: 'en' }))
    expect(res.status).toBe(201)
    const { buildTaskI18n } = await import('@/lib/tasks/translate')
    expect(buildTaskI18n).toHaveBeenCalledOnce()
    const taskRow = insertMock.mock.calls[0][0]
    expect(taskRow.i18n).toBeDefined()
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/app/api/tasks/translate-wire.test.ts`
Expected: FAIL (i18n absent du row inséré).

- [ ] **Step 3: Modifier le POST `/api/tasks`**

In `src/app/api/tasks/route.ts` :
- Ajouter en tête : `import { buildTaskI18n } from '@/lib/tasks/translate'` et `import { isOverBudget } from '@/lib/rag/usage'`.
- Dans le destructuring du body (ligne ~47), ajouter `locale = 'en'`.
- Juste avant l'`insert` de la tâche (ligne ~55), construire l'i18n :

```ts
  const sourceLocale = locale === 'fr' ? 'fr' : 'en'
  const i18n = await buildTaskI18n(
    { titre, description, subtasks: subtask_labels as string[] },
    sourceLocale,
    { disabled: process.env.ASSISTANT_DISABLED === '1', overBudget: await isOverBudget() },
  )
```

- Remplacer l'insert tâche par :

```ts
  const { data: task, error } = await service
    .from('tasks')
    .insert({ labo, titre, sujet_id, description, statut, difficulte, i18n })
    .select().single()
```

- Pour les sous-tâches (ligne ~69), attacher la traduction de chaque label par index :

```ts
  if (subtask_labels.length > 0) {
    const { data: subs, error: subtaskError } = await service.from('subtasks')
      .insert(subtask_labels.map((label: string, i: number) => ({
        task_id: task.id, label, ordre: i,
        i18n: {
          [sourceLocale]: { label },
          [sourceLocale === 'en' ? 'fr' : 'en']: { label: (i18n[sourceLocale === 'en' ? 'fr' : 'en']?.subtasks ?? [])[i] ?? label },
        },
      })))
      .select()
    // … (le reste inchangé : assignees)
```

- [ ] **Step 4: Modifier le PATCH `/api/tasks/[id]`**

In `src/app/api/tasks/[id]/route.ts` :
- Ajouter `import { buildTaskI18n } from '@/lib/tasks/translate'` et `import { isOverBudget } from '@/lib/rag/usage'`.
- Après avoir construit `updates` (ligne ~31), si `titre` ou `description` changent, recalculer l'i18n :

```ts
  if ('titre' in body || 'description' in body) {
    const sourceLocale = body.locale === 'fr' ? 'fr' : 'en'
    updates.i18n = await buildTaskI18n(
      { titre: body.titre ?? '', description: body.description ?? '', subtasks: [] },
      sourceLocale,
      { disabled: process.env.ASSISTANT_DISABLED === '1', overBudget: await isOverBudget() },
    )
  }
```

(Note : `subtasks: []` — les labels de sous-tâches sont traduits via leur propre route ; on ne les retraduit pas ici.)

- [ ] **Step 5: Modifier le POST subtasks `/api/tasks/[id]/subtasks`**

In `src/app/api/tasks/[id]/subtasks/route.ts`, dans `POST`, avant l'insert :

```ts
  const { buildTaskI18n } = await import('@/lib/tasks/translate')
  const { isOverBudget } = await import('@/lib/rag/usage')
  const sourceLocale = (await req.clone().json().catch(() => ({}))).locale === 'fr' ? 'fr' : 'en'
  const i18nFull = await buildTaskI18n({ titre: '', description: '', subtasks: [label] }, sourceLocale,
    { disabled: process.env.ASSISTANT_DISABLED === '1', overBudget: await isOverBudget() })
  const other = sourceLocale === 'en' ? 'fr' : 'en'
  const subI18n = { [sourceLocale]: { label }, [other]: { label: (i18nFull[other]?.subtasks ?? [])[0] ?? label } }
```

puis `insert({ task_id, label, ordre, i18n: subI18n })`.

> Pour rester simple, on peut aussi lire `locale` dans le `await req.json()` initial (préférable au `req.clone()`). Adapter la déstructuration : `const { label, ordre = 0, locale = 'en' } = await req.json()`.

- [ ] **Step 6: Vérifier le test + suite tasks**

Run: `npx vitest run src/app/api/tasks/translate-wire.test.ts && npx vitest run src/app/api/tasks`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/tasks
git commit -m "feat(tasks): auto-traduction bilingue à la création/modif"
```

---

### Task 8: Indexation RAG bilingue des tâches

**Files:**
- Modify: `src/lib/rag/chunk.ts:50-53` (`chunkTask`)
- Test: `src/lib/rag/chunk-task.test.ts`

**Interfaces:**
- Consumes: `Task.i18n` (Task 1).
- Produces: `chunkTask(t)` émet un chunk par langue présente dans `i18n` (fallback colonnes plates).

> Le tag de langue par chunk est posé en Task 11 (champ `RawChunk.lang`). Ici on se contente de produire les contenus EN/FR.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/rag/chunk-task.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { chunkTask } from './chunk'
import type { Task } from '@/types'

const t: Task = {
  id: '1', labo: 'paris', titre: 'Build', description: 'Do', statut: 'to-do',
  difficulte: 'easy', sujet_id: 's', date_creation: '', date_echeance: null,
  i18n: { en: { titre: 'Build', description: 'Do' }, fr: { titre: 'Construire', description: 'Faire' } },
}

describe('chunkTask bilingue', () => {
  it('émet un chunk par langue', () => {
    const out = chunkTask(t)
    expect(out.some(c => c.content.includes('Construire'))).toBe(true)
    expect(out.some(c => c.content.includes('Build'))).toBe(true)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/rag/chunk-task.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter** — remplacer `chunkTask` dans `src/lib/rag/chunk.ts` :

```ts
export function chunkTask(t: Task): RawChunk[] {
  const sets: { titre: string; description: string }[] = []
  const en = t.i18n?.en
  const fr = t.i18n?.fr
  if (en) sets.push({ titre: en.titre ?? t.titre, description: en.description ?? '' })
  if (fr) sets.push({ titre: fr.titre ?? t.titre, description: fr.description ?? '' })
  if (sets.length === 0) sets.push({ titre: t.titre, description: t.description })

  return sets.map(set => {
    const desc = set.description && set.description.trim().length > 0 ? `\n${set.description.trim()}` : ''
    return { content: `${set.titre} [${t.statut}]${desc}`.trim() }
  })
}
```

- [ ] **Step 4: Vérifier le test**

Run: `npx vitest run src/lib/rag/chunk-task.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/chunk.ts src/lib/rag/chunk-task.test.ts
git commit -m "feat(rag): chunkTask bilingue"
```

---

### Task 9: Bouton ✨ générique + câblage dans AddTaskModal

**Files:**
- Create: `src/components/ui/AssistButton.tsx`
- Modify: `src/components/tasks/AddTaskModal.tsx`
- Modify: `messages/en.json` + `messages/fr.json` (namespace `tasks.editor`)
- Test: `src/components/ui/AssistButton.test.tsx`

**Interfaces:**
- Produces (composant réutilisable, indépendant des sujets) :

```ts
type AssistButtonProps = {
  generating: boolean          // ce champ est en cours de génération
  busy: boolean                // un champ (quelconque) génère déjà → désactive
  displayPrompt: string        // prompt à afficher si "voir le prompt"
  showingPrompt: boolean
  labels: { generate: string; generating: string; viewPrompt: string; hidePrompt: string; copyPrompt: string }
  onGenerate: () => void
  onTogglePrompt: () => void
}
```

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/components/ui/AssistButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssistButton } from './AssistButton'

const labels = { generate: 'Generate', generating: 'Generating…', viewPrompt: 'view prompt', hidePrompt: 'hide', copyPrompt: 'Copy' }

describe('AssistButton', () => {
  it('déclenche onGenerate et affiche le prompt', () => {
    const onGenerate = vi.fn(); const onToggle = vi.fn()
    const { rerender } = render(
      <AssistButton generating={false} busy={false} displayPrompt="P" showingPrompt={false} labels={labels} onGenerate={onGenerate} onTogglePrompt={onToggle} />)
    fireEvent.click(screen.getByText(/Generate/))
    expect(onGenerate).toHaveBeenCalled()
    fireEvent.click(screen.getByText('view prompt'))
    expect(onToggle).toHaveBeenCalled()
    rerender(<AssistButton generating={false} busy={false} displayPrompt="P" showingPrompt={true} labels={labels} onGenerate={onGenerate} onTogglePrompt={onToggle} />)
    expect(screen.getByText('P')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/components/ui/AssistButton.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter le composant** (UI identique à celui de `VitrineEditor`, mais générique)

Create `src/components/ui/AssistButton.tsx`:

```tsx
'use client'
type AssistButtonProps = {
  generating: boolean
  busy: boolean
  displayPrompt: string
  showingPrompt: boolean
  labels: { generate: string; generating: string; viewPrompt: string; hidePrompt: string; copyPrompt: string }
  onGenerate: () => void
  onTogglePrompt: () => void
}

export function AssistButton({ generating, busy, displayPrompt, showingPrompt, labels, onGenerate, onTogglePrompt }: AssistButtonProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
      <button type="button" className="font-mono" onClick={onGenerate} disabled={busy}
        style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(20,40,90,0.2)', background: 'rgba(47,68,134,0.08)', color: '#2f4486', cursor: busy ? 'wait' : 'pointer' }}>
        {generating ? `✨ ${labels.generating}` : `✨ ${labels.generate}`}
      </button>
      <button type="button" className="font-mono" onClick={onTogglePrompt}
        style={{ fontSize: 9, background: 'none', border: 'none', color: '#6b7596', cursor: 'pointer', textDecoration: 'underline' }}>
        {showingPrompt ? labels.hidePrompt : labels.viewPrompt}
      </button>
      {showingPrompt && (
        <div style={{ flexBasis: '100%' }}>
          <pre className="font-mono" style={{ whiteSpace: 'pre-wrap', fontSize: 9, background: '#f1efe7', border: '1px solid #e0ddd0', borderRadius: 5, padding: 8, color: '#3a4257', margin: '4px 0 0' }}>{displayPrompt}</pre>
          <button type="button" className="font-mono" onClick={() => navigator.clipboard?.writeText(displayPrompt)}
            style={{ fontSize: 9, marginTop: 3, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(20,40,90,0.2)', background: '#fff', cursor: 'pointer' }}>
            {labels.copyPrompt}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Ajouter les clés i18n** (parité EN/FR)

Dans `messages/en.json`, sous `"tasks"`, ajouter un objet `"editor"` (créer s'il n'existe pas) :

```json
"editor": {
  "generate": "Generate",
  "generating": "Generating…",
  "viewPrompt": "view prompt",
  "hidePrompt": "hide prompt",
  "copyPrompt": "Copy",
  "genError": "Generation failed. Try again."
}
```

Dans `messages/fr.json`, sous `"tasks"` :

```json
"editor": {
  "generate": "Générer",
  "generating": "Génération…",
  "viewPrompt": "voir le prompt",
  "hidePrompt": "masquer le prompt",
  "copyPrompt": "Copier",
  "genError": "Échec de la génération. Réessayez."
}
```

- [ ] **Step 5: Câbler dans `AddTaskModal`**

In `src/components/tasks/AddTaskModal.tsx` :
- Imports : `import { AssistButton } from '@/components/ui/AssistButton'`, `import { buildTaskFieldPrompt, type TaskAssistField } from '@/lib/tasks/field-prompts'`, `import { useToast } from '@/components/ui/Toast'`.
- État : `const [genField, setGenField] = useState<TaskAssistField | 'subtaskDraft' | null>(null)` et `const [promptField, setPromptField] = useState<string | null>(null)` ; `const { addToast } = useToast()`.
- `useTranslations('tasks')` est déjà là ; ajouter un draft builder :

```ts
  function draft() { return { titre, description, subtask: subtaskDraft, labo: lab } }
  async function generate(field: TaskAssistField, apply: (text: string) => void) {
    setGenField(field === 'subtask' ? 'subtaskDraft' : field)
    try {
      const res = await fetch('/api/tasks/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, draft: draft(), locale }) })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { text?: string }
      if (data.text) apply(data.text)
    } catch { addToast(t('editor.genError'), 'error') }
    finally { setGenField(null) }
  }
```

- `locale` provient de `useLocale()` (`import { useLocale } from 'next-intl'`) → `const locale = useLocale() === 'fr' ? 'fr' : 'en'`.
- Sous le champ Titre, ajouter :

```tsx
<AssistButton generating={genField === 'titre'} busy={genField !== null}
  displayPrompt={buildTaskFieldPrompt('titre', draft(), locale).displayPrompt}
  showingPrompt={promptField === 'titre'}
  labels={{ generate: t('editor.generate'), generating: t('editor.generating'), viewPrompt: t('editor.viewPrompt'), hidePrompt: t('editor.hidePrompt'), copyPrompt: t('editor.copyPrompt') }}
  onGenerate={() => generate('titre', setTitre)}
  onTogglePrompt={() => setPromptField(p => p === 'titre' ? null : 'titre')} />
```

- Idem sous Description (`onGenerate={() => generate('description', setDescription)}`, field `'description'`).
- Pour la sous-tâche en cours de saisie, à côté du bouton « ajouter », un ✨ qui remplit `subtaskDraft` :

```tsx
<AssistButton generating={genField === 'subtaskDraft'} busy={genField !== null}
  displayPrompt={buildTaskFieldPrompt('subtask', draft(), locale).displayPrompt}
  showingPrompt={promptField === 'subtask'}
  labels={{ generate: t('editor.generate'), generating: t('editor.generating'), viewPrompt: t('editor.viewPrompt'), hidePrompt: t('editor.hidePrompt'), copyPrompt: t('editor.copyPrompt') }}
  onGenerate={() => generate('subtask', setSubtaskDraft)}
  onTogglePrompt={() => setPromptField(p => p === 'subtask' ? null : 'subtask')} />
```

- Ajouter `locale` au body du `POST /api/tasks` dans `handleSubmit` : `locale,` (pour l'auto-traduction de Task 7).

- [ ] **Step 6: Vérifier**

Run: `npx vitest run src/components/ui/AssistButton.test.tsx && npx vitest run src/messages-parity.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/AssistButton.tsx src/components/ui/AssistButton.test.tsx src/components/tasks/AddTaskModal.tsx messages/en.json messages/fr.json
git commit -m "feat(tasks): bouton ✨ génération dans AddTaskModal"
```

---

### Task 10: Édition inline titre/description + ✨ dans TaskModal

**Files:**
- Modify: `src/components/tasks/TaskModal.tsx`
- Modify: (consommateur du modal — vérifier le câblage `onPatch`)
- Test: `src/components/tasks/TaskModal.test.tsx`

**Interfaces:**
- Consumes: `AssistButton`, `buildTaskFieldPrompt`, `localizedTask`.
- `onPatch` accepte désormais aussi `{ titre?: string; description?: string }` (étendre le type côté modal et côté parent kanban).

> TaskModal affiche actuellement titre/description en lecture seule. On ajoute, **pour les membres**, un mode édition inline (titre + description) avec ✨, sauvegardé via le `onPatch` existant (qui PATCH `/api/tasks/[id]`). Le parent passe déjà `locale` indirectement via next-intl ; le modal lit `useLocale()`.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/components/tasks/TaskModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { TaskModal } from './TaskModal'
import en from '../../../messages/en.json'
import type { TaskWithRelations } from '@/types'

const task: TaskWithRelations = {
  id: 't1', labo: 'paris', titre: 'Build', description: 'Do it', statut: 'to-do', difficulte: 'easy',
  sujet_id: 's', date_creation: '', date_echeance: null, i18n: {}, assignees: [], subtasks: [],
}
function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={en}>{ui}</NextIntlClientProvider>)
}

describe('TaskModal edition', () => {
  it('un membre peut éditer le titre et déclenche onPatch', () => {
    const onPatch = vi.fn()
    wrap(<TaskModal task={task} subjectTitle="S" isMember currentMemberId="m" onClose={() => {}} onPatch={onPatch} onToggleSubtask={() => {}} onClaim={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: en.tasks.editTitle }))
    const input = screen.getByDisplayValue('Build')
    fireEvent.change(input, { target: { value: 'Build v2' } })
    fireEvent.click(screen.getByRole('button', { name: en.tasks.editor.save }))
    expect(onPatch).toHaveBeenCalledWith('t1', expect.objectContaining({ titre: 'Build v2' }))
  })
})
```

(Ajouter `"editTitle"` et `"save"` aux clés `tasks`/`tasks.editor` ci-dessous.)

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/components/tasks/TaskModal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Ajouter les clés i18n manquantes** (parité)

`messages/en.json` → `tasks` : `"editTitle": "Edit"`. Sous `tasks.editor` : `"save": "Save"`, `"cancel": "Cancel"`.
`messages/fr.json` → `tasks` : `"editTitle": "Modifier"`. Sous `tasks.editor` : `"save": "Enregistrer"`, `"cancel": "Annuler"`.

- [ ] **Step 4: Implémenter l'édition inline**

In `src/components/tasks/TaskModal.tsx` :
- Imports : `useState` (react), `useLocale` (next-intl), `AssistButton`, `buildTaskFieldPrompt`/`TaskAssistField`, `localizedTask`.
- Étendre `Props.onPatch` :

```ts
  onPatch: (taskId: string, fields: { statut?: TaskStatus; difficulte?: Difficulty; titre?: string; description?: string }) => void
```

- Au début du composant (après `const t = …`):

```ts
  const locale = useLocale() === 'fr' ? 'fr' : 'en'
  const L = task ? localizedTask(task, locale) : { titre: '', description: '' }
  const [editing, setEditing] = useState(false)
  const [titre, setTitre] = useState(L.titre)
  const [description, setDescription] = useState(L.description)
  const [genField, setGenField] = useState<TaskAssistField | null>(null)
  const [promptField, setPromptField] = useState<string | null>(null)
  const draft = () => ({ titre, description, labo: task?.labo })
  async function generate(field: TaskAssistField, apply: (v: string) => void) {
    setGenField(field)
    try {
      const res = await fetch('/api/tasks/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, draft: draft(), locale }) })
      if (res.ok) { const d = await res.json() as { text?: string }; if (d.text) apply(d.text) }
    } finally { setGenField(null) }
  }
  function saveEdits() {
    onPatch(task!.id, { titre: titre.trim(), description: description.trim() })
    setEditing(false)
  }
```

- Remplacer l'affichage du titre (ligne ~44) et de la description (ligne ~176-182) : si `isMember && editing`, montrer des `<input>`/`<textarea>` + `AssistButton` (mêmes labels que Task 9) + boutons Save/Cancel ; sinon afficher `L.titre`/`L.description` (au lieu de `task.titre`/`task.description`) + un bouton « Modifier » (visible membre) qui passe `editing=true`.
- Le bouton « Modifier » : `aria-label={t('editTitle')}`.
- ✨ titre : `onGenerate={() => generate('titre', setTitre)}` ; ✨ description : `generate('description', setDescription)`.

- [ ] **Step 5: Propager le type étendu chez le parent**

Vérifier le composant qui rend `<TaskModal onPatch=…>` (kanban board) : sa fonction `onPatch` PATCH déjà `/api/tasks/[id]` avec un objet de champs ; comme les nouvelles clés `titre`/`description` sont dans la liste `allowed` du PATCH (Task 7 ne l'a pas changée — `titre`/`description` y sont déjà), aucun changement serveur. S'assurer que la signature TS du handler parent accepte les nouveaux champs (élargir le type si typé explicitement).

- [ ] **Step 6: Vérifier**

Run: `npx vitest run src/components/tasks/TaskModal.test.tsx && npx vitest run src/messages-parity.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/tasks/TaskModal.tsx src/components/tasks/TaskModal.test.tsx messages/en.json messages/fr.json
git commit -m "feat(tasks): édition inline titre/description + ✨ dans TaskModal"
```

---

## A2 — L'assistant répond dans la langue de la question

### Task 11: Détection de langue + injection dans le system prompt + tag de langue correct

**Files:**
- Create: `src/lib/rag/detect-lang.ts`
- Test: `src/lib/rag/detect-lang.test.ts`
- Modify: `src/lib/rag/system-prompt.ts`
- Test: `src/lib/rag/system-prompt.test.ts` (ajouter un cas)
- Modify: `src/app/api/assistant/chat/route.ts:84-86,99`
- Modify: `src/lib/rag/chunk.ts` (`RawChunk.lang`, `chunkSubject` taggé)
- Modify: `src/lib/rag/index-source.ts` (lang par chunk)
- Test: `src/lib/rag/index-lang.test.ts`

**Interfaces:**
- Produces:
  - `detectLang(text: string): 'en' | 'fr'`
  - `buildSystemPrompt(tier: Tier, chunks: RetrievedChunk[], lang?: 'en' | 'fr'): string`
  - `RawChunk = { content: string; lang?: string }`

- [ ] **Step 1: Test de `detectLang` (échoue)**

Create `src/lib/rag/detect-lang.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectLang } from './detect-lang'

describe('detectLang', () => {
  it('détecte le français via mots-outils', () => {
    expect(detectLang('Quels sont les sujets de recherche sur la finance ?')).toBe('fr')
  })
  it('détecte l’anglais', () => {
    expect(detectLang('What research subjects do you have about finance?')).toBe('en')
  })
  it('français via accents même sans mot-outil évident', () => {
    expect(detectLang('Données économétriques élevées')).toBe('fr')
  })
})
```

- [ ] **Step 2: Vérifier l'échec puis implémenter**

Run: `npx vitest run src/lib/rag/detect-lang.test.ts` → FAIL.

Create `src/lib/rag/detect-lang.ts`:

```ts
// Détection légère EN/FR : accents français + mots-outils. Suffisant pour piloter la
// langue de réponse de l'assistant (pas de dépendance lourde).
const FR_STOPWORDS = /\b(le|la|les|des|une|un|du|de|et|est|sont|quels?|quelles?|pourquoi|comment|sur|avec|pour|dans|vous|nous|votre|qui|que|quoi|où)\b/gi
const EN_STOPWORDS = /\b(the|a|an|of|and|is|are|what|why|how|on|with|for|in|you|we|your|who|which|where|do|does)\b/gi

export function detectLang(text: string): 'en' | 'fr' {
  const t = (text ?? '').toLowerCase()
  if (/[àâäçéèêëîïôöùûü]/.test(t)) return 'fr'
  const fr = (t.match(FR_STOPWORDS) ?? []).length
  const en = (t.match(EN_STOPWORDS) ?? []).length
  return fr > en ? 'fr' : 'en'
}
```

Run: `npx vitest run src/lib/rag/detect-lang.test.ts` → PASS.

- [ ] **Step 3: Test du system prompt (échoue)**

Add to `src/lib/rag/system-prompt.test.ts` (ou créer si absent) :

```ts
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './system-prompt'

describe('buildSystemPrompt language directive', () => {
  it('impose le français quand lang=fr', () => {
    const p = buildSystemPrompt('visitor', [], 'fr')
    expect(p).toMatch(/respond ENTIRELY in French/i)
  })
  it('impose l’anglais quand lang=en', () => {
    expect(buildSystemPrompt('visitor', [], 'en')).toMatch(/respond ENTIRELY in English/i)
  })
})
```

- [ ] **Step 4: Vérifier l'échec puis modifier `buildSystemPrompt`**

In `src/lib/rag/system-prompt.ts` :
- Signature : `export function buildSystemPrompt(tier: Tier, chunks: RetrievedChunk[], lang: 'en' | 'fr' = 'en'): string {`
- Remplacer la ligne `- Reply in the same language as the user's question.` par une directive forte :

```ts
    `- LANGUAGE: You MUST respond ENTIRELY in ${lang === 'fr' ? 'French' : 'English'}. Even if the sources are written in another language, translate the relevant facts and answer only in ${lang === 'fr' ? 'French' : 'English'}. Never mix two languages in the same reply.`,
```

Run: `npx vitest run src/lib/rag/system-prompt.test.ts` → PASS.

- [ ] **Step 5: Câbler la route assistant**

In `src/app/api/assistant/chat/route.ts` :
- Import : `import { detectLang } from '@/lib/rag/detect-lang'`.
- Après `const question = …` (ligne ~50) : `const lang = detectLang(question)`.
- Remplacer la détection ad hoc ligne ~85 par : `await logUnanswered(question, lang, ipHash)`.
- Ligne ~99 : `{ role: 'system', content: buildSystemPrompt(tier, chunks, lang) }`.

- [ ] **Step 6: Tag de langue par chunk (corrige `lang:'en'` codé en dur)**

In `src/lib/rag/chunk.ts` :
- `export interface RawChunk { content: string; lang?: string }`
- Dans `chunkSubject`, tagger chaque set : pour le set `en` → `lang:'en'`, set `fr` → `lang:'fr'`, fallback (colonnes plates) → pas de lang (héritera du batch). Concrètement, transformer la boucle pour porter la langue :

```ts
  const sets: { lang?: string; question: string; accroche: string; context: string; method: string; results: string }[] = []
  if (en) sets.push({ lang: 'en', question: en.question ?? '', accroche: en.accroche ?? '', context: en.context ?? '', method: en.method ?? '', results: en.results ?? '' })
  if (fr) sets.push({ lang: 'fr', question: fr.question ?? '', accroche: fr.accroche ?? '', context: fr.context ?? '', method: fr.method ?? '', results: fr.results ?? '' })
  if (sets.length === 0) sets.push({ question: s.question, accroche: s.accroche, context: s.context, method: s.method, results: s.results })
  // …
  for (const set of sets) {
    // …
    for (const [label, v] of fields) {
      if (v && v.trim().length > 0) chunks.push({ content: `${head}\n${label}: ${v.trim()}`, lang: set.lang })
    }
  }
```

In `src/lib/rag/index-source.ts`, dans `replaceChunks` (ligne ~136), utiliser la langue du chunk si présente :

```ts
    lang: c.lang ?? batch.lang,
```

(Le `batch.lang` reste le fallback ; les sources mono-langue — publications/members/tasks — gardent leur batch lang. Pour les tâches bilingues de Task 8, on peut aussi tagger : dans `chunkTask`, ajouter `lang: 'en'`/`'fr'` selon le set, comme pour les sujets.)

- [ ] **Step 7: Test d'indexation lang (échoue puis passe)**

Create `src/lib/rag/index-lang.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { chunkSubject } from './chunk'
import type { Subject } from '@/types'

const s = {
  id: '1', labo: 'paris', titre: 'T', kicker: '', question: 'Q', accroche: 'A', periode: '',
  statut: 'active', context: 'C', method: 'M', results: 'R', keywords: [], auteurs: [], difficulte: 'easy',
  dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 0, is_transversal: false,
  confidentiel: false, i18n: { en: { question: 'EN q' }, fr: { question: 'FR q' } }, created_at: '', updated_at: '',
} as unknown as Subject

describe('chunkSubject lang tagging', () => {
  it('tague les chunks FR et EN', () => {
    const out = chunkSubject(s)
    expect(out.find(c => c.content.includes('EN q'))?.lang).toBe('en')
    expect(out.find(c => c.content.includes('FR q'))?.lang).toBe('fr')
  })
})
```

Run: `npx vitest run src/lib/rag/index-lang.test.ts && npx vitest run src/lib/rag/chunk-task.test.ts` → PASS.

- [ ] **Step 8: Vérifier l'ensemble RAG + commit**

Run: `npx vitest run src/lib/rag && npx tsc --noEmit`
Expected: PASS.

```bash
git add src/lib/rag/detect-lang.ts src/lib/rag/detect-lang.test.ts src/lib/rag/system-prompt.ts src/lib/rag/system-prompt.test.ts src/lib/rag/chunk.ts src/lib/rag/index-source.ts src/lib/rag/index-lang.test.ts src/app/api/assistant/chat/route.ts
git commit -m "fix(assistant): réponse forcée dans la langue de la question + tag de langue par chunk"
```

> ⚠️ **Réindexation requise** après ce fix (`npm run index:rag`) pour que les chunks portent leur vraie langue. À noter dans `docs/STATUS.md`.

---

## A3 — Section admin dédiée pour les logs IA

### Task 12: Page `/admin/logs` + dashboard + route resolve

**Files:**
- Create: `src/app/[locale]/admin/logs/page.tsx`
- Create: `src/components/admin/LogsDashboard.tsx`
- Create: `src/app/api/admin/logs/[id]/route.ts`
- Test: `src/app/api/admin/logs/[id]/route.test.ts`
- Modify: `src/app/[locale]/admin/assistant/page.tsx` + `src/components/admin/AssistantDashboard.tsx` (lien + retrait liste)
- Modify: `messages/en.json` + `messages/fr.json` (namespace `adminLogs`)

**Interfaces:**
- Consumes: `requireAdmin`/`AuthError`, `createServiceClient`.
- Produces: `PATCH /api/admin/logs/[id]` body `{ resolved: boolean }` → met à jour `chat_unanswered.resolved`.

- [ ] **Step 1: Test de la route resolve (échoue)**

Create `src/app/api/admin/logs/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

const updateEq = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/auth', () => ({ requireAdmin: vi.fn().mockResolvedValue({}), authErrorResponse: () => new Response('x', { status: 403 }) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn().mockResolvedValue({ from: () => ({ update: () => ({ eq: updateEq }) }) }) }))

import { PATCH } from './route'
function req(body: unknown) { return new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }) as never }

describe('PATCH /api/admin/logs/[id]', () => {
  it('met à jour resolved', async () => {
    const res = await PATCH(req({ resolved: true }), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(200)
    expect(updateEq).toHaveBeenCalled()
  })
  it('400 si resolved absent', async () => {
    const res = await PATCH(req({}), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Vérifier l'échec puis implémenter la route**

Run → FAIL. Create `src/app/api/admin/logs/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const { resolved } = await req.json().catch(() => ({}))
  if (typeof resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved boolean required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { error } = await service.from('chat_unanswered').update({ resolved }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

Run → PASS.

- [ ] **Step 3: Ajouter les clés i18n `adminLogs`** (parité)

`messages/en.json` :

```json
"adminLogs": {
  "title": "Assistant logs",
  "unansweredTitle": "Unanswered questions",
  "flaggedTitle": "Flagged questions",
  "colDate": "Date", "colLang": "Lang", "colQuestion": "Question", "colReason": "Reason", "colStatus": "Status",
  "markResolved": "Mark resolved", "resolved": "Resolved", "open": "Open",
  "none": "Nothing logged yet", "backToAssistant": "← Assistant settings"
}
```

`messages/fr.json` :

```json
"adminLogs": {
  "title": "Logs de l'assistant",
  "unansweredTitle": "Questions sans réponse",
  "flaggedTitle": "Questions signalées",
  "colDate": "Date", "colLang": "Langue", "colQuestion": "Question", "colReason": "Raison", "colStatus": "Statut",
  "markResolved": "Marquer résolu", "resolved": "Résolu", "open": "À traiter",
  "none": "Aucun log pour le moment", "backToAssistant": "← Réglages de l'assistant"
}
```

- [ ] **Step 4: Implémenter le dashboard** (client)

Create `src/components/admin/LogsDashboard.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Unanswered = { id: string; question: string; lang: string; resolved: boolean; created_at: string }
type Flagged = { id: string; question: string; reason: string; created_at: string }

export function LogsDashboard({ unanswered, flagged, backHref }: { unanswered: Unanswered[]; flagged: Flagged[]; backHref: string }) {
  const t = useTranslations('adminLogs')
  const [rows, setRows] = useState(unanswered)

  async function toggle(id: string, resolved: boolean) {
    const res = await fetch(`/api/admin/logs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolved }) })
    if (res.ok) setRows(prev => prev.map(r => r.id === id ? { ...r, resolved } : r))
  }
  const fmt = (s: string) => s.slice(0, 10)

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-fame-text-dark">{t('title')}</h2>
        <a href={backHref} className="font-mono text-sm text-fame-blue underline">{t('backToAssistant')}</a>
      </div>

      <div className="rounded-lg border border-fame-ecru p-4">
        <h3 className="font-mono text-sm uppercase text-fame-text-muted mb-3">{t('unansweredTitle')}</h3>
        {rows.length === 0 ? <p className="text-fame-text-muted">{t('none')}</p> : (
          <table className="w-full text-sm text-fame-text-body">
            <thead><tr className="text-left font-mono text-xs uppercase text-fame-text-muted">
              <th className="py-1 pr-3">{t('colDate')}</th><th className="py-1 pr-3">{t('colLang')}</th>
              <th className="py-1 pr-3">{t('colQuestion')}</th><th className="py-1 pr-3">{t('colStatus')}</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-fame-ecru/60">
                  <td className="py-2 pr-3 font-mono text-xs">{fmt(r.created_at)}</td>
                  <td className="py-2 pr-3 font-mono text-xs uppercase">{r.lang}</td>
                  <td className="py-2 pr-3">{r.question}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.resolved ? t('resolved') : t('open')}</td>
                  <td className="py-2"><button onClick={() => toggle(r.id, !r.resolved)} className="font-mono text-xs text-fame-blue underline">{r.resolved ? t('open') : t('markResolved')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-fame-ecru p-4">
        <h3 className="font-mono text-sm uppercase text-fame-text-muted mb-3">{t('flaggedTitle')}</h3>
        {flagged.length === 0 ? <p className="text-fame-text-muted">{t('none')}</p> : (
          <table className="w-full text-sm text-fame-text-body">
            <thead><tr className="text-left font-mono text-xs uppercase text-fame-text-muted">
              <th className="py-1 pr-3">{t('colDate')}</th><th className="py-1 pr-3">{t('colReason')}</th><th className="py-1 pr-3">{t('colQuestion')}</th>
            </tr></thead>
            <tbody>
              {flagged.map(r => (
                <tr key={r.id} className="border-t border-fame-ecru/60">
                  <td className="py-2 pr-3 font-mono text-xs">{fmt(r.created_at)}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.reason}</td>
                  <td className="py-2 pr-3">{r.question}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Implémenter la page** (RSC, calquée sur `admin/assistant/page.tsx`)

Create `src/app/[locale]/admin/logs/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { requireAdmin, AuthError } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { LogsDashboard } from '@/components/admin/LogsDashboard'

export default async function LogsAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  try { await requireAdmin() } catch (e) {
    if (e instanceof AuthError) redirect(`/${locale}/auth/login`)
    throw e
  }
  const service = await createServiceClient()
  const { data: unanswered } = await service.from('chat_unanswered')
    .select('id, question, lang, resolved, created_at').order('created_at', { ascending: false }).limit(200)
  const { data: flagged } = await service.from('chat_flagged')
    .select('id, question, reason, created_at').order('created_at', { ascending: false }).limit(200)

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <LogsDashboard
        unanswered={(unanswered ?? []) as never}
        flagged={(flagged ?? []) as never}
        backHref={`/${locale}/admin/assistant`}
      />
    </main>
  )
}
```

- [ ] **Step 6: Lien depuis `/admin/assistant` + retrait de la liste minimale**

In `src/components/admin/AssistantDashboard.tsx` :
- Retirer la prop `unanswered` et le bloc qui l'affiche (lignes ~49-54).
- À la place, ajouter un lien : `<a href="/admin/logs" className="font-mono text-sm text-fame-blue underline">{t('viewLogs')}</a>` (utiliser un lien relatif vers la locale courante : passer `logsHref` en prop depuis la page).
- Ajouter prop `logsHref: string`.

In `src/app/[locale]/admin/assistant/page.tsx` :
- Retirer la requête `chat_unanswered` (ligne ~20) et la prop `unanswered`.
- Passer `logsHref={`/${locale}/admin/logs`}`.

Ajouter la clé i18n `adminAssistant.viewLogs` (EN: `"View assistant logs →"`, FR: `"Voir les logs de l'assistant →"`) dans les deux fichiers messages.

- [ ] **Step 7: Vérifier**

Run: `npx vitest run src/app/api/admin/logs && npx vitest run src/messages-parity.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/[locale]/admin/logs src/components/admin/LogsDashboard.tsx src/app/api/admin/logs src/components/admin/AssistantDashboard.tsx src/app/[locale]/admin/assistant/page.tsx messages/en.json messages/fr.json
git commit -m "feat(admin): section dédiée logs IA (unanswered + flagged + resolve)"
```

---

## A4 — Rendu Markdown des réponses de l'assistant

### Task 13: Renderer Markdown léger + intégration dans ChatMessageList

**Files:**
- Create: `src/components/assistant/Markdown.tsx`
- Test: `src/components/assistant/Markdown.test.tsx`
- Modify: `src/components/assistant/ChatMessageList.tsx:130-152`

**Interfaces:**
- Produces: `<Markdown text={string} />` — rend gras (`**x**`), italique (`*x*`/`_x_`), `code` inline, listes (`-`/`1.`), liens `[t](url)`, paragraphes/sauts de ligne. Marqueur non fermé → littéral (streaming-safe). Aucune dépendance externe, pas de `dangerouslySetInnerHTML`.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/components/assistant/Markdown.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('rend le gras', () => {
    const { container } = render(<Markdown text="Voici **important** ok" />)
    expect(container.querySelector('strong')?.textContent).toBe('important')
  })
  it('rend un lien externe sécurisé', () => {
    render(<Markdown text="see [FAME](https://fame.org)" />)
    const a = screen.getByText('FAME') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('https://fame.org')
    expect(a.getAttribute('rel')).toContain('noopener')
  })
  it('laisse un marqueur non fermé en littéral (streaming)', () => {
    const { container } = render(<Markdown text="partial **bold" />)
    expect(container.querySelector('strong')).toBeNull()
    expect(container.textContent).toContain('**bold')
  })
  it('rend une liste à puces', () => {
    const { container } = render(<Markdown text={'- un\n- deux'} />)
    expect(container.querySelectorAll('li').length).toBe(2)
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/components/assistant/Markdown.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter le renderer**

Create `src/components/assistant/Markdown.tsx`:

```tsx
'use client'
import React from 'react'

// Renderer Markdown minimal et tolérant au streaming. Gère : gras, italique, code inline,
// liens, listes (- / 1.), paragraphes. Un marqueur non fermé reste littéral (pas de crash).

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Ordre : liens, gras, code, italique. Regex globale unique par passe simple.
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*|_([^_]+)_)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const key = `${keyPrefix}-${i++}`
    if (m[1]) {
      nodes.push(<a key={key} href={m[3]} target="_blank" rel="noopener noreferrer" style={{ color: '#2f4486', textDecoration: 'underline' }}>{m[2]}</a>)
    } else if (m[4]) {
      nodes.push(<strong key={key}>{m[5]}</strong>)
    } else if (m[6]) {
      nodes.push(<code key={key} style={{ fontFamily: 'var(--font-ibm-plex-mono, monospace)', background: 'rgba(20,40,90,0.06)', borderRadius: 3, padding: '0 3px' }}>{m[7]}</code>)
    } else if (m[8]) {
      nodes.push(<em key={key}>{m[9] ?? m[10]}</em>)
    }
    last = pattern.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ text }: { text: string }) {
  const lines = (text ?? '').split('\n')
  const blocks: React.ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let para: string[] = []

  const flushPara = (k: string) => { if (para.length) { blocks.push(<p key={k} style={{ margin: '0 0 6px' }}>{renderInline(para.join(' '), k)}</p>); para = [] } }
  const flushList = (k: string) => {
    if (!list) return
    const items = list.items.map((it, j) => <li key={`${k}-li-${j}`}>{renderInline(it, `${k}-li-${j}`)}</li>)
    blocks.push(list.ordered ? <ol key={k} style={{ margin: '0 0 6px', paddingLeft: 18 }}>{items}</ol> : <ul key={k} style={{ margin: '0 0 6px', paddingLeft: 18 }}>{items}</ul>)
    list = null
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (bullet) { flushPara(`p-${idx}`); if (!list || list.ordered) { flushList(`l-${idx}`); list = { ordered: false, items: [] } } list.items.push(bullet[1]); return }
    if (ordered) { flushPara(`p-${idx}`); if (!list || !list.ordered) { flushList(`l-${idx}`); list = { ordered: true, items: [] } } list.items.push(ordered[1]); return }
    if (line.trim() === '') { flushPara(`p-${idx}`); flushList(`l-${idx}`); return }
    flushList(`l-${idx}`)
    para.push(line)
  })
  flushPara('p-end'); flushList('l-end')
  return <>{blocks}</>
}
```

- [ ] **Step 4: Vérifier le test**

Run: `npx vitest run src/components/assistant/Markdown.test.tsx`
Expected: PASS.

- [ ] **Step 5: Intégrer dans `ChatMessageList`**

In `src/components/assistant/ChatMessageList.tsx` :
- Import : `import { Markdown } from './Markdown'`.
- Remplacer le contenu de la bulle (ligne ~151, `{m.content}`) par un rendu conditionnel : les messages **assistant** passent par `Markdown`, les messages **user** restent en texte brut.
- Le conteneur garde `whiteSpace: 'pre-wrap'` pour l'utilisateur ; pour l'assistant, le Markdown gère lui-même les paragraphes (on peut laisser `pre-wrap`, inoffensif). Concrètement :

```tsx
                {isUser ? m.content : <Markdown text={m.content} />}
```

- [ ] **Step 6: Vérifier la suite assistant**

Run: `npx vitest run src/components/assistant && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/assistant/Markdown.tsx src/components/assistant/Markdown.test.tsx src/components/assistant/ChatMessageList.tsx
git commit -m "feat(assistant): rendu Markdown des réponses (gras/listes/liens)"
```

---

## Clôture du Plan 1

- [ ] **Step 1: Vérification globale**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: tout vert.

- [ ] **Step 2: Mettre à jour `docs/STATUS.md`**

Ajouter une entrée « Où on en est » : tâches génération/traduction LLM (migration **`012` à appliquer**), fix langue assistant (**réindexation `npm run index:rag` requise**), section `/admin/logs`, rendu Markdown. Mentionner branche/PR.

- [ ] **Step 3: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs: STATUS — lot modifs backend/LLM (P1)"
```

---

## Self-Review (rempli par l'auteur du plan)

- **Couverture spec** : A1 (Tasks 1–10), A2 (Task 11), A3 (Task 12), A4 (Task 13). ✓
- **Placeholders** : aucun `TODO`/`TBD` ; tout le code des nouveaux fichiers est fourni ; les modifications de fichiers existants citent lignes + valeurs actuelles.
- **Cohérence des types** : `TaskI18nFields`/`TaskI18n` définis en Task 1, consommés en Tasks 3/4/5/7/8 ; `buildTaskI18n` signature stable ; `buildSystemPrompt(tier,chunks,lang)` cohérent route↔prompt ; `RawChunk.lang` ajouté en Task 11 et utilisé en index-source.
- **Dépendances inter-tâches** : Task 7 dépend de 1+4 ; Task 8 de 1 ; Task 9 de 2+6 ; Task 10 de 5+9 ; Task 11 indépendante (peut être faite en parallèle) ; Tasks 12/13 indépendantes.
