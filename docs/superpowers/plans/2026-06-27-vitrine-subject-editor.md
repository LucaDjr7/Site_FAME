# Fiche Vitrine éditable + génération assistée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'ajout/édition d'un sujet par une fiche vitrine éditable inline (modale plein écran) avec génération assistée par champ (Astra/OpenAI) + prompt à copier, et faire de la vitrine le format universel des cartes de la grille du Lab, plus une carte pointillée d'ajout en fin de grille.

**Architecture :** 3 colonnes texte ajoutées à `subjects` (`question`, `accroche`, `periode`). Un composant d'affichage `SubjectVitrine` (drop-in de `SubjectCard`) rend la mini-vitrine ; un composant `VitrineEditor` (création + édition) rend le poster A4 éditable inline avec, par champ, un bouton ✨ Générer (POST `/api/subjects/assist`) et un lien « voir le prompt ». La génération réutilise `getChatProvider().complete()` et un module de prompts partagé client/serveur (`src/lib/subjects/field-prompts.ts`).

**Tech Stack :** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind v4, Supabase (service-role via API), next-intl, Vitest, OpenAI (via `src/lib/llm`).

## Global Constraints

- Next.js 16 : `params`/`searchParams` sont des `Promise` → toujours `await params`.
- i18n : zéro chaîne hardcodée dans l'UI ; toute clé ajoutée dans **`messages/en.json` ET `messages/fr.json`** (le test `src/messages-parity.test.ts` échoue sinon).
- Tous les **writes** passent par des routes `/api/` avec le **service-role client** (`createServiceClient()`), jamais d'appel mutation depuis un composant client.
- Secrets server-only : `OPENAI_API_KEY` jamais dans le bundle client ; ne jamais importer `src/lib/llm` ni `src/lib/subjects/generate-field` depuis un composant client.
- Lab slug : `paris` | `montreal`, minuscules ; valider dans les routes.
- Polices : **remap FAME** — `font-serif` (Roboto Slab) pour titres/sous-titres/accroche/numéro, `font-mono` (IBM Plex Mono) pour labels/tags/période. **Aucune** police ajoutée.
- Tokens couleur via classes `fame-*` quand possible ; les valeurs hex de la maquette (`#16263f`, `#faf9f5`…) sont remplacées par les tokens FAME (`#15203f` navy, `#faf9f5`≈`fame-sand`).
- Commits atomiques `feat:`/`fix:`/`chore:` ; mettre à jour `docs/STATUS.md` en fin de feature.
- Migration `008` (007 déjà pris par `007_match_rag_chunks.sql`).

---

### Task 1: Modèle de données — colonnes, type, RAG

**Files:**
- Create: `supabase/migrations/008_subject_vitrine.sql`
- Modify: `src/types/index.ts:39-62` (interface `Subject`)
- Modify: `src/lib/rag/chunk.ts:8-18` (`chunkSubject`)
- Test: `src/lib/rag/chunk.test.ts`

**Interfaces:**
- Produces: `Subject` gagne `question: string`, `accroche: string`, `periode: string`. `chunkSubject(s: Subject): RawChunk[]` inchangé en signature.

- [ ] **Step 1: Migration SQL**

Create `supabase/migrations/008_subject_vitrine.sql` :

```sql
-- Vague vitrine — fiche sujet éditable.
-- Additif, réversible, défauts '' (sujets existants restent valides).
ALTER TABLE subjects ADD COLUMN question text NOT NULL DEFAULT '';
ALTER TABLE subjects ADD COLUMN accroche text NOT NULL DEFAULT '';
ALTER TABLE subjects ADD COLUMN periode  text NOT NULL DEFAULT '';
```

- [ ] **Step 2: Étendre le type `Subject`**

Dans `src/types/index.ts`, ajouter les 3 champs après `kicker` (ligne 43) :

```ts
export interface Subject {
  id: string
  labo: Lab
  titre: string
  kicker: string
  question: string   // titre-question accrocheur (gros titre de la vitrine)
  accroche: string   // phrase d'accroche (bloc navy)
  periode: string    // ex. "2025–2027"
  statut: SubjectStatus
  context: string
  method: string
  results: string
  keywords: string[]
  auteurs: string[] // array of member IDs
  difficulte: Difficulty
  dimensions: {
    method: string
    data: string
    theory: string
    writing: string
  }
  ordre: number
  is_transversal: boolean
  confidentiel: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Écrire le test `chunkSubject` (échoue)**

Create `src/lib/rag/chunk.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { chunkSubject } from './chunk'
import type { Subject } from '@/types'

function makeSubject(over: Partial<Subject> = {}): Subject {
  return {
    id: '1', labo: 'paris', titre: 'T', kicker: 'K',
    question: '', accroche: '', periode: '',
    statut: 'active', context: '', method: '', results: '',
    keywords: [], auteurs: [], difficulte: 'intermediate',
    dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre: 0, is_transversal: false, confidentiel: false,
    created_at: '2026-01-01', updated_at: '2026-01-01',
    ...over,
  }
}

