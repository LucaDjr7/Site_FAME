# Traduction bilingue du contenu des fiches — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stocker et afficher le contenu des fiches en EN et FR, la langue non saisie étant générée automatiquement par l'IA à l'enregistrement (fallback gracieux), avec affichage selon la locale.

**Architecture:** Une colonne `i18n jsonb` sur `subjects` (`{en:{…}, fr:{…}}`) ; les colonnes plates existantes restent la source/fallback. Un module serveur `translate.ts` traduit tous les champs en un appel LLM groupé à l'enregistrement (POST/PATCH). Un helper client `localized.ts` (`localizedSubject(s, locale)`) résout chaque champ par locale (fallback plat) et mappe le `kicker` via la liste de domaines ; il est consommé par la vitrine, la page Paper, la recherche et le RAG.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript, Supabase (service-role via API), next-intl, Vitest, OpenAI (via `src/lib/llm`).

## Global Constraints

- Next.js 16 : `params`/`searchParams` sont des `Promise` → `await params`.
- i18n : toute clé UI ajoutée dans **`messages/en.json` ET `messages/fr.json`** (test `src/messages-parity.test.ts`). Le **contenu** (pas les libellés) est traduit par l'IA, pas par next-intl.
- Writes via routes `/api/` avec service-role client. Jamais de mutation directe Supabase côté client.
- **Secrets/server-only** : `src/lib/subjects/translate.ts` importe `@/lib/llm` → server-only, **jamais importé par un composant client**. `src/lib/subjects/localized.ts` et `domains.ts` sont **client-safe** (types + constantes uniquement).
- Traduction : respecter `ASSISTANT_DISABLED` (=`'1'`) et `isOverBudget()` → si coupé/dépassé, **fallback** (source copiée dans les deux langues), l'enregistrement réussit toujours.
- Champs traduits : `titre, question, accroche, context, method, results, keywords, dimensions{4}`. Non traduits : `kicker` (mappé via `DOMAIN_OPTIONS`), `periode`, `statut`, `difficulte`.
- Migration : `009` (008 = vitrine déjà pris).
- Polices/tokens FAME inchangés. Commits atomiques.

---

### Task 1: Type `Subject.i18n` + migration 009 + fixtures

**Files:**
- Create: `supabase/migrations/009_subject_i18n.sql`
- Modify: `src/types/index.ts` (interface `Subject`, + nouveaux types)
- Modify: `src/lib/rag/chunk.test.ts` (fixture `makeSubject`)

**Interfaces:**
- Produces: `Locale2 = 'en' | 'fr'`, `SubjectI18nFields`, `SubjectI18n`, et `Subject.i18n: SubjectI18n`.

- [ ] **Step 1: Migration SQL**

Create `supabase/migrations/009_subject_i18n.sql` :

```sql
-- Contenu bilingue des fiches. Additif : les colonnes plates restent la source/fallback.
-- i18n = { "en": {champs}, "fr": {champs} } ; vide '{}' pour les fiches existantes (fallback).
ALTER TABLE subjects ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}'::jsonb;
```

- [ ] **Step 2: Types**

Dans `src/types/index.ts`, ajouter ces types juste avant l'interface `Subject` (après le commentaire de section `// ─── Subjects ───`) :

```ts
export type Locale2 = 'en' | 'fr'

export interface SubjectI18nFields {
  titre: string
  question: string
  accroche: string
  context: string
  method: string
  results: string
  keywords: string[]
  dimensions: { method: string; data: string; theory: string; writing: string }
}

export type SubjectI18n = Partial<Record<Locale2, Partial<SubjectI18nFields>>>
```

Puis, dans l'interface `Subject`, ajouter le champ `i18n` juste après `confidentiel: boolean` :

```ts
  confidentiel: boolean
  i18n: SubjectI18n
  created_at: string
  updated_at: string
```

- [ ] **Step 3: Corriger le fixture `makeSubject`**

Dans `src/lib/rag/chunk.test.ts`, le helper `makeSubject` construit un `Subject` littéral. Ajouter `i18n: {},` (par ex. juste après la ligne `confidentiel: false,`) pour qu'il reste type-correct :

```ts
    is_transversal: false, confidentiel: false,
    i18n: {},
    created_at: '2026-01-01', updated_at: '2026-01-01',
```

- [ ] **Step 4: Typecheck (corriger les autres littéraux `Subject` si besoin)**