describe('chunkSubject', () => {
  it('includes question and accroche when present', () => {
    const joined = chunkSubject(makeSubject({ question: 'Why?', accroche: 'A hook.' }))
      .map(c => c.content).join('\n')
    expect(joined).toContain('Question: Why?')
    expect(joined).toContain('Accroche: A hook.')
  })
  it('omits empty fields', () => {
    expect(chunkSubject(makeSubject())).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Lancer le test (échoue)**

Run: `npx vitest run src/lib/rag/chunk.test.ts`
Expected: FAIL — `chunkSubject` n'émet pas `Question:`/`Accroche:`.

- [ ] **Step 5: Mettre à jour `chunkSubject`**

Dans `src/lib/rag/chunk.ts`, remplacer la fonction (lignes 8-18) :

```ts
export function chunkSubject(s: Subject): RawChunk[] {
  const base = s.kicker ? `${s.titre} — ${s.kicker}` : s.titre
  const head = s.periode ? `${base} (${s.periode})` : base
  const fields: [string, string][] = [
    ['Question', s.question],
    ['Accroche', s.accroche],
    ['Context', s.context],
    ['Method', s.method],
    ['Results', s.results],
  ]
  return fields
    .filter(([, v]) => v && v.trim().length > 0)
    .map(([label, v]) => ({ content: `${head}\n${label}: ${v.trim()}` }))
}
```

- [ ] **Step 6: Lancer le test (passe) + typecheck**

Run: `npx vitest run src/lib/rag/chunk.test.ts && npm run typecheck`
Expected: tests PASS, `tsc` OK (toute construction d'un `Subject` dans le repo doit déjà inclure les nouveaux champs ; corriger les éventuels seeds/fixtures qui instancient un `Subject` littéral — chercher avec `grep -rn "labo:" src` si `tsc` signale des littéraux incomplets).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/008_subject_vitrine.sql src/types/index.ts src/lib/rag/chunk.ts src/lib/rag/chunk.test.ts
git commit -m "feat(subjects): colonnes vitrine (question/accroche/periode) + RAG"
```

> **CHECKPOINT manuel :** appliquer `008_subject_vitrine.sql` sur la base Supabase du projet (SQL editor ou pipeline migrations) **avant** de tester les Tasks 2/4/7 de bout en bout. Sans ça, `SELECT *` / `INSERT` sur `subjects` échouent sur les nouveaux champs.

---

### Task 2: API subjects — accepter les nouveaux champs

**Files:**
- Modify: `src/app/api/subjects/route.ts:23-60` (POST)
- Modify: `src/app/api/subjects/[id]/route.ts:16-32` (PATCH)

**Interfaces:**
- Consumes: type `Subject` (Task 1).
- Produces: POST `/api/subjects` et PATCH `/api/subjects/[id]` acceptent `question`, `accroche`, `periode`, `confidentiel` (en plus de l'existant).

- [ ] **Step 1: POST — destructurer + insérer les nouveaux champs**

Dans `src/app/api/subjects/route.ts`, remplacer le bloc de destructuration et l'`insert` (lignes 28-53) :

```ts
  const body = await req.json()
  const { labo, titre, kicker = '', question = '', accroche = '', periode = '',
    statut = 'active', difficulte = 'intermediate',
    context = '', method = '', results = '', keywords = [], auteurs = [], dimensions,
    is_transversal = false, confidentiel = false } = body

  if (!VALID_LABS.includes(labo) || !titre?.trim()) {
    return NextResponse.json({ error: 'labo and titre required' }, { status: 400 })
  }

  const service = await createServiceClient()
  // Get current max ordre for this lab
  const { data: last } = await service
    .from('subjects')
    .select('ordre')
    .eq('labo', labo)
    .order('ordre', { ascending: false })
    .limit(1)
    .single()

  const ordre = (last?.ordre ?? -1) + 1

  const { data, error } = await service
    .from('subjects')
    .insert({ labo, titre, kicker, question, accroche, periode, statut, difficulte,
      context, method, results, keywords, auteurs,
      dimensions: dimensions ?? { method: '', data: '', theory: '', writing: '' }, ordre,
      is_transversal: !!is_transversal, confidentiel: !!confidentiel })
    .select()
    .single()
```

- [ ] **Step 2: PATCH — étendre la whitelist**

Dans `src/app/api/subjects/[id]/route.ts`, remplacer la ligne 20 :

```ts
  const allowed = ['titre', 'kicker', 'question', 'accroche', 'periode', 'statut', 'difficulte', 'context', 'method', 'results', 'keywords', 'auteurs', 'dimensions', 'is_transversal', 'confidentiel']
```

Et juste après la boucle (après la ligne `if ('is_transversal' in updates) ...`, ligne 25), ajouter :

```ts
  if ('confidentiel' in updates) updates.confidentiel = !!updates.confidentiel
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/subjects/route.ts src/app/api/subjects/[id]/route.ts
git commit -m "feat(api): subjects acceptent question/accroche/periode/confidentiel"
```

---

### Task 3: Module de prompts partagé (`field-prompts`)

**Files:**
- Create: `src/lib/subjects/field-prompts.ts`
- Test: `src/lib/subjects/field-prompts.test.ts`

**Interfaces:**
- Produces:
  - `type AssistField` (union des champs générables, incl. `'dimensions.method'`…)
  - `const ASSIST_FIELDS: AssistField[]`
  - `function isAssistField(v: unknown): v is AssistField`
  - `type FieldDraft` (sous-ensemble de `Subject` + `labo?`)
  - `interface FieldPrompt { system: string; user: string; displayPrompt: string }`
  - `type Locale = 'en' | 'fr'`
  - `function buildFieldPrompt(field: AssistField, draft: FieldDraft, locale: Locale): FieldPrompt`
- **Safe client + serveur** : n'importe que `import type`.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/subjects/field-prompts.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { buildFieldPrompt, isAssistField, ASSIST_FIELDS } from './field-prompts'

describe('field-prompts', () => {
  it('isAssistField recognises valid and rejects invalid', () => {
    expect(isAssistField('question')).toBe(true)
    expect(isAssistField('dimensions.method')).toBe(true)
    expect(isAssistField('nope')).toBe(false)
    expect(isAssistField(42)).toBe(false)
  })
  it('injects draft context into the user prompt', () => {
    const p = buildFieldPrompt('question', { kicker: 'AI & Finance', titre: 'XAI for credit' }, 'en')
    expect(p.user).toContain('AI & Finance')
    expect(p.user).toContain('XAI for credit')
    expect(p.displayPrompt).toBe(p.user)
    expect(p.system.length).toBeGreaterThan(0)
  })
  it('handles empty draft with a placeholder', () => {
    expect(buildFieldPrompt('accroche', {}, 'fr').user).toContain('aucune information')
  })
  it('covers every assist field without throwing', () => {
    for (const f of ASSIST_FIELDS) {
      expect(() => buildFieldPrompt(f, {}, 'en')).not.toThrow()
    }
  })
})
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run src/lib/subjects/field-prompts.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le module**

Create `src/lib/subjects/field-prompts.ts` :

```ts
import type { Subject, Lab } from '@/types'

export type AssistField =
  | 'question' | 'titre' | 'accroche' | 'kicker'
  | 'context' | 'method' | 'results'
  | 'dimensions.method' | 'dimensions.data' | 'dimensions.theory' | 'dimensions.writing'

export const ASSIST_FIELDS: AssistField[] = [
  'question', 'titre', 'accroche', 'kicker', 'context', 'method', 'results',
  'dimensions.method', 'dimensions.data', 'dimensions.theory', 'dimensions.writing',
]

export function isAssistField(v: unknown): v is AssistField {
  return typeof v === 'string' && (ASSIST_FIELDS as string[]).includes(v)
}

export type Locale = 'en' | 'fr'

export type FieldDraft = Partial<Pick<Subject,
  'question' | 'titre' | 'accroche' | 'kicker' | 'context' | 'method' | 'results' | 'keywords'>>
  & { labo?: Lab }

export interface FieldPrompt {
  system: string
  user: string
  displayPrompt: string
}

const INSTRUCTIONS: Record<AssistField, { en: string; fr: string }> = {
  question: {
    en: 'Write a short, striking research question to use as a poster headline (max ~6 words, two fragments allowed). It should hook a curious reader.',
    fr: "Écris une question de recherche courte et frappante, en tête d'affiche (max ~6 mots, deux fragments possibles). Elle doit accrocher un lecteur curieux.",
  },
  titre: {
    en: 'Write a precise academic title for this research subject (one line, formal register).',
    fr: 'Écris un titre académique précis pour ce sujet de recherche (une ligne, registre formel).',
  },
  accroche: {
    en: 'Write a single accessible sentence (max ~20 words) conveying why this subject matters.',
    fr: 'Écris une seule phrase accessible (max ~20 mots) qui dit pourquoi ce sujet compte.',
  },
  kicker: {
    en: 'Write a short domain label of the form "Research · Field A & Field B" (max ~5 words).',
    fr: 'Écris un court intitulé de domaine de la forme « Recherche · Domaine A & Domaine B » (max ~5 mots).',
  },
  context: {
    en: 'Write a concise context paragraph (3-5 sentences) framing the problem and motivation.',
    fr: 'Écris un paragraphe de contexte concis (3 à 5 phrases) posant le problème et la motivation.',
  },
  method: {
    en: 'Write a concise paragraph describing the proposed method or approach.',
    fr: "Écris un paragraphe concis décrivant la méthode ou l'approche proposée.",
  },
  results: {
    en: 'Write a concise paragraph describing expected results or contributions.',
    fr: 'Écris un paragraphe concis décrivant les résultats ou contributions attendus.',
  },
  'dimensions.method': {
    en: 'Write a one-line note on the methodological dimension of this subject.',
    fr: 'Écris une note d’une ligne sur la dimension méthodologique de ce sujet.',
  },
  'dimensions.data': {
    en: 'Write a one-line note on the data dimension (sources, scale) of this subject.',
    fr: 'Écris une note d’une ligne sur la dimension données (sources, échelle) de ce sujet.',
  },
  'dimensions.theory': {
    en: 'Write a one-line note on the theoretical dimension of this subject.',
    fr: 'Écris une note d’une ligne sur la dimension théorique de ce sujet.',
  },
  'dimensions.writing': {
    en: 'Write a one-line note on the writing/output dimension (paper, report) of this subject.',
    fr: 'Écris une note d’une ligne sur la dimension rédaction/livrable (article, rapport) de ce sujet.',
  },
}

function draftContext(draft: FieldDraft, locale: Locale): string {
  const fr = locale === 'fr'
  const rows: Array<[string, string | undefined]> = [
    [fr ? 'Domaine' : 'Domain', draft.kicker],
    [fr ? 'Titre académique' : 'Academic title', draft.titre],
    [fr ? 'Question' : 'Question', draft.question],
    [fr ? 'Accroche' : 'Hook', draft.accroche],
    ['Context', draft.context],
    ['Method', draft.method],
    ['Results', draft.results],
    [fr ? 'Mots-clés' : 'Keywords', draft.keywords?.length ? draft.keywords.join(', ') : undefined],
  ]
  const lines = rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (lines.length === 0) return fr ? '(aucune information saisie pour le moment)' : '(no information entered yet)'
  return lines.join('\n')
}

export function buildFieldPrompt(field: AssistField, draft: FieldDraft, locale: Locale): FieldPrompt {
  const fr = locale === 'fr'
  const system = fr
    ? "Tu es un assistant de rédaction scientifique pour un laboratoire de recherche. Réponds uniquement avec le texte demandé : pas de guillemets, pas de préambule, pas d'explication."
    : 'You are a scientific writing assistant for a research lab. Reply with only the requested text: no quotes, no preamble, no explanation.'
  const ctxLabel = fr ? 'Informations du sujet' : 'Subject information'
  const user = `${INSTRUCTIONS[field][locale]}\n\n${ctxLabel} :\n${draftContext(draft, locale)}`
  return { system, user, displayPrompt: user }
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run src/lib/subjects/field-prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subjects/field-prompts.ts src/lib/subjects/field-prompts.test.ts
git commit -m "feat(subjects): module de prompts de génération partagé"
```

---

### Task 4: Génération par champ — lib + route `/api/subjects/assist`

**Files:**
- Create: `src/lib/subjects/generate-field.ts`
- Test: `src/lib/subjects/generate-field.test.ts`
- Create: `src/app/api/subjects/assist/route.ts`

**Interfaces:**
- Consumes: `buildFieldPrompt`, `AssistField`, `FieldDraft`, `isAssistField` (Task 3) ; `getChatProvider`, `ChatProvider` (`src/lib/llm`) ; `recordUsage`, `isOverBudget` (`src/lib/rag/usage`) ; `requireMember`, `authErrorResponse` (`src/lib/auth`).
- Produces: `generateField(field, draft, locale, deps?): Promise<string>` ; route POST `/api/subjects/assist` renvoyant `{ text }` ou `{ error }`.

- [ ] **Step 1: Écrire le test de la lib (échoue)**

Create `src/lib/subjects/generate-field.test.ts` :

```ts
import { describe, it, expect, vi } from 'vitest'
import { generateField } from './generate-field'
import type { ChatProvider } from '@/lib/llm'

function fakeProvider(content: string): ChatProvider {
  return {
    // eslint-disable-next-line require-yield
    async *stream() { return },
    async complete() { return { content, toolCalls: [] } },
  }
}

describe('generateField', () => {
  it('returns trimmed model text and records usage', async () => {
    const record = vi.fn(async () => {})
    const text = await generateField('question', { kicker: 'AI' }, 'en', {
      provider: fakeProvider('  Why refused?  '),
      record,
    })
    expect(text).toBe('Why refused?')
    expect(record).toHaveBeenCalledOnce()
  })

  it('returns empty string when model yields no content', async () => {
    const text = await generateField('accroche', {}, 'fr', {
      provider: fakeProvider(''),
      record: async () => {},
    })
    expect(text).toBe('')
  })
})
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run src/lib/subjects/generate-field.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `generate-field.ts`**

Create `src/lib/subjects/generate-field.ts` :

```ts
import { buildFieldPrompt, type AssistField, type FieldDraft, type Locale } from './field-prompts'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const MAX_OUT = 220

export interface GenerateDeps {
  provider?: ChatProvider
  record?: (tokensIn: number, tokensOut: number) => Promise<void>
}

export async function generateField(
  field: AssistField,
  draft: FieldDraft,
  locale: Locale,
  deps: GenerateDeps = {},
): Promise<string> {
  const { system, user } = buildFieldPrompt(field, draft, locale)
  const provider = deps.provider ?? getChatProvider()
  const completion = await provider.complete(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: MAX_OUT },
  )
  const text = (completion.content ?? '').trim()
  // Estimation grossière de tokens (le provider ne renvoie pas l'usage ici) : ~4 chars/token.
  const tokensIn = Math.ceil((system.length + user.length) / 4)
  const tokensOut = Math.ceil(text.length / 4)
  await (deps.record ?? recordUsage)(tokensIn, tokensOut)
  return text
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run src/lib/subjects/generate-field.test.ts`
Expected: PASS.

- [ ] **Step 5: Implémenter la route**

Create `src/app/api/subjects/assist/route.ts` :

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { generateField } from '@/lib/subjects/generate-field'
import { isAssistField, type FieldDraft } from '@/lib/subjects/field-prompts'
import { isOverBudget } from '@/lib/rag/usage'

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }

  if (process.env.ASSISTANT_DISABLED === '1') {
    return NextResponse.json({ error: 'assistant disabled' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const { field, draft = {}, locale = 'en' } = body as { field?: string; draft?: FieldDraft; locale?: string }

  if (!field || !isAssistField(field)) {
    return NextResponse.json({ error: 'invalid field' }, { status: 400 })
  }
  if (await isOverBudget()) {
    return NextResponse.json({ error: 'budget exceeded' }, { status: 503 })
  }

  try {
    const text = await generateField(field, draft, locale === 'fr' ? 'fr' : 'en')
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: 'generation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add src/lib/subjects/generate-field.ts src/lib/subjects/generate-field.test.ts src/app/api/subjects/assist/route.ts
git commit -m "feat(api): génération de champ vitrine via /api/subjects/assist"
```

---

### Task 5: i18n — clés vitrine + éditeur (en + fr)

**Files:**
- Modify: `messages/en.json` (objet `lab`)
- Modify: `messages/fr.json` (objet `lab`)

**Interfaces:**
- Produces: clés `lab.vitrine.*`, `lab.editor.*`, `lab.toast.updated` (consommées par Tasks 6-8).

- [ ] **Step 1: Ajouter les clés EN**

Dans `messages/en.json`, à l'intérieur de l'objet `"lab"`, ajouter `"updated": "Subject updated"` dans `"toast"`, puis ajouter ces deux objets (p. ex. après `"transversalBadge"`) :

```json
    "vitrine": {
      "ficheLabel": "Subject sheet",
      "theQuestion": "The question",
      "readSubject": "Read the subject →",
      "addCard": "Add a subject"
    },
    "editor": {
      "createTitle": "New subject sheet",
      "editTitle": "Edit subject sheet",
      "details": "Full details",
      "fQuestion": "Question (headline)",
      "fTitre": "Academic title",
      "fKicker": "Domain",
      "fAccroche": "Hook",
      "fPeriode": "Period",
      "fStatus": "Status",
      "fDifficulty": "Difficulty",
      "fKeywords": "Keywords (comma-separated)",
      "fResponsable": "Author",
      "fContext": "Context",
      "fMethod": "Method",
      "fResults": "Results",
      "dimMethod": "Method dimension",
      "dimData": "Data dimension",
      "dimTheory": "Theory dimension",
      "dimWriting": "Writing dimension",
      "generate": "Generate",
      "generating": "Generating…",
      "viewPrompt": "view prompt",
      "hidePrompt": "hide prompt",
      "copyPrompt": "Copy",
      "transversal": "Transversal — visible in both labs",
      "confidentiel": "Confidential — hidden from visitors",
      "save": "Save",
      "saving": "Saving…",
      "cancel": "Cancel",
      "errorRequired": "An academic title is required.",
      "genError": "Generation unavailable",
      "none": "None"
    }
```

- [ ] **Step 2: Ajouter les clés FR (mêmes clés)**

Dans `messages/fr.json`, dans l'objet `"lab"`, ajouter `"updated": "Sujet mis à jour"` dans `"toast"`, puis :

```json
    "vitrine": {
      "ficheLabel": "Fiche sujet",
      "theQuestion": "La question",
      "readSubject": "Lire le sujet →",
      "addCard": "Ajouter un sujet"
    },
    "editor": {
      "createTitle": "Nouvelle fiche sujet",
      "editTitle": "Modifier la fiche sujet",
      "details": "Détails complets",
      "fQuestion": "Question (gros titre)",
      "fTitre": "Titre académique",
      "fKicker": "Domaine",
      "fAccroche": "Accroche",
      "fPeriode": "Période",
      "fStatus": "Statut",
      "fDifficulty": "Difficulté",
      "fKeywords": "Mots-clés (séparés par des virgules)",
      "fResponsable": "Auteur",
      "fContext": "Contexte",
      "fMethod": "Méthode",
      "fResults": "Résultats",
      "dimMethod": "Dimension méthode",
      "dimData": "Dimension données",
      "dimTheory": "Dimension théorie",
      "dimWriting": "Dimension rédaction",
      "generate": "Générer",
      "generating": "Génération…",
      "viewPrompt": "voir le prompt",
      "hidePrompt": "masquer le prompt",
      "copyPrompt": "Copier",
      "transversal": "Transversal — visible dans les deux labos",
      "confidentiel": "Confidentiel — masqué aux visiteurs",
      "save": "Enregistrer",
      "saving": "Enregistrement…",
      "cancel": "Annuler",
      "errorRequired": "Un titre académique est requis.",
      "genError": "Génération indisponible",
      "none": "Aucun"
    }
```

- [ ] **Step 3: Vérifier la parité i18n**

Run: `npx vitest run src/messages-parity.test.ts`
Expected: PASS (les deux fichiers ont exactement les mêmes clés).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/fr.json
git commit -m "feat(i18n): clés vitrine + éditeur de sujet (en/fr)"
```

---

### Task 6: `SubjectVitrine` — carte d'affichage (drop-in de `SubjectCard`)

**Files:**
- Create: `src/lib/subjects/vitrine.ts`
- Test: `src/lib/subjects/vitrine.test.ts`
- Create: `src/components/lab/SubjectVitrine.tsx`

**Interfaces:**
- Consumes: `Subject`, `MemberRef`, `Avatar`.
- Produces:
  - `vitrineHeadline(s)`, `vitrineSubtitle(s)`, `vitrineNumber(ordre)` (helpers purs).
  - Composant `SubjectVitrine` avec props : `subject, members, editMode, isDragging?, statusLabel, doneLabel, ficheLabel, questionLabel, readLabel, transversalLabel?, deleteTitle?, editTitle?, onDelete?, onEdit?, onCardClick?`.

- [ ] **Step 1: Écrire le test des helpers (échoue)**

Create `src/lib/subjects/vitrine.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { vitrineHeadline, vitrineSubtitle, vitrineNumber } from './vitrine'

describe('vitrine helpers', () => {
  it('uses question as headline when present, titre as subtitle', () => {
    const s = { question: 'Why refused?', titre: 'XAI for credit' }
    expect(vitrineHeadline(s)).toBe('Why refused?')
    expect(vitrineSubtitle(s)).toBe('XAI for credit')
  })
  it('falls back to titre as headline when question empty, no subtitle', () => {
    const s = { question: '  ', titre: 'XAI for credit' }
    expect(vitrineHeadline(s)).toBe('XAI for credit')
    expect(vitrineSubtitle(s)).toBe('')
  })
  it('formats the index number 1-based, zero-padded to 3', () => {
    expect(vitrineNumber(0)).toBe('001')
    expect(vitrineNumber(13)).toBe('014')
  })
})
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run src/lib/subjects/vitrine.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter les helpers**

Create `src/lib/subjects/vitrine.ts` :

```ts
import type { Subject } from '@/types'

/** Gros titre : la question si présente, sinon le titre académique (fallback). */
export function vitrineHeadline(s: Pick<Subject, 'question' | 'titre'>): string {
  return s.question && s.question.trim() ? s.question : s.titre
}

/** Sous-titre italique : le titre académique, seulement si la question occupe le gros titre. */
export function vitrineSubtitle(s: Pick<Subject, 'question' | 'titre'>): string {
  return s.question && s.question.trim() ? s.titre : ''
}

/** Numéro d'index affiché (ordre 0 → "001"). */
export function vitrineNumber(ordre: number): string {
  return String(ordre + 1).padStart(3, '0')
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run src/lib/subjects/vitrine.test.ts`
Expected: PASS.

- [ ] **Step 5: Implémenter `SubjectVitrine`**

Create `src/components/lab/SubjectVitrine.tsx` :

```tsx
import type { Subject, MemberRef } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { vitrineHeadline, vitrineSubtitle, vitrineNumber } from '@/lib/subjects/vitrine'

const STATUS_COLOR: Record<string, string> = {
  active: '#1e9b7e', 'on-hold': '#e8b149', done: '#2f4486',
}

type Props = {
  subject: Subject
  members: MemberRef[]
  editMode: boolean
  isDragging?: boolean
  statusLabel: string
  doneLabel: string
  ficheLabel: string
  questionLabel: string
  readLabel: string
  transversalLabel?: string
  deleteTitle?: string
  editTitle?: string
  onDelete?: () => void
  onEdit?: () => void
  onCardClick?: () => void
}

export function SubjectVitrine({
  subject, members, editMode, isDragging = false,
  statusLabel, doneLabel, ficheLabel, questionLabel, readLabel,
  transversalLabel, deleteTitle, editTitle, onDelete, onEdit, onCardClick,
}: Props) {
  const author = subject.auteurs[0] ? members.find(m => m.id === subject.auteurs[0]) : null
  const authorName = author ? `${author.prenom} ${author.nom}` : null
  const headline = vitrineHeadline(subject)
  const subtitle = vitrineSubtitle(subject)
  const number = vitrineNumber(subject.ordre)

  return (
    <div style={{ position: 'relative' }}>
      {editMode && onDelete && (
        <button className="font-mono bg-fame-red text-white" onClick={e => { e.stopPropagation(); onDelete() }} title={deleteTitle}
          style={{ position: 'absolute', top: -8, right: -8, zIndex: 10, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      )}
      {editMode && onEdit && (
        <button className="font-mono bg-fame-blue text-white" onClick={e => { e.stopPropagation(); onEdit() }} title={editTitle}
          style={{ position: 'absolute', top: -8, right: 20, zIndex: 10, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✎</button>
      )}

      <button className={`poster${isDragging ? ' dragging' : ''}`} onClick={editMode ? undefined : onCardClick}
        style={{ aspectRatio: '1 / 1.414', width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: editMode ? 'default' : 'pointer', position: 'relative', display: 'block' }}>
        <div className="poster-inner" style={{ background: '#faf9f5', borderRadius: 6, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', transition: 'transform 0.25s cubic-bezier(.2,.7,.2,1), box-shadow 0.25s ease' }}>
          {/* Light top */}
          <div style={{ flex: '1.85 1 0', padding: '10px 11px 8px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="font-mono" style={{ fontSize: 7.5, letterSpacing: '0.12em', color: '#3a5a8a', textTransform: 'uppercase', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{subject.kicker || statusLabel}</span>
              <span className="font-mono" style={{ fontSize: 7, letterSpacing: '0.08em', color: '#b3ada0', textTransform: 'uppercase', flexShrink: 0, marginLeft: 6 }}>{ficheLabel}</span>
            </div>
            <div style={{ height: 1, background: '#16263f', margin: '6px 0 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="font-serif" style={{ fontWeight: 300, fontSize: 34, lineHeight: 1, color: '#16263f', letterSpacing: '-0.02em', marginTop: 2 }}>{number}</span>
              <span className="font-mono" style={{ fontSize: 6.5, letterSpacing: '0.05em', color: '#a9a395', textTransform: 'uppercase', textAlign: 'right', marginTop: 4, lineHeight: 1.6 }}>
                {subject.periode}{subject.periode ? <br /> : null}{statusLabel}
              </span>
            </div>
            <div style={{ flex: 1 }} />
            <span className="font-mono" style={{ fontSize: 7, letterSpacing: '0.1em', color: '#9a9485', textTransform: 'uppercase', marginBottom: 4 }}>{questionLabel}</span>
            <span className="font-serif" style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.04, color: '#16263f', letterSpacing: '-0.02em', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{headline}</span>
            {subtitle && <span className="font-serif" style={{ fontStyle: 'italic', fontSize: 9, color: '#6a7589', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subtitle}</span>}
          </div>
          {/* Navy bottom */}
          <div style={{ flex: '1 1 0', background: '#15203f', padding: '9px 11px 8px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {subject.accroche && <span className="font-serif" style={{ fontStyle: 'italic', fontSize: 9.5, lineHeight: 1.4, color: '#cdd8ea', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subject.accroche}</span>}
            <div style={{ flex: 1 }} />
            {subject.keywords.length > 0 && (
              <div className="font-mono" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 6.5, color: '#7fa3d4', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6, maxHeight: 18, overflow: 'hidden' }}>
                {subject.keywords.slice(0, 3).map((k, i) => <span key={i}>{k}</span>)}
              </div>
            )}
            <div style={{ height: 1, background: '#23344f', marginBottom: 6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                {authorName ? <Avatar name={authorName} photoUrl={author?.photo_url} size={16} /> : null}
                <span className="font-mono" style={{ fontSize: 7.5, color: '#e7ecf4', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{authorName ?? ''}</span>
              </div>
              <span className="font-mono" style={{ fontSize: 7.5, fontWeight: 700, color: '#7fa3d4', flexShrink: 0 }}>{readLabel}</span>
            </div>
          </div>

          {subject.is_transversal && transversalLabel && (
            <span className="font-mono text-fame-teal" style={{ position: 'absolute', top: 6, right: 6, fontSize: 7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(30,155,126,0.14)', border: '1px solid rgba(30,155,126,0.35)', borderRadius: 8, padding: '1px 4px' }}>{transversalLabel}</span>
          )}
          {subject.statut === 'done' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="font-mono text-fame-coral" style={{ transform: 'rotate(-15deg)', border: '2.5px solid', borderRadius: 4, padding: '3px 8px', fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>{doneLabel}</div>
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
```

> Note : `STATUS_COLOR` est conservé pour parité visuelle avec `SubjectCard` si on veut colorer le statut plus tard ; il peut rester inutilisé. Si `npm run lint` signale une variable inutilisée, supprimer `STATUS_COLOR`.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add src/lib/subjects/vitrine.ts src/lib/subjects/vitrine.test.ts src/components/lab/SubjectVitrine.tsx
git commit -m "feat(lab): composant SubjectVitrine (carte format vitrine)"
```

---

### Task 7: `VitrineEditor` — modale création/édition + génération

**Files:**
- Create: `src/components/lab/VitrineEditor.tsx`

**Interfaces:**
- Consumes: `Subject`, `MemberRef`, `Lab`, `SubjectStatus`, `Difficulty` ; `buildFieldPrompt`, `AssistField`, `FieldDraft` (Task 3) ; `useToast`.
- Produces: composant `VitrineEditor` avec props : `open, lab, members, subject (null = création), locale: 'en'|'fr', onClose, onSaved(subject, isNew)`.
- **Doit être monté avec une `key` distincte par sujet** (état initialisé une fois depuis `subject`).

- [ ] **Step 1: Implémenter le composant**

Create `src/components/lab/VitrineEditor.tsx` :

```tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Subject, MemberRef, Lab, SubjectStatus, Difficulty } from '@/types'
import { buildFieldPrompt, type AssistField, type FieldDraft } from '@/lib/subjects/field-prompts'
import { useToast } from '@/components/ui/Toast'

type Props = {
  open: boolean
  lab: Lab
  members: MemberRef[]
  subject: Subject | null
  locale: 'en' | 'fr'
  onClose: () => void
  onSaved: (subject: Subject, isNew: boolean) => void
}

const STATUSES: SubjectStatus[] = ['active', 'on-hold', 'done']
const DIFFS: Difficulty[] = ['easy', 'intermediate', 'advanced']

export function VitrineEditor({ open, lab, members, subject, locale, onClose, onSaved }: Props) {
  const t = useTranslations('lab')
  const tStatus = useTranslations('lab.status')
  const tDiff = useTranslations('lab.difficulty')
  const { addToast } = useToast()
  const isNew = !subject

  const [f, setF] = useState(() => ({
    question: subject?.question ?? '',
    titre: subject?.titre ?? '',
    kicker: subject?.kicker ?? '',
    accroche: subject?.accroche ?? '',
    periode: subject?.periode ?? '',
    statut: (subject?.statut ?? 'active') as SubjectStatus,
    difficulte: (subject?.difficulte ?? 'intermediate') as Difficulty,
    responsable: subject?.auteurs[0] ?? '',
    keywords: subject?.keywords.join(', ') ?? '',
    context: subject?.context ?? '',
    method: subject?.method ?? '',
    results: subject?.results ?? '',
    dimMethod: subject?.dimensions.method ?? '',
    dimData: subject?.dimensions.data ?? '',
    dimTheory: subject?.dimensions.theory ?? '',
    dimWriting: subject?.dimensions.writing ?? '',
    isTransversal: subject?.is_transversal ?? false,
    confidentiel: subject?.confidentiel ?? false,
  }))
  type Form = typeof f
  function set<K extends keyof Form>(k: K, v: Form[K]) { setF(prev => ({ ...prev, [k]: v })) }

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [genField, setGenField] = useState<AssistField | null>(null)
  const [promptField, setPromptField] = useState<AssistField | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function currentDraft(): FieldDraft {
    return {
      labo: lab,
      question: f.question, titre: f.titre, kicker: f.kicker, accroche: f.accroche,
      context: f.context, method: f.method, results: f.results,
      keywords: f.keywords.split(',').map(s => s.trim()).filter(Boolean),
    }
  }

  function applyField(field: AssistField, text: string) {
    const map: Record<AssistField, keyof Form> = {
      question: 'question', titre: 'titre', accroche: 'accroche', kicker: 'kicker',
      context: 'context', method: 'method', results: 'results',
      'dimensions.method': 'dimMethod', 'dimensions.data': 'dimData',
      'dimensions.theory': 'dimTheory', 'dimensions.writing': 'dimWriting',
    }
    set(map[field], text as never)
  }

  async function generate(field: AssistField) {
    setGenField(field)
    try {
      const res = await fetch('/api/subjects/assist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, draft: currentDraft(), locale }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { text?: string }
      if (data.text) applyField(field, data.text)
    } catch {
      addToast(t('editor.genError'), 'error')
    } finally {
      setGenField(null)
    }
  }

  async function save() {
    if (!f.titre.trim()) { setError(t('editor.errorRequired')); return }
    setError(''); setSaving(true)
    const payload = {
      labo: lab,
      question: f.question.trim(), titre: f.titre.trim(), kicker: f.kicker.trim(),
      accroche: f.accroche.trim(), periode: f.periode.trim(),
      statut: f.statut, difficulte: f.difficulte,
      auteurs: f.responsable ? [f.responsable] : [],
      keywords: f.keywords.split(',').map(s => s.trim()).filter(Boolean),
      context: f.context.trim(), method: f.method.trim(), results: f.results.trim(),
      dimensions: { method: f.dimMethod.trim(), data: f.dimData.trim(), theory: f.dimTheory.trim(), writing: f.dimWriting.trim() },
      is_transversal: f.isTransversal, confidentiel: f.confidentiel,
    }
    try {
      const res = await fetch(isNew ? '/api/subjects' : `/api/subjects/${subject!.id}`, {
        method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setError((e as { error?: string }).error ?? t('error.server')); return
      }
      const saved = (await res.json()) as Subject
      onSaved(saved, isNew)
    } catch {
      setError(t('error.network'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const labelStyle: React.CSSProperties = { fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9485', display: 'block', marginBottom: 3 }
  const inputBase: React.CSSProperties = { width: '100%', background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(20,40,90,0.25)', outline: 'none', padding: '2px 0', color: '#16263f' }
  const detailInput: React.CSSProperties = { width: '100%', background: '#fff', border: '1px solid rgba(20,40,90,0.18)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#2a3457', outline: 'none', resize: 'vertical' }

  function Assist({ field }: { field: AssistField }) {
    const showing = promptField === field
    const prompt = buildFieldPrompt(field, currentDraft(), locale).displayPrompt
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <button type="button" className="font-mono" onClick={() => generate(field)} disabled={genField !== null}
          style={{ fontSize: 9, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(20,40,90,0.2)', background: 'rgba(47,68,134,0.08)', color: '#2f4486', cursor: genField ? 'wait' : 'pointer' }}>
          {genField === field ? `✨ ${t('editor.generating')}` : `✨ ${t('editor.generate')}`}
        </button>
        <button type="button" className="font-mono" onClick={() => setPromptField(showing ? null : field)}
          style={{ fontSize: 9, background: 'none', border: 'none', color: '#6b7596', cursor: 'pointer', textDecoration: 'underline' }}>
          {showing ? t('editor.hidePrompt') : t('editor.viewPrompt')}
        </button>
        {showing && (
          <div style={{ flexBasis: '100%' }}>
            <pre className="font-mono" style={{ whiteSpace: 'pre-wrap', fontSize: 9, background: '#f1efe7', border: '1px solid #e0ddd0', borderRadius: 5, padding: 8, color: '#3a4257', margin: '4px 0 0' }}>{prompt}</pre>
            <button type="button" className="font-mono" onClick={() => navigator.clipboard?.writeText(prompt)}
              style={{ fontSize: 9, marginTop: 3, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(20,40,90,0.2)', background: '#fff', cursor: 'pointer' }}>
              {t('editor.copyPrompt')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={isNew ? t('editor.createTitle') : t('editor.editTitle')}
        className="bg-fame-sand rounded-xl shadow-2xl w-full mx-4 my-8"
        style={{ maxWidth: 640, animation: 'modalIn 0.15s ease' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-fame-ecru">
          <h2 className="font-serif text-lg text-fame-blue-dark">{isNew ? t('editor.createTitle') : t('editor.editTitle')}</h2>
          <button onClick={onClose} aria-label={t('editor.cancel')} className="text-xl leading-none text-fame-text-muted">×</button>
        </div>

        <div className="p-6">
          {/* ── Editable poster ── */}
          {/* Light top */}
          <div style={{ background: '#faf9f5', borderRadius: 8, padding: 18, boxShadow: '0 4px 18px rgba(20,38,63,.1)' }}>
            <div>
              <label className="font-mono" style={labelStyle}>{t('editor.fKicker')}</label>
              <input className="font-mono" value={f.kicker} onChange={e => set('kicker', e.target.value)} placeholder="Recherche · …" style={{ ...inputBase, fontSize: 12, letterSpacing: '0.12em', color: '#3a5a8a', textTransform: 'uppercase' }} />
              <Assist field="kicker" />
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
              <div style={{ flex: 1 }}>
                <label className="font-mono" style={labelStyle}>{t('editor.fPeriode')}</label>
                <input className="font-mono" value={f.periode} onChange={e => set('periode', e.target.value)} placeholder="2025–2027" style={{ ...inputBase, fontSize: 11 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="font-mono" style={labelStyle}>{t('editor.fStatus')}</label>
                <select className="font-mono" value={f.statut} onChange={e => set('statut', e.target.value as SubjectStatus)} style={{ ...inputBase, fontSize: 11 }}>
                  {STATUSES.map(s => <option key={s} value={s}>{tStatus(s)}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="font-mono" style={labelStyle}>{t('editor.fQuestion')}</label>
              <textarea className="font-serif" value={f.question} onChange={e => set('question', e.target.value)} rows={2} placeholder="Refusé. Mais pourquoi ?"
                style={{ ...inputBase, fontWeight: 700, fontSize: 26, lineHeight: 1.05, letterSpacing: '-0.02em', resize: 'vertical' }} />
              <Assist field="question" />
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="font-mono" style={labelStyle}>{t('editor.fTitre')} *</label>
              <input className="font-serif" value={f.titre} onChange={e => set('titre', e.target.value)} placeholder="Explainable AI for Credit Risk"
                style={{ ...inputBase, fontStyle: 'italic', fontSize: 16, color: '#6a7589' }} />
              <Assist field="titre" />
            </div>
          </div>

          {/* Navy bottom */}
          <div style={{ background: '#15203f', borderRadius: 8, padding: 18, marginTop: 12 }}>
            <div>
              <label className="font-mono" style={{ ...labelStyle, color: '#7fa3d4' }}>{t('editor.fAccroche')}</label>
              <textarea className="font-serif" value={f.accroche} onChange={e => set('accroche', e.target.value)} rows={2}
                style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(127,163,212,0.4)', outline: 'none', fontStyle: 'italic', fontSize: 18, lineHeight: 1.4, color: '#cdd8ea', resize: 'vertical' }} />
              <Assist field="accroche" />
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="font-mono" style={{ ...labelStyle, color: '#7fa3d4' }}>{t('editor.fKeywords')}</label>
              <input className="font-mono" value={f.keywords} onChange={e => set('keywords', e.target.value)} placeholder="IA explicable, Scoring, Régulation"
                style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(127,163,212,0.4)', outline: 'none', fontSize: 12, color: '#7fa3d4', letterSpacing: '0.04em' }} />
            </div>
            <div style={{ marginTop: 14 }}>
              <label className="font-mono" style={{ ...labelStyle, color: '#7fa3d4' }}>{t('editor.fResponsable')}</label>
              <select className="font-mono" value={f.responsable} onChange={e => set('responsable', e.target.value)}
                style={{ background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(127,163,212,0.4)', outline: 'none', fontSize: 12, color: '#e7ecf4' }}>
                <option value="" style={{ color: '#000' }}>{t('editor.none')}</option>
                {members.map(m => <option key={m.id} value={m.id} style={{ color: '#000' }}>{m.prenom} {m.nom}</option>)}
              </select>
            </div>
          </div>

          {/* ── Full details (collapsible) ── */}
          <button type="button" className="font-mono" onClick={() => setDetailsOpen(v => !v)}
            style={{ marginTop: 16, width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a6486' }}>
            {detailsOpen ? '▾' : '▸'} {t('editor.details')}
          </button>

          {detailsOpen && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="font-mono" style={labelStyle}>{t('editor.fDifficulty')}</label>
                <select className="font-mono" value={f.difficulte} onChange={e => set('difficulte', e.target.value as Difficulty)} style={detailInput}>
                  {DIFFS.map(d => <option key={d} value={d}>{tDiff(d)}</option>)}
                </select>
              </div>
              {(['context', 'method', 'results'] as const).map(key => (
                <div key={key}>
                  <label className="font-mono" style={labelStyle}>{t(`editor.f${key.charAt(0).toUpperCase()}${key.slice(1)}` as 'editor.fContext')}</label>
                  <textarea className="font-mono" value={f[key]} onChange={e => set(key, e.target.value)} rows={3} style={detailInput} />
                  <Assist field={key} />
                </div>
              ))}
              {([
                ['dimMethod', 'dimensions.method', 'dimMethod'],
                ['dimData', 'dimensions.data', 'dimData'],
                ['dimTheory', 'dimensions.theory', 'dimTheory'],
                ['dimWriting', 'dimensions.writing', 'dimWriting'],
              ] as const).map(([stateKey, field, labelKey]) => (
                <div key={stateKey}>
                  <label className="font-mono" style={labelStyle}>{t(`editor.${labelKey}` as 'editor.dimMethod')}</label>
                  <input className="font-mono" value={f[stateKey]} onChange={e => set(stateKey, e.target.value)} style={detailInput} />
                  <Assist field={field} />
                </div>
              ))}
              <label className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#2a3457', cursor: 'pointer' }}>
                <input type="checkbox" checked={f.isTransversal} onChange={e => set('isTransversal', e.target.checked)} />
                {t('editor.transversal')}
              </label>
              <label className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#2a3457', cursor: 'pointer' }}>
                <input type="checkbox" checked={f.confidentiel} onChange={e => set('confidentiel', e.target.checked)} />
                {t('editor.confidentiel')}
              </label>
            </div>
          )}

          {error && <div className="font-mono text-fame-red" style={{ fontSize: 11, marginTop: 14 }}>{error}</div>}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" onClick={onClose} className="font-mono" style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(20,40,90,0.2)', background: '#fff', fontSize: 11, cursor: 'pointer', color: '#5a6486' }}>
              {t('editor.cancel')}
            </button>
            <button type="button" onClick={save} disabled={saving} className="font-mono bg-fame-blue text-fame-text-light"
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 11, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? t('editor.saving') : t('editor.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: OK. (Si `tsc` se plaint des clés i18n dynamiques `t(\`editor.f${...}\`)`, c'est attendu — next-intl type les clés ; le cast `as 'editor.fContext'` / `as 'editor.dimMethod'` les neutralise. S'il reste une erreur, remplacer par des `t()` littéraux dans un petit `switch`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/lab/VitrineEditor.tsx
git commit -m "feat(lab): VitrineEditor — modale fiche éditable + génération par champ"
```

---

### Task 8: Intégration grille — vitrine, carte pointillée, éditeur

**Files:**
- Modify: `src/components/lab/SubjectGrid.tsx`
- Delete: `src/components/lab/AddSubjectModal.tsx`

**Interfaces:**
- Consumes: `SubjectVitrine` (Task 6), `VitrineEditor` (Task 7).
- Produces: grille rendue en vitrines ; bouton + carte pointillée ouvrent `VitrineEditor` (création) ; bouton ✎ par carte (mode édition) ouvre `VitrineEditor` (édition).

- [ ] **Step 1: Vérifier qu'aucun autre fichier n'importe `AddSubjectModal`**

Run: `grep -rn "AddSubjectModal" src`
Expected: uniquement `SubjectGrid.tsx` (et le fichier lui-même). Sinon, traiter les autres usages avant de supprimer.

- [ ] **Step 2: Mettre à jour les imports**

Dans `src/components/lab/SubjectGrid.tsx`, remplacer les lignes 7 et 9 :

```ts
import { SubjectVitrine } from './SubjectVitrine'
```
```ts
import { VitrineEditor } from './VitrineEditor'
```

(supprimer `import { SubjectCard } from './SubjectCard'` et `import { AddSubjectModal } from './AddSubjectModal'`.)

- [ ] **Step 3: Adapter l'état et les handlers**

Remplacer la ligne `const [addOpen, setAddOpen] = useState(false)` (ligne 62) par :

```ts
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
```

Remplacer `handleAdded` (lignes 126-130) par :

```ts
  function openCreate() { setEditing(null); setEditorOpen(true) }
  function openEdit(s: Subject) { setEditing(s); setEditorOpen(true) }

  function handleSaved(saved: Subject, isNew: boolean) {
    setSubjects(prev => isNew ? [...prev, saved] : prev.map(s => s.id === saved.id ? saved : s))
    setEditorOpen(false)
    addToast(isNew ? t('toast.added') : t('toast.updated'), 'success')
  }
```

- [ ] **Step 4: Inclure `question` dans la recherche**

Remplacer la ligne 22 (dans `passesFilters`) :

```ts
  if (q) {
    const ql = q.toLowerCase()
    if (!s.titre.toLowerCase().includes(ql) && !s.question.toLowerCase().includes(ql)) return false
  }
```

- [ ] **Step 5: Brancher le bouton « Add subject »**

Remplacer `onClick={() => setAddOpen(true)}` (ligne 335) par :

```ts
                onClick={openCreate}
```

- [ ] **Step 6: Rendre vitrines + carte pointillée dans la grille**

Remplacer tout le bloc conditionnel `{displaySubjects.length === 0 ? (...) : (...)}` (lignes 375-415) par :

```tsx
            {displaySubjects.length === 0 && !canEdit ? (
              <div className="font-mono text-fame-text-muted" style={{ fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
                {t('empty')}
              </div>
            ) : (
              <div
                className={editMode ? 'editing' : ''}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '26px 22px',
                  paddingBottom: 16,
                }}
              >
                {displaySubjects.map(s => (
                  <div
                    key={s.id}
                    data-subject-id={s.id}
                    style={{ position: 'relative' }}
                    onPointerDown={canDrag ? (e) => handlePointerDown(e, s.id) : undefined}
                  >
                    <SubjectVitrine
                      subject={s}
                      members={members}
                      editMode={editMode}
                      isDragging={draggingId === s.id}
                      statusLabel={t(`status.${s.statut}`)}
                      doneLabel={t('done')}
                      ficheLabel={t('vitrine.ficheLabel')}
                      questionLabel={t('vitrine.theQuestion')}
                      readLabel={t('vitrine.readSubject')}
                      transversalLabel={t('transversalBadge')}
                      deleteTitle={t('delete.confirm')}
                      editTitle={t('editor.editTitle')}
                      onDelete={canEdit && editMode ? () => setPendingDeleteId(s.id) : undefined}
                      onEdit={canEdit && editMode ? () => openEdit(s) : undefined}
                      onCardClick={!editMode ? () => openPaper(s.id) : undefined}
                    />
                  </div>
                ))}

                {canEdit && (
                  <button className="font-mono" onClick={openCreate}
                    style={{
                      aspectRatio: '1 / 1.414', width: '100%', borderRadius: 6,
                      border: '2px dashed rgba(47,68,134,0.35)', background: 'rgba(47,68,134,0.03)',
                      color: '#2f4486', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'fameFade 0.3s ease',
                    }}>
                    <span style={{ fontSize: 28, lineHeight: 1 }}>＋</span>
                    <span style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('vitrine.addCard')}</span>
                  </button>
                )}
              </div>
            )}
```

- [ ] **Step 7: Remplacer le rendu de la modale**

Remplacer le bloc `<AddSubjectModal ... />` (lignes 481-488) par :

```tsx
      {/* Subject editor (create + edit) */}
      {editorOpen && (
        <VitrineEditor
          key={editing?.id ?? 'new'}
          open
          lab={lab}
          members={members}
          subject={editing}
          locale={locale === 'fr' ? 'fr' : 'en'}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
        />
      )}
```

- [ ] **Step 8: Supprimer l'ancienne modale**

```bash
git rm src/components/lab/AddSubjectModal.tsx
```

- [ ] **Step 9: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: OK. (`SubjectCard.tsx` n'est plus importé : le laisser tel quel est sans danger, mais si le lint a une règle no-unused-modules il faudra aussi `git rm src/components/lab/SubjectCard.tsx` — vérifier avec `grep -rn "SubjectCard" src` ; le supprimer s'il n'est plus référencé.)

- [ ] **Step 10: Suite de tests complète**

Run: `npm test`
Expected: tous les tests PASS (notamment `messages-parity` et les nouveaux tests).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(lab): grille en vitrines + carte d'ajout pointillée + éditeur création/édition"
```

---

### Task 9: Vérification manuelle + STATUS

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Appliquer la migration 008** sur Supabase (cf. checkpoint Task 1) si pas déjà fait.

- [ ] **Step 2: `npm run dev`** puis vérifier (connecté en **membre**, sur `/en/paris` et `/fr/paris`) :
  - La grille affiche les sujets existants en **vitrines** ; un sujet sans `question` affiche son `titre` dans le gros titre (fallback), sans sous-titre.
  - La **carte pointillée** « + Ajouter un sujet » apparaît en fin de grille ; le **bouton** de la barre d'outils existe aussi. Les deux ouvrent la modale en création.
  - Saisie inline de chaque élément du poster ; **✨ Générer** sur `question`, `accroche`, `context` remplit le champ ; **« voir le prompt »** affiche le prompt + **Copier** fonctionne.
  - Section **« Détails complets »** : difficulté, context/method/results, 4 dimensions, transversal, confidentiel.
  - **Enregistrer** crée le sujet (toast « ajouté ») ; il apparaît dans la grille.
  - Mode **édition** (crayon barre d'outils) : ✎ sur une carte ouvre la modale pré-remplie ; modifier + Enregistrer met à jour (toast « mis à jour ») ; ✕ supprime ; drag-reorder fonctionne toujours.
  - Clic sur une carte (hors édition) → page **Paper** (inchangée).
  - **Filtres** (statut/difficulté/personnes/date) et **recherche** fonctionnent.
  - En **visiteur** (déconnecté) : ni bouton, ni carte pointillée, ni ✎/✕ ; le lien « proposer » reste.
  - Couper la génération : `ASSISTANT_DISABLED=1` dans `.env.local` → ✨ renvoie le toast d'erreur proprement (pas de crash).

- [ ] **Step 3: Mettre à jour `docs/STATUS.md`** (section avancement) avec une ligne décrivant la feature vitrine livrée (état, migration 008 à appliquer en prod, dépendance budget OpenAI).

- [ ] **Step 4: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): fiche vitrine éditable livrée"
```

---

## Self-Review

**Spec coverage :**
- Vitrine = format universel des cartes → Task 6 (`SubjectVitrine` remplace `SubjectCard`) + Task 8 (grille).
- Modale éditable inline en création → Task 7 + Task 8.
- ✨ Générer (Astra) + « voir le prompt » par champ → Tasks 3, 4, 7.
- Carte pointillée en fin de grille (en plus du bouton) → Task 8.
- Nouveaux champs `question`/`accroche`/`periode` → Task 1 (DB+type+RAG), Task 2 (API).
- Fallback `question` vide → `titre` → Task 6 (`vitrineHeadline`/`vitrineSubtitle` + test).
- Tout dans la modale (champs profonds) → Task 7 section « Détails complets ».
- Polices FAME (remap) → Task 6/7 (`font-serif`/`font-mono`, aucune police ajoutée — conforme Global Constraints).
- Page Paper inchangée → aucun changement dessus (confirmé hors périmètre).
- i18n en+fr → Task 5 (+ parité testée).

**Placeholder scan :** aucun TODO/TBD ; chaque step de code montre le code complet.

**Type consistency :** `AssistField`/`FieldDraft`/`buildFieldPrompt` définis en Task 3 et réutilisés tels quels en Tasks 4/7 ; `generateField(field, draft, locale, deps?)` cohérent route↔lib ; props `SubjectVitrine` (Task 6) consommées à l'identique en Task 8 ; `VitrineEditor` props (Task 7) consommées à l'identique en Task 8 ; `onSaved(subject, isNew)` cohérent.

**Note de risque (fidélité visuelle) :** le poster éditable (Task 7) et la mini-vitrine (Task 6) suivent la structure de la maquette avec la typo FAME ; le rendu pixel-perfect (tailles, espacements) se règle à l'œil lors de la vérif manuelle (Task 9, Step 2) — c'est attendu, pas un blocage.