Run: `npm run typecheck`
Expected: OK. Si `tsc` signale d'autres littéraux de type `Subject` sans `i18n` (hors fichiers `any`-castés), ajouter `i18n: {}` à chacun. Chercher : `grep -rn "confidentiel:" src` puis vérifier chaque littéral `Subject`.

- [ ] **Step 5: Lancer les tests existants**

Run: `npx vitest run src/lib/rag/chunk.test.ts`
Expected: PASS (le fixture compile ; comportement inchangé à ce stade).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/009_subject_i18n.sql src/types/index.ts src/lib/rag/chunk.test.ts
git commit -m "feat(subjects): type Subject.i18n + migration 009 (contenu bilingue)"
```

> **CHECKPOINT manuel :** appliquer `009_subject_i18n.sql` sur Supabase **avant** de tester les Tasks 3/5/6 de bout en bout.

---

### Task 2: Module de traduction (serveur)

**Files:**
- Create: `src/lib/subjects/translate.ts`
- Test: `src/lib/subjects/translate.test.ts`

**Interfaces:**
- Consumes: `SubjectI18nFields`, `Locale2`, `SubjectI18n` (Task 1) ; `getChatProvider`, `ChatProvider` (`@/lib/llm`) ; `recordUsage` (`@/lib/rag/usage`).
- Produces:
  - `translateSubjectFields(src: SubjectI18nFields, to: Locale2, deps?): Promise<SubjectI18nFields>`
  - `buildSubjectI18n(src: SubjectI18nFields, sourceLocale: Locale2, deps?: TranslateDeps & { disabled?: boolean; overBudget?: boolean }): Promise<SubjectI18n>`
  - `interface TranslateDeps { provider?: ChatProvider; record?: (i:number,o:number)=>Promise<void> }`

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/subjects/translate.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { translateSubjectFields, buildSubjectI18n } from './translate'
import type { ChatProvider } from '@/lib/llm'
import type { SubjectI18nFields } from '@/types'

const SRC: SubjectI18nFields = {
  titre: 'Titre', question: 'Question ?', accroche: 'Accroche',
  context: 'Contexte', method: 'Méthode', results: 'Résultats',
  keywords: ['a', 'b'],
  dimensions: { method: 'm', data: 'd', theory: 't', writing: 'w' },
}
function provider(content: string): ChatProvider {
  return { async *stream() {}, async complete() { return { content, toolCalls: [] } } }
}

describe('translateSubjectFields', () => {
  it('parses model JSON and returns translated fields', async () => {
    const json = JSON.stringify({ ...SRC, titre: 'Title', context: 'Context' })
    const out = await translateSubjectFields(SRC, 'en', { provider: provider(json), record: async () => {} })
    expect(out.titre).toBe('Title')
    expect(out.context).toBe('Context')
    expect(out.keywords).toEqual(['a', 'b'])
  })
  it('strips code fences and falls back per missing key', async () => {
    const out = await translateSubjectFields(SRC, 'en', { provider: provider('```json\n{"titre":"X"}\n```'), record: async () => {} })
    expect(out.titre).toBe('X')
    expect(out.method).toBe('Méthode')
  })
  it('falls back to source on invalid JSON', async () => {
    const out = await translateSubjectFields(SRC, 'en', { provider: provider('not json'), record: async () => {} })
    expect(out).toEqual(SRC)
  })
})

describe('buildSubjectI18n', () => {
  it('fills source verbatim and translates the other language', async () => {
    const json = JSON.stringify({ ...SRC, titre: 'Title' })
    const i18n = await buildSubjectI18n(SRC, 'fr', { provider: provider(json), record: async () => {} })
    expect(i18n.fr?.titre).toBe('Titre')
    expect(i18n.en?.titre).toBe('Title')
  })
  it('copies source to both languages when disabled', async () => {
    const i18n = await buildSubjectI18n(SRC, 'fr', { disabled: true })
    expect(i18n.fr?.titre).toBe('Titre')
    expect(i18n.en?.titre).toBe('Titre')
  })
})
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run src/lib/subjects/translate.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le module**

Create `src/lib/subjects/translate.ts` :

```ts
import type { SubjectI18nFields, Locale2, SubjectI18n } from '@/types'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const LANG_NAME: Record<Locale2, string> = { en: 'English', fr: 'French' }
const MAX_OUT = 900

export interface TranslateDeps {
  provider?: ChatProvider
  record?: (tokensIn: number, tokensOut: number) => Promise<void>
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

function mergeFields(src: SubjectI18nFields, p: Partial<SubjectI18nFields>): SubjectI18nFields {
  const d = p.dimensions
  return {
    titre: typeof p.titre === 'string' ? p.titre : src.titre,
    question: typeof p.question === 'string' ? p.question : src.question,
    accroche: typeof p.accroche === 'string' ? p.accroche : src.accroche,
    context: typeof p.context === 'string' ? p.context : src.context,
    method: typeof p.method === 'string' ? p.method : src.method,
    results: typeof p.results === 'string' ? p.results : src.results,
    keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : src.keywords,
    dimensions: d && typeof d === 'object' ? {
      method: typeof d.method === 'string' ? d.method : src.dimensions.method,
      data: typeof d.data === 'string' ? d.data : src.dimensions.data,
      theory: typeof d.theory === 'string' ? d.theory : src.dimensions.theory,
      writing: typeof d.writing === 'string' ? d.writing : src.dimensions.writing,
    } : src.dimensions,
  }
}

export async function translateSubjectFields(
  src: SubjectI18nFields,
  to: Locale2,
  deps: TranslateDeps = {},
): Promise<SubjectI18nFields> {
  const provider = deps.provider ?? getChatProvider()
  const system = `You are a professional translator for an academic research lab website. Translate every value of the given JSON object into ${LANG_NAME[to]}. Preserve meaning and technical terminology. If a value is already in ${LANG_NAME[to]}, return it unchanged. Keep "keywords" an array of strings and "dimensions" an object with the same keys. Reply with ONLY a JSON object with exactly the same keys — no markdown, no commentary.`
  const user = JSON.stringify(src)
  try {
    const completion = await provider.complete(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { maxTokens: MAX_OUT },
    )
    const out = (completion.content ?? '').trim()
    const tokensIn = Math.ceil((system.length + user.length) / 4)
    const tokensOut = Math.ceil(out.length / 4)
    await (deps.record ?? recordUsage)(tokensIn, tokensOut)
    const parsed = JSON.parse(stripFences(out)) as Partial<SubjectI18nFields>
    return mergeFields(src, parsed)
  } catch {
    return src
  }
}

export async function buildSubjectI18n(
  src: SubjectI18nFields,
  sourceLocale: Locale2,
  deps: TranslateDeps & { disabled?: boolean; overBudget?: boolean } = {},
): Promise<SubjectI18n> {
  const other: Locale2 = sourceLocale === 'en' ? 'fr' : 'en'
  if (deps.disabled || deps.overBudget) {
    return { [sourceLocale]: src, [other]: src } as SubjectI18n
  }
  const translated = await translateSubjectFields(src, other, deps)
  return { [sourceLocale]: src, [other]: translated } as SubjectI18n
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run src/lib/subjects/translate.test.ts && npm run typecheck`
Expected: PASS + tsc OK.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subjects/translate.ts src/lib/subjects/translate.test.ts
git commit -m "feat(subjects): module de traduction LLM groupée (fallback gracieux)"
```

---

### Task 3: API — remplir `i18n` à la création/màj

**Files:**
- Modify: `src/app/api/subjects/route.ts` (POST)
- Modify: `src/app/api/subjects/[id]/route.ts` (PATCH)

**Interfaces:**
- Consumes: `buildSubjectI18n`, `SubjectI18nFields` (Task 2) ; `isOverBudget` (`@/lib/rag/usage`).
- Produces: les fiches créées/modifiées portent `i18n` rempli (source + autre langue traduite ou fallback).

- [ ] **Step 1: POST — construire `i18n` et l'insérer**

Dans `src/app/api/subjects/route.ts` :

Ajouter les imports en tête (après la ligne `import { VALID_LABS } from '@/lib/constants'`) :

```ts
import { buildSubjectI18n, type SubjectI18nFields } from '@/lib/subjects/translate'
import { isOverBudget } from '@/lib/rag/usage'
```

Puis, dans `POST`, remplacer le bloc depuis `const ordre = (last?.ordre ?? -1) + 1` jusqu'à la fin de l'`insert` (lignes ~48-57) par :

```ts
  const ordre = (last?.ordre ?? -1) + 1

  const dims = dimensions ?? { method: '', data: '', theory: '', writing: '' }
  const sourceLocale = body.locale === 'fr' ? 'fr' : 'en'
  const srcFields: SubjectI18nFields = { titre, question, accroche, context, method, results, keywords, dimensions: dims }
  const i18n = await buildSubjectI18n(srcFields, sourceLocale, {
    disabled: process.env.ASSISTANT_DISABLED === '1',
    overBudget: await isOverBudget(),
  })

  const { data, error } = await service
    .from('subjects')
    .insert({ labo, titre, kicker, question, accroche, periode, statut, difficulte,
      context, method, results, keywords, auteurs,
      dimensions: dims, ordre, i18n,
      is_transversal: !!is_transversal, confidentiel: !!confidentiel })
    .select()
    .single()
```

- [ ] **Step 2: PATCH — recalculer `i18n` quand le contenu change**

Dans `src/app/api/subjects/[id]/route.ts` :

Ajouter en tête (après `import { scheduleReindex } from '@/lib/rag/schedule'`) :

```ts
import { buildSubjectI18n, type SubjectI18nFields } from '@/lib/subjects/translate'
import { isOverBudget } from '@/lib/rag/usage'
```

Puis, dans `PATCH`, juste **après** la ligne `if ('confidentiel' in updates) updates.confidentiel = !!updates.confidentiel`, insérer :

```ts
  // L'éditeur envoie le payload complet (avec `titre`) ; on (re)génère i18n depuis
  // la langue source = locale de l'éditeur. Les màj partielles sans `titre` ne touchent pas i18n.
  if ('titre' in body) {
    const sourceLocale = body.locale === 'fr' ? 'fr' : 'en'
    const srcFields: SubjectI18nFields = {
      titre: body.titre ?? '', question: body.question ?? '', accroche: body.accroche ?? '',
      context: body.context ?? '', method: body.method ?? '', results: body.results ?? '',
      keywords: Array.isArray(body.keywords) ? body.keywords : [],
      dimensions: body.dimensions ?? { method: '', data: '', theory: '', writing: '' },
    }
    updates.i18n = await buildSubjectI18n(srcFields, sourceLocale, {
      disabled: process.env.ASSISTANT_DISABLED === '1',
      overBudget: await isOverBudget(),
    })
  }
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/subjects/route.ts src/app/api/subjects/[id]/route.ts
git commit -m "feat(api): traduction du contenu des fiches à la création/màj (i18n)"
```

---

### Task 4: Helper d'affichage localisé (client-safe)

**Files:**
- Create: `src/lib/subjects/localized.ts`
- Test: `src/lib/subjects/localized.test.ts`

**Interfaces:**
- Consumes: `Subject`, `Locale2` (Task 1) ; `DOMAIN_OPTIONS` (`./domains`).
- Produces:
  - `toLocale2(locale: string): Locale2`
  - `interface LocalizedSubject { titre; question; accroche; context; method; results: string; keywords: string[]; dimensions: Subject['dimensions']; kicker: string }`
  - `localizedSubject(s: Subject, locale: Locale2): LocalizedSubject`
  - `subjectSearchText(s: Subject): string`
- **Client-safe** : n'importe que des types + `domains`.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/subjects/localized.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { localizedSubject, subjectSearchText, toLocale2 } from './localized'
import type { Subject } from '@/types'

function mk(over: Partial<Subject> = {}): Subject {
  return {
    id: '1', labo: 'paris', titre: 'Titre FR', kicker: 'Recherche · IA',
    question: 'Q FR', accroche: 'A FR', periode: '', statut: 'active',
    context: 'C FR', method: 'M FR', results: 'R FR', keywords: ['kfr'],
    auteurs: [], difficulte: 'intermediate',
    dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre: 0, is_transversal: false, confidentiel: false, i18n: {},
    created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
  }
}

describe('localizedSubject', () => {
  it('returns the requested language when present', () => {
    const L = localizedSubject(mk({ i18n: { en: { titre: 'Title EN', question: 'Q EN' } } }), 'en')
    expect(L.titre).toBe('Title EN')
    expect(L.question).toBe('Q EN')
  })
  it('falls back to flat columns when the language is missing', () => {
    expect(localizedSubject(mk(), 'en').titre).toBe('Titre FR')
  })
  it('maps the kicker across locales via the domain list', () => {
    expect(localizedSubject(mk({ kicker: 'Recherche · IA' }), 'en').kicker).toBe('Research · AI')
  })
  it('keeps a custom kicker unchanged', () => {
    expect(localizedSubject(mk({ kicker: 'Custom' }), 'en').kicker).toBe('Custom')
  })
})

describe('subjectSearchText', () => {
  it('includes both languages, lowercased', () => {
    const text = subjectSearchText(mk({ i18n: { en: { titre: 'Title EN' } } }))
    expect(text).toContain('titre fr')
    expect(text).toContain('title en')
  })
})

describe('toLocale2', () => {
  it('maps fr, defaults everything else to en', () => {
    expect(toLocale2('fr')).toBe('fr')
    expect(toLocale2('de')).toBe('en')
  })
})
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run src/lib/subjects/localized.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le helper**

Create `src/lib/subjects/localized.ts` :

```ts
import type { Subject, Locale2 } from '@/types'
import { DOMAIN_OPTIONS } from './domains'

export function toLocale2(locale: string): Locale2 {
  return locale === 'fr' ? 'fr' : 'en'
}

export interface LocalizedSubject {
  titre: string
  question: string
  accroche: string
  context: string
  method: string
  results: string
  keywords: string[]
  dimensions: Subject['dimensions']
  kicker: string
}

function localizedKicker(kicker: string, locale: Locale2): string {
  if (!kicker) return kicker
  for (const src of ['en', 'fr'] as Locale2[]) {
    const idx = DOMAIN_OPTIONS[src].indexOf(kicker)
    if (idx !== -1) return DOMAIN_OPTIONS[locale][idx]
  }
  return kicker
}

export function localizedSubject(s: Subject, locale: Locale2): LocalizedSubject {
  const t = s.i18n?.[locale]
  return {
    titre: t?.titre ?? s.titre,
    question: t?.question ?? s.question,
    accroche: t?.accroche ?? s.accroche,
    context: t?.context ?? s.context,
    method: t?.method ?? s.method,
    results: t?.results ?? s.results,
    keywords: t?.keywords ?? s.keywords,
    dimensions: t?.dimensions ?? s.dimensions,
    kicker: localizedKicker(s.kicker, locale),
  }
}

export function subjectSearchText(s: Subject): string {
  const parts: string[] = [s.titre, s.question]
  for (const loc of ['en', 'fr'] as Locale2[]) {
    const t = s.i18n?.[loc]
    if (t?.titre) parts.push(t.titre)
    if (t?.question) parts.push(t.question)
  }
  return parts.join(' ').toLowerCase()
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run src/lib/subjects/localized.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subjects/localized.ts src/lib/subjects/localized.test.ts
git commit -m "feat(subjects): helper localizedSubject + recherche bi-langue"
```

---

### Task 5: Affichage localisé — `SubjectVitrine` + grille

**Files:**
- Modify: `src/components/lab/SubjectVitrine.tsx`
- Modify: `src/components/lab/SubjectGrid.tsx`

**Interfaces:**
- Consumes: `localizedSubject`, `subjectSearchText`, `toLocale2` (Task 4) ; `Locale2` (Task 1).
- Produces: la grille affiche les fiches dans la locale courante ; la recherche matche les deux langues.

- [ ] **Step 1: `SubjectVitrine` — calculer la version localisée**

Dans `src/components/lab/SubjectVitrine.tsx` :

Ajouter l'import (après la ligne `import { vitrineHeadline, vitrineSubtitle, vitrineNumber } from '@/lib/subjects/vitrine'`) :

```ts
import { localizedSubject } from '@/lib/subjects/localized'
import type { Locale2 } from '@/types'
```

Ajouter `locale` au type `Props` (après `subject: Subject`) :

```ts
  subject: Subject
  locale: Locale2
```

Ajouter `locale` à la déstructuration des props (dans `export function SubjectVitrine({ ... })`), par ex. juste après `subject,` :

```ts
  subject, locale, members, editMode, isDragging = false,
```

Remplacer le bloc de dérivation (les lignes `const headline = ...` / `const subtitle = ...`) par :

```ts
  const L = localizedSubject(subject, locale)
  const author = subject.auteurs[0] ? members.find(m => m.id === subject.auteurs[0]) : null
  const authorName = author ? `${author.prenom} ${author.nom}` : null
  const headline = vitrineHeadline({ question: L.question, titre: L.titre })
  const subtitle = vitrineSubtitle({ question: L.question, titre: L.titre })
  const number = vitrineNumber(subject.ordre)
```

(supprimer l'ancienne ligne `const author = ...` plus haut si elle devient dupliquée — il ne doit rester qu'une déclaration de `author`/`authorName`.)

Puis remplacer les usages de contenu par la version localisée :
- `{subject.kicker || statusLabel}` → `{L.kicker || statusLabel}`
- le bloc accroche `{subject.accroche && <span …>{subject.accroche}</span>}` → utiliser `L.accroche` aux deux endroits
- le bloc keywords : `{subject.keywords.length > 0 && (` → `{L.keywords.length > 0 && (` et `{subject.keywords.slice(0, 3)...}` → `{L.keywords.slice(0, 3)...}`

(`subject.periode`, `subject.statut`, `subject.is_transversal`, l'auteur restent inchangés.)

- [ ] **Step 2: `SubjectGrid` — passer la locale + recherche bi-langue**

Dans `src/components/lab/SubjectGrid.tsx` :

Ajouter l'import (après `import { dateBucket } from '@/lib/utils'`) :

```ts
import { subjectSearchText, toLocale2 } from '@/lib/subjects/localized'
```

Dans `passesFilters`, remplacer le bloc de recherche `q` :

```ts
  if (q) {
    const ql = q.toLowerCase()
    if (!s.titre.toLowerCase().includes(ql) && !s.question.toLowerCase().includes(ql)) return false
  }
```

par :

```ts
  if (q && !subjectSearchText(s).includes(q.toLowerCase())) return false
```

Dans le rendu de la carte (`<SubjectVitrine ... />`), ajouter la prop `locale` (par ex. juste après `subject={s}`) :

```tsx
                    <SubjectVitrine
                      subject={s}
                      locale={toLocale2(locale)}
                      members={members}
```

(`locale` est déjà disponible : `const locale = (params?.locale as string) ?? 'en'`.)

- [ ] **Step 3: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/lab/SubjectVitrine.tsx src/components/lab/SubjectGrid.tsx
git commit -m "feat(lab): grille — vitrine localisée + recherche bi-langue"
```

---

### Task 6: Affichage localisé — page Paper

**Files:**
- Modify: `src/components/paper/PaperSheet.tsx`

**Interfaces:**
- Consumes: `localizedSubject`, `toLocale2` (Task 4).
- Produces: la fiche détaillée affiche kicker/titre/context/method/results/keywords dans la locale.

- [ ] **Step 1: Localiser `PaperSheet`**

Dans `src/components/paper/PaperSheet.tsx` :

Ajouter l'import (après `import type { Subject, MemberRef, SubjectStatus } from '@/types'`) :

```ts
import { localizedSubject, toLocale2 } from '@/lib/subjects/localized'
```

Au début de `PaperSheet`, juste après `const statusColor = ...`, ajouter :

```ts
  const L = localizedSubject(subject, toLocale2(locale))
```

Puis remplacer les usages de contenu :
- `{subject.kicker ? \`${subject.kicker} · ${labName}\` : labName}` → `{L.kicker ? \`${L.kicker} · ${labName}\` : labName}`
- `<h1 ...>{subject.titre}</h1>` → `{L.titre}`
- `<Section heading={t('context')} body={subject.context} />` → `body={L.context}`
- `<Section heading={t('method')} body={subject.method} />` → `body={L.method}`
- `<Section heading={t('results')} body={subject.results} />` → `body={L.results}`
- le bloc keywords : `{subject.keywords.length > 0 && (` → `{L.keywords.length > 0 && (` et `{subject.keywords.map(...)}` → `{L.keywords.map(...)}`

(`subject.statut`, `subject.auteurs`, la date restent inchangés.)

- [ ] **Step 2: Typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/paper/PaperSheet.tsx
git commit -m "feat(paper): fiche détaillée affichée dans la locale"
```

---

### Task 7: RAG — indexer les deux langues

**Files:**
- Modify: `src/lib/rag/chunk.ts` (`chunkSubject`)
- Modify: `src/lib/rag/chunk.test.ts` (nouveau cas)

**Interfaces:**
- Consumes: `Subject.i18n` (Task 1).
- Produces: `chunkSubject` émet des chunks pour `i18n.en` **et** `i18n.fr` quand présents (fallback colonnes plates).

- [ ] **Step 1: Écrire le test (échoue)**

Dans `src/lib/rag/chunk.test.ts`, ajouter ce cas dans le `describe('chunkSubject', ...)` :

```ts
  it('indexes both languages when i18n is present', () => {
    const joined = chunkSubject(makeSubject({
      question: 'Q fr', context: 'Ctx fr',
      i18n: {
        fr: { question: 'Q fr', accroche: '', context: 'Ctx fr', method: '', results: '', titre: '', keywords: [], dimensions: { method: '', data: '', theory: '', writing: '' } },
        en: { question: 'Q en', accroche: '', context: 'Ctx en', method: '', results: '', titre: '', keywords: [], dimensions: { method: '', data: '', theory: '', writing: '' } },
      },
    })).map(c => c.content).join('\n')
    expect(joined).toContain('Question: Q fr')
    expect(joined).toContain('Question: Q en')
    expect(joined).toContain('Context: Ctx en')
  })
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run src/lib/rag/chunk.test.ts`
Expected: FAIL — `Q en` absent (chunkSubject n'indexe que les colonnes plates).

- [ ] **Step 3: Mettre à jour `chunkSubject`**

Dans `src/lib/rag/chunk.ts`, remplacer la fonction `chunkSubject` par :

```ts
export function chunkSubject(s: Subject): RawChunk[] {
  const base = s.kicker ? `${s.titre} — ${s.kicker}` : s.titre
  const head = s.periode ? `${base} (${s.periode})` : base

  type Set = { question: string; accroche: string; context: string; method: string; results: string }
  const sets: Set[] = []
  const en = s.i18n?.en
  const fr = s.i18n?.fr
  if (en) sets.push({ question: en.question ?? '', accroche: en.accroche ?? '', context: en.context ?? '', method: en.method ?? '', results: en.results ?? '' })
  if (fr) sets.push({ question: fr.question ?? '', accroche: fr.accroche ?? '', context: fr.context ?? '', method: fr.method ?? '', results: fr.results ?? '' })
  if (sets.length === 0) sets.push({ question: s.question, accroche: s.accroche, context: s.context, method: s.method, results: s.results })

  const chunks: RawChunk[] = []
  for (const set of sets) {
    const fields: [string, string][] = [
      ['Question', set.question], ['Accroche', set.accroche],
      ['Context', set.context], ['Method', set.method], ['Results', set.results],
    ]
    for (const [label, v] of fields) {
      if (v && v.trim().length > 0) chunks.push({ content: `${head}\n${label}: ${v.trim()}` })
    }
  }
  return chunks
}
```

- [ ] **Step 4: Lancer les tests (passent)**

Run: `npx vitest run src/lib/rag/chunk.test.ts`
Expected: PASS (l'ancien cas « includes question and accroche » passe toujours via le fallback plat ; le nouveau cas passe).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/chunk.ts src/lib/rag/chunk.test.ts
git commit -m "feat(rag): chunkSubject indexe les deux langues"
```

---

### Task 8: Éditeur — locale dans le payload, init localisé, mention

**Files:**
- Modify: `src/components/lab/VitrineEditor.tsx`
- Modify: `messages/en.json`, `messages/fr.json`

**Interfaces:**
- Consumes: `localizedSubject` (Task 4) ; clé i18n `editor.autoTranslateNote`.
- Produces: l'éditeur envoie `locale` au save (langue source) ; pré-remplit depuis la version localisée ; affiche une mention.

- [ ] **Step 1: i18n — `editor.autoTranslateNote` (en + fr)**

Dans `messages/en.json`, à l'intérieur de `lab.editor`, ajouter (par ex. juste après `"none": "None",` … en respectant la virgule, ou en fin d'objet en ajoutant une virgule au champ précédent) :

```json
      "autoTranslateNote": "Content is auto-translated into the other language on save."
```

Dans `messages/fr.json`, dans `lab.editor` :

```json
      "autoTranslateNote": "Le contenu est traduit automatiquement dans l'autre langue à l'enregistrement."
```

(S'assurer que le JSON reste valide — virgule après la clé précédente.)

- [ ] **Step 2: Éditeur — import + init localisé**

Dans `src/components/lab/VitrineEditor.tsx` :

Ajouter l'import (après `import { DOMAIN_OPTIONS } from '@/lib/subjects/domains'`) :

```ts
import { localizedSubject } from '@/lib/subjects/localized'
```

Remplacer l'initialisation d'état `const [f, setF] = useState(() => ({ ... }))` pour dériver les champs traduits de la version localisée. Remplacer le corps de l'initialiseur par :

```ts
  const [f, setF] = useState(() => {
    const L = subject ? localizedSubject(subject, locale) : null
    return {
      question: L?.question ?? '',
      titre: L?.titre ?? '',
      kicker: L?.kicker ?? '',
      accroche: L?.accroche ?? '',
      periode: subject?.periode ?? '',
      statut: (subject?.statut ?? 'active') as SubjectStatus,
      difficulte: (subject?.difficulte ?? 'intermediate') as Difficulty,
      responsable: subject?.auteurs[0] ?? '',
      keywords: (L?.keywords ?? []).join(', '),
      context: L?.context ?? '',
      method: L?.method ?? '',
      results: L?.results ?? '',
      dimMethod: L?.dimensions.method ?? '',
      dimData: L?.dimensions.data ?? '',
      dimTheory: L?.dimensions.theory ?? '',
      dimWriting: L?.dimensions.writing ?? '',
      isTransversal: subject?.is_transversal ?? false,
      confidentiel: subject?.confidentiel ?? false,
    }
  })
```

- [ ] **Step 3: Éditeur — `locale` dans le payload de save**

Dans la fonction `save()`, dans l'objet `payload`, ajouter `locale` (par ex. juste après `labo: lab,`) :

```ts
    const payload = {
      labo: lab,
      locale,
      question: f.question.trim(), titre: f.titre.trim(), kicker: f.kicker.trim(),
```

- [ ] **Step 4: Éditeur — mention sous l'en-tête**

Juste après le `</div>` de fermeture du bloc header (le `<div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-fame-ecru">…</div>`) et avant `<div className="p-6">`, insérer :

```tsx
        <p className="font-mono" style={{ margin: 0, padding: '8px 24px 0', fontSize: 10, color: '#6b7596' }}>
          {t('editor.autoTranslateNote')}
        </p>
```

- [ ] **Step 5: Vérifs**

Run: `npx vitest run src/messages-parity.test.ts && npm run typecheck && npm run lint && npm run build`
Expected: parité PASS, tsc/lint/build OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/lab/VitrineEditor.tsx messages/en.json messages/fr.json
git commit -m "feat(lab): éditeur — locale source + init localisé + mention auto-traduction"
```

---

### Task 9: Vérification finale

- [ ] **Step 1: Suite complète**

Run: `npm test`
Expected: tous les tests PASS.

- [ ] **Step 2: Appliquer la migration 009** sur Supabase (cf. checkpoint Task 1) si pas déjà fait.

- [ ] **Step 3: Vérif manuelle** (`npm run dev`, connecté membre) :
  - Créer une fiche **sur le site FR** → la voir **traduite** sur le site EN (`/en/...`), et inversement.
  - Fiche **legacy** (créée avant, `i18n` vide) → s'affiche dans sa langue d'origine sur les deux locales (fallback).
  - Éditer une fiche sur le site EN → les champs pré-remplis sont en EN (version localisée) ; après save, le FR est régénéré.
  - `kicker` : une fiche avec domaine « Recherche · IA » s'affiche « Research · AI » sur le site EN.
  - **Recherche** : taper un mot présent uniquement dans l'autre langue trouve bien la fiche.
  - `ASSISTANT_DISABLED=1` → la sauvegarde réussit, contenu non traduit (fallback), pas de crash.
  - **Astra** : poser une question en EN sur un sujet saisi en FR → réponse pertinente (RAG indexe les deux langues).

- [ ] **Step 4: Mettre à jour `docs/STATUS.md`** avec une ligne sur la traduction bilingue des fiches (migration 009 à appliquer, dépendance budget OpenAI à la sauvegarde).

- [ ] **Step 5: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): contenu des fiches bilingue (auto-traduction)"
```

---

## Self-Review

**Spec coverage :**
- `i18n jsonb` + type → Task 1. Traduction groupée + fallback → Task 2. Remplissage API POST/PATCH → Task 3. Helper `localizedSubject`/`subjectSearchText`/mapping kicker → Task 4. Affichage vitrine + recherche bi-langue → Task 5. Affichage page Paper → Task 6. RAG deux langues → Task 7. Éditeur (locale source, init localisé, mention) → Task 8. Fiches existantes = fallback (aucun backfill — couvert par `localizedSubject` qui retombe sur les colonnes plates). Vérif manuelle + STATUS → Task 9.

**Placeholder scan :** aucun TODO/TBD ; chaque step de code montre le code.

**Type consistency :** `SubjectI18nFields`/`SubjectI18n`/`Locale2` définis en Task 1, consommés identiquement par Tasks 2/3/4 ; `translateSubjectFields`/`buildSubjectI18n` signatures cohérentes route↔lib ; `localizedSubject(s, locale)` et `subjectSearchText(s)` consommés tels quels en Tasks 5/6/8 ; prop `locale: Locale2` ajoutée à `SubjectVitrine` (Task 5) et fournie via `toLocale2(locale)` par la grille.

**Note de risque :** la traduction ajoute un appel LLM synchrone (~1-2 s) à chaque création/màj de fiche ; acceptable (contenu court) et borné par budget + kill-switch avec fallback. La langue source = locale de l'éditeur : si un membre saisit dans une langue ≠ sa locale, la « traduction » peut être imparfaite (le prompt demande de renvoyer inchangé si déjà dans la langue cible — atténuation).
