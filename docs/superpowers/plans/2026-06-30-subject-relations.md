# Relations entre fiches & page graphe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relier les fiches entre elles (mère→fille avec héritage sélectif par champ, multi-mères/DAG ; associations non orientées avec libellé) et offrir une page graphe globale d3-force + un panneau de relations dans chaque fiche + un bouton « créer une fiche fille ».

**Architecture:** Une table `subject_relations` (`kind ∈ parent|assoc`) + une colonne `inherits jsonb` sur `subjects` (champ → id de la mère). L'héritage est **résolu à la lecture** par un helper pur réutilisé par la fiche et la carte. Les écritures passent par des routes `/api/` service-role (validation cycle/doublon/liste blanche). La page graphe est un RSC global `/[locale]/graph` + un composant client `d3-force`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (`@supabase/ssr` + service-role), next-intl, d3 (déjà en dépendance), vitest.

## Global Constraints

- **Next.js 16** : `params`/`searchParams` sont des `Promise` → toujours `await params`.
- **Lab slug** : `paris`|`montreal`, minuscules ; valider dans chaque route.
- **i18n** : zéro chaîne UI hardcodée → `useTranslations()`/`getTranslations()`, clés ajoutées dans `messages/en.json` **ET** `messages/fr.json`.
- **DB writes** : exclusivement via routes `/api/` avec `createServiceClient()` (jamais les cookies de la requête sur le service client) ; reads via RSC service client.
- **Auth** : `requireMember()` (membre) ; `authErrorResponse(e)` pour formater. Pas d'auto-inscription.
- **Confidentiel** : un visiteur (non-membre) ne voit jamais une fiche `confidentiel` (404/absence), ni n'hérite d'une mère confidentielle.
- **Tokens couleur** : `fame-*` (voir CLAUDE.md). **Polices** : `font-serif` (Roboto Slab), `font-mono` (IBM Plex Mono).
- **Tests** : vitest. Tests lib = env `node` (défaut). Tests composant = ajouter `// @vitest-environment jsdom` en tête de fichier.
- **Commits atomiques** : `feat:`/`fix:`/`chore:` ; mettre à jour `docs/STATUS.md` en fin de feature.
- **Champs héritables** (liste blanche, exacte) : `context`, `method`, `results`, `dimensions`, `keywords`, `auteurs`, `kicker`, `periode`. Jamais : `titre`, `question`, `accroche`, ni le structurel.

---

## File Structure

**Créés :**
- `supabase/migrations/013_subject_relations.sql` — table `subject_relations` + colonne `subjects.inherits`.
- `src/lib/subjects/inheritance.ts` — `resolveInheritance()` + helpers de validation (`isInheritableField`, `normalizeAssocPair`, `wouldCreateCycle`).
- `src/lib/subjects/inheritance.test.ts` — tests du helper.
- `src/lib/subjects/relation-label.ts` — `buildLabelI18n()` (traduction du libellé d'arête).
- `src/lib/subjects/relation-label.test.ts`.
- `src/lib/subjects/graph-data.ts` — `buildGraphData()` (fiches+relations → nœuds/arêtes, pur, testable).
- `src/lib/subjects/graph-data.test.ts`.
- `src/app/api/subjects/[id]/relations/route.ts` — `POST` (créer lien), `GET` (lister liens d'une fiche).
- `src/app/api/subjects/[id]/relations/[relId]/route.ts` — `DELETE`.
- `src/app/api/subjects/[id]/relations/wire.test.ts` — tests de la logique d'extraction/validation (sans réseau).
- `src/app/[locale]/graph/page.tsx` — RSC global.
- `src/components/graph/RelationGraph.tsx` — composant client d3-force.
- `src/components/graph/graph-shared.ts` — constantes couleur/forme partagées.
- `src/components/paper/RelationsPanel.tsx` — panneau dans la fiche.

**Modifiés :**
- `src/types/index.ts` — `RelationKind`, `INHERITABLE_FIELDS`, `InheritableField`, `SubjectRelation`, `Subject.inherits`, `RelationGraphNode`/`RelationGraphEdge`.
- `src/app/api/subjects/route.ts` — `POST` accepte `parentId?` + `inherits?`.
- `src/app/api/subjects/[id]/route.ts` — `PATCH` accepte/valide `inherits`.
- `src/app/[locale]/[lab]/paper/[id]/page.tsx` — charge relations + sujets liés ; passe à `PaperView`.
- `src/components/paper/PaperView.tsx` — monte `RelationsPanel` sous `TasksPanel` ; bouton « créer une fille ».
- `src/components/paper/PaperSheet.tsx` — résout l'héritage + badges « hérité de {mère} ».
- `src/components/lab/SubjectVitrine.tsx` — carte résout l'héritage.
- `src/components/lab/VitrineEditor.tsx` — mode « créer une fille » (mère pré-définie + héritage coché).
- `src/components/layout/NavMenu.tsx` — entrée « Graphe ».
- `messages/en.json` / `messages/fr.json` — namespaces `graph` + clés `paper.relations.*` + `nav.graph`.
- `docs/STATUS.md` — entrée de fin de feature.

**Décision de planification (raffinement spec)** : `src/lib/rag/chunk.ts` (`chunkSubject`) **n'est PAS modifié** — chaque fiche indexe ses champs **propres** ; le contenu hérité reste indexé sur la mère (évite la duplication de chunks). Documenté ici, à confirmer au handoff.

---

# PHASE 1 — Données & héritage (cœur testable, sans UI)

### Task 1 : Migration `013` + types

**Files:**
- Create: `supabase/migrations/013_subject_relations.sql`
- Modify: `src/types/index.ts` (après le bloc `Subjects`)

**Interfaces:**
- Produces: `RelationKind`, `INHERITABLE_FIELDS`, `InheritableField`, `SubjectRelation`, et `Subject.inherits: Partial<Record<InheritableField, string>>`.

- [ ] **Step 1 : Écrire la migration**

`supabase/migrations/013_subject_relations.sql` :
```sql
-- 013_subject_relations.sql — relations entre fiches (mère→fille + associations) et héritage par champ.
create table if not exists subject_relations (
  id         uuid primary key default gen_random_uuid(),
  source_id  uuid not null references subjects(id) on delete cascade,
  target_id  uuid not null references subjects(id) on delete cascade,
  kind       text not null check (kind in ('parent','assoc')),
  label      text not null default '',
  label_i18n jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (source_id <> target_id)
);
-- 'parent' : source_id = MÈRE, target_id = FILLE. 'assoc' : non orienté, invariant applicatif source_id < target_id.
create unique index if not exists ux_subject_relations_pair on subject_relations (source_id, target_id, kind);
create index if not exists ix_subject_relations_source on subject_relations (source_id);
create index if not exists ix_subject_relations_target on subject_relations (target_id);
alter table subjects add column if not exists inherits jsonb not null default '{}'::jsonb;
```

- [ ] **Step 2 : Ajouter les types**

Dans `src/types/index.ts`, juste après l'interface `Subject` (avant `SubjectWithProgress`) :
```ts
export const INHERITABLE_FIELDS = ['context','method','results','dimensions','keywords','auteurs','kicker','periode'] as const
export type InheritableField = typeof INHERITABLE_FIELDS[number]
export type RelationKind = 'parent' | 'assoc'

export interface SubjectRelation {
  id: string
  source_id: string
  target_id: string
  kind: RelationKind
  label: string
  label_i18n: Partial<Record<Locale2, { label: string }>>
  created_at: string
}
```

Et ajouter à l'interface `Subject` (après `i18n: SubjectI18n`) :
```ts
  inherits: Partial<Record<InheritableField, string>>
```

- [ ] **Step 3 : Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: 0 erreur (les usages existants de `Subject` n'utilisent pas encore `inherits` ; comme il est requis, vérifier qu'aucun objet `Subject` littéral n'est construit hors BDD — sinon ajouter `inherits: {}`). Si une erreur « property 'inherits' is missing » apparaît dans un test/fixture, ajouter `inherits: {}` à ce littéral.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/013_subject_relations.sql src/types/index.ts
git commit -m "feat(relations): migration 013 + types SubjectRelation/inherits"
```

> **Note d'exécution** : la migration `013` devra être **appliquée en BDD** au déploiement (comme `010`/`012`). À noter dans `docs/STATUS.md` en fin de feature.

---

### Task 2 : `resolveInheritance` + validateurs

**Files:**
- Create: `src/lib/subjects/inheritance.ts`
- Test: `src/lib/subjects/inheritance.test.ts`

**Interfaces:**
- Consumes: `localizedSubject` (de `./localized`), types `Subject`, `Locale2`, `InheritableField`, `INHERITABLE_FIELDS`.
- Produces:
  - `resolveInheritance(subject: Subject, byId: Map<string, Subject>, locale: Locale2): LocalizedSubject`
  - `isInheritableField(f: string): f is InheritableField`
  - `normalizeAssocPair(a: string, b: string): { source_id: string; target_id: string }`
  - `wouldCreateCycle(motherId: string, childId: string, parentEdges: { source_id: string; target_id: string }[]): boolean`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

`src/lib/subjects/inheritance.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { resolveInheritance, isInheritableField, normalizeAssocPair, wouldCreateCycle } from './inheritance'
import type { Subject } from '@/types'

function mk(over: Partial<Subject>): Subject {
  return {
    id: 'x', labo: 'paris', titre: '', kicker: '', question: '', accroche: '', periode: '',
    statut: 'active', context: '', method: '', results: '', keywords: [], auteurs: [],
    difficulte: 'intermediate', dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre: 0, is_transversal: false, confidentiel: false, i18n: {}, inherits: {},
    created_at: '', updated_at: '', ...over,
  }
}

describe('resolveInheritance', () => {
  it('garde la valeur propre quand rien n’est hérité', () => {
    const child = mk({ id: 'c', context: 'propre' })
    const L = resolveInheritance(child, new Map([['c', child]]), 'en')
    expect(L.context).toBe('propre')
  })

  it('hérite un champ depuis la mère (localisé)', () => {
    const mother = mk({ id: 'm', context: 'CTX mère', i18n: { fr: { context: 'CTX mère FR' } } })
    const child = mk({ id: 'c', context: 'ignoré', inherits: { context: 'm' } })
    const byId = new Map([['m', mother], ['c', child]])
    expect(resolveInheritance(child, byId, 'en').context).toBe('CTX mère')
    expect(resolveInheritance(child, byId, 'fr').context).toBe('CTX mère FR')
  })

  it('suit la chaîne mère→grand-mère', () => {
    const gm = mk({ id: 'gm', method: 'M gm' })
    const m = mk({ id: 'm', method: 'ignoré', inherits: { method: 'gm' } })
    const c = mk({ id: 'c', method: 'ignoré', inherits: { method: 'm' } })
    const byId = new Map([['gm', gm], ['m', m], ['c', c]])
    expect(resolveInheritance(c, byId, 'en').method).toBe('M gm')
  })

  it('retombe sur la valeur propre si la mère est absente du byId (visiteur/confidentiel)', () => {
    const child = mk({ id: 'c', context: 'repli', inherits: { context: 'secret' } })
    const L = resolveInheritance(child, new Map([['c', child]]), 'en')
    expect(L.context).toBe('repli')
  })

  it('ne boucle pas sur un cycle accidentel', () => {
    const a = mk({ id: 'a', context: 'A', inherits: { context: 'b' } })
    const b = mk({ id: 'b', context: 'B', inherits: { context: 'a' } })
    const byId = new Map([['a', a], ['b', b]])
    expect(() => resolveInheritance(a, byId, 'en')).not.toThrow()
  })
})

describe('isInheritableField', () => {
  it('accepte la liste blanche et rejette le reste', () => {
    expect(isInheritableField('context')).toBe(true)
    expect(isInheritableField('titre')).toBe(false)
    expect(isInheritableField('nimporte')).toBe(false)
  })
})

describe('normalizeAssocPair', () => {
  it('ordonne source < target (déterministe)', () => {
    expect(normalizeAssocPair('b', 'a')).toEqual({ source_id: 'a', target_id: 'b' })
    expect(normalizeAssocPair('a', 'b')).toEqual({ source_id: 'a', target_id: 'b' })
  })
})

describe('wouldCreateCycle', () => {
  it('détecte qu’ajouter mère→fille créerait un cycle', () => {
    // edges existants : a→b (a mère de b). Ajouter b→a recréerait un cycle.
    const edges = [{ source_id: 'a', target_id: 'b' }]
    expect(wouldCreateCycle('b', 'a', edges)).toBe(true)
    expect(wouldCreateCycle('a', 'c', edges)).toBe(false)
  })
})
```

- [ ] **Step 2 : Lancer les tests (échec)**

Run: `npx vitest run src/lib/subjects/inheritance.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

`src/lib/subjects/inheritance.ts` :
```ts
import type { Subject, Locale2, InheritableField } from '@/types'
import { INHERITABLE_FIELDS } from '@/types'
import { localizedSubject, type LocalizedSubject } from './localized'

export function isInheritableField(f: string): f is InheritableField {
  return (INHERITABLE_FIELDS as readonly string[]).includes(f)
}

export function normalizeAssocPair(a: string, b: string): { source_id: string; target_id: string } {
  return a < b ? { source_id: a, target_id: b } : { source_id: b, target_id: a }
}

/** edges = relations 'parent' existantes (source = mère, target = fille).
 *  Ajouter mother→child crée un cycle si child est déjà un ancêtre de mother. */
export function wouldCreateCycle(
  motherId: string, childId: string,
  parentEdges: { source_id: string; target_id: string }[],
): boolean {
  if (motherId === childId) return true
  // Remonter les ancêtres de mother (en suivant target→source) ; si on atteint child, cycle.
  const parentsOf = new Map<string, string[]>()
  for (const e of parentEdges) {
    const arr = parentsOf.get(e.target_id) ?? []
    arr.push(e.source_id)
    parentsOf.set(e.target_id, arr)
  }
  const stack = [motherId]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === childId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const p of parentsOf.get(cur) ?? []) stack.push(p)
  }
  return false
}

export function resolveInheritance(
  subject: Subject, byId: Map<string, Subject>, locale: Locale2,
  _seen: Set<string> = new Set(),
): LocalizedSubject {
  const own = localizedSubject(subject, locale)
  if (_seen.has(subject.id)) return own
  _seen.add(subject.id)

  const inh = subject.inherits ?? {}
  for (const field of Object.keys(inh)) {
    if (!isInheritableField(field)) continue
    const motherId = inh[field]
    if (!motherId) continue
    const mother = byId.get(motherId)
    if (!mother) continue // mère absente (visiteur/confidentiel) → garde la valeur propre
    const mres = resolveInheritance(mother, byId, locale, _seen)
    ;(own as Record<string, unknown>)[field] = (mres as Record<string, unknown>)[field]
  }
  return own
}
```

- [ ] **Step 4 : Lancer les tests (succès)**

Run: `npx vitest run src/lib/subjects/inheritance.test.ts`
Expected: PASS (tous).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/subjects/inheritance.ts src/lib/subjects/inheritance.test.ts
git commit -m "feat(relations): resolveInheritance + validateurs (cycle, assoc, liste blanche)"
```

---

### Task 3 : `buildLabelI18n` (libellé d'arête traduit)

**Files:**
- Create: `src/lib/subjects/relation-label.ts`
- Test: `src/lib/subjects/relation-label.test.ts`

**Interfaces:**
- Consumes: `getChatProvider`/`ChatProvider` (de `@/lib/llm`), `recordUsage` (de `@/lib/rag/usage`), `Locale2`.
- Produces: `buildLabelI18n(label: string, sourceLocale: Locale2, deps?: { provider?; record?; disabled?; overBudget? }): Promise<Partial<Record<Locale2, { label: string }>>>`

- [ ] **Step 1 : Écrire les tests (échec attendu)**

`src/lib/subjects/relation-label.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { buildLabelI18n } from './relation-label'

const provider = (out: string) => ({ complete: async () => ({ content: out }) })

describe('buildLabelI18n', () => {
  it('renvoie {} pour un libellé vide', async () => {
    expect(await buildLabelI18n('', 'fr', { disabled: true })).toEqual({})
  })

  it('disabled : même libellé dans les deux langues', async () => {
    const r = await buildLabelI18n('mêmes données', 'fr', { disabled: true })
    expect(r.fr).toEqual({ label: 'mêmes données' })
    expect(r.en).toEqual({ label: 'mêmes données' })
  })

  it('traduit vers l’autre langue', async () => {
    const r = await buildLabelI18n('mêmes données', 'fr', { provider: provider('same data'), record: async () => {} })
    expect(r.fr).toEqual({ label: 'mêmes données' })
    expect(r.en).toEqual({ label: 'same data' })
  })

  it('repli sur la source si la traduction échoue', async () => {
    const r = await buildLabelI18n('x', 'en', { provider: { complete: async () => { throw new Error('boom') } }, record: async () => {} })
    expect(r.en).toEqual({ label: 'x' })
    expect(r.fr).toEqual({ label: 'x' })
  })
})
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npx vitest run src/lib/subjects/relation-label.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

`src/lib/subjects/relation-label.ts` :
```ts
import type { Locale2 } from '@/types'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const LANG_NAME: Record<Locale2, string> = { en: 'English', fr: 'French' }

export async function buildLabelI18n(
  label: string,
  sourceLocale: Locale2,
  deps: { provider?: ChatProvider; record?: (i: number, o: number) => Promise<void>; disabled?: boolean; overBudget?: boolean } = {},
): Promise<Partial<Record<Locale2, { label: string }>>> {
  const src = label.trim()
  if (!src) return {}
  const other: Locale2 = sourceLocale === 'en' ? 'fr' : 'en'
  if (deps.disabled || deps.overBudget) {
    return { [sourceLocale]: { label: src }, [other]: { label: src } }
  }
  const provider = deps.provider ?? getChatProvider()
  const system = `Translate the following short relationship label for an academic research graph into ${LANG_NAME[other]}. Keep it short (1–4 words). Keep acronyms/technical terms verbatim. Reply with ONLY the translated label, no quotes, no commentary.`
  try {
    const completion = await provider.complete(
      [{ role: 'system', content: system }, { role: 'user', content: src }],
      { maxTokens: 60 },
    )
    const out = (completion.content ?? '').trim()
    await (deps.record ?? recordUsage)(Math.ceil((system.length + src.length) / 4), Math.ceil(out.length / 4))
    return { [sourceLocale]: { label: src }, [other]: { label: out || src } }
  } catch (e) {
    console.error('buildLabelI18n: falling back to source', e instanceof Error ? e.message : e)
    return { [sourceLocale]: { label: src }, [other]: { label: src } }
  }
}
```

> **Vérifier** la signature réelle de `provider.complete` dans `src/lib/llm` (vue dans `translate.ts` : `complete(messages, { maxTokens })` → `{ content }`). Ajuster si l'API diffère.

- [ ] **Step 4 : Lancer (succès)**

Run: `npx vitest run src/lib/subjects/relation-label.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/subjects/relation-label.ts src/lib/subjects/relation-label.test.ts
git commit -m "feat(relations): buildLabelI18n (traduction libellé d'arête)"
```

---

### Task 4 : `buildGraphData` (fiches+relations → nœuds/arêtes)

**Files:**
- Create: `src/lib/subjects/graph-data.ts`
- Test: `src/lib/subjects/graph-data.test.ts`
- Modify: `src/types/index.ts` (types nœud/arête)

**Interfaces:**
- Produces (dans types) :
  ```ts
  export interface RelationGraphNode { id: string; titre: string; labo: Lab; statut: SubjectStatus; is_transversal: boolean }
  export interface RelationGraphEdge { id: string; source: string; target: string; kind: RelationKind; label: string }
  ```
- Produces (graph-data) : `buildGraphData(subjects: Subject[], relations: SubjectRelation[], locale: Locale2): { nodes: RelationGraphNode[]; edges: RelationGraphEdge[] }`. Filtre les arêtes dont une extrémité est absente des `subjects` fournis (gate confidentiel déjà appliqué en amont).

- [ ] **Step 1 : Écrire les tests (échec attendu)**

`src/lib/subjects/graph-data.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { buildGraphData } from './graph-data'
import type { Subject, SubjectRelation } from '@/types'

function sub(id: string, over: Partial<Subject> = {}): Subject {
  return { id, labo: 'paris', titre: id.toUpperCase(), kicker: '', question: '', accroche: '', periode: '',
    statut: 'active', context: '', method: '', results: '', keywords: [], auteurs: [], difficulte: 'intermediate',
    dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 0, is_transversal: false,
    confidentiel: false, i18n: {}, inherits: {}, created_at: '', updated_at: '', ...over }
}
function rel(over: Partial<SubjectRelation>): SubjectRelation {
  return { id: 'r', source_id: 'a', target_id: 'b', kind: 'assoc', label: '', label_i18n: {}, created_at: '', ...over }
}

describe('buildGraphData', () => {
  it('produit un nœud par sujet et conserve le titre localisé', () => {
    const subs = [sub('a', { i18n: { fr: { titre: 'A-FR' } } })]
    const { nodes } = buildGraphData(subs, [], 'fr')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].titre).toBe('A-FR')
  })

  it('garde l’arête quand les deux extrémités existent', () => {
    const subs = [sub('a'), sub('b')]
    const { edges } = buildGraphData(subs, [rel({ id: 'r1', source_id: 'a', target_id: 'b', kind: 'parent' })], 'en')
    expect(edges).toHaveLength(1)
    expect(edges[0].kind).toBe('parent')
  })

  it('écarte l’arête vers un sujet absent (confidentiel masqué)', () => {
    const subs = [sub('a')]
    const { edges } = buildGraphData(subs, [rel({ id: 'r2', source_id: 'a', target_id: 'secret' })], 'en')
    expect(edges).toHaveLength(0)
  })

  it('localise le libellé d’arête', () => {
    const subs = [sub('a'), sub('b')]
    const r = rel({ id: 'r3', label: 'same data', label_i18n: { fr: { label: 'mêmes données' } } })
    expect(buildGraphData(subs, [r], 'fr').edges[0].label).toBe('mêmes données')
    expect(buildGraphData(subs, [r], 'en').edges[0].label).toBe('same data')
  })
})
```

- [ ] **Step 2 : Ajouter les types** dans `src/types/index.ts` (après `SubjectRelation`) — voir bloc « Produces » ci-dessus.

- [ ] **Step 3 : Lancer (échec)**

Run: `npx vitest run src/lib/subjects/graph-data.test.ts`
Expected: FAIL.

- [ ] **Step 4 : Implémenter**

`src/lib/subjects/graph-data.ts` :
```ts
import type { Subject, SubjectRelation, Locale2, RelationGraphNode, RelationGraphEdge } from '@/types'
import { localizedSubject } from './localized'

export function buildGraphData(subjects: Subject[], relations: SubjectRelation[], locale: Locale2): {
  nodes: RelationGraphNode[]; edges: RelationGraphEdge[]
} {
  const present = new Set(subjects.map(s => s.id))
  const nodes: RelationGraphNode[] = subjects.map(s => ({
    id: s.id, titre: localizedSubject(s, locale).titre, labo: s.labo, statut: s.statut, is_transversal: s.is_transversal,
  }))
  const edges: RelationGraphEdge[] = relations
    .filter(r => present.has(r.source_id) && present.has(r.target_id))
    .map(r => ({
      id: r.id, source: r.source_id, target: r.target_id, kind: r.kind,
      label: r.label_i18n?.[locale]?.label ?? r.label,
    }))
  return { nodes, edges }
}
```

- [ ] **Step 5 : Lancer (succès)**

Run: `npx vitest run src/lib/subjects/graph-data.test.ts`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/subjects/graph-data.ts src/lib/subjects/graph-data.test.ts src/types/index.ts
git commit -m "feat(relations): buildGraphData (nœuds/arêtes localisés, gate confidentiel)"
```

---

# PHASE 2 — API

### Task 5 : Routes `relations` (POST créer, GET lister, DELETE)

**Files:**
- Create: `src/app/api/subjects/[id]/relations/route.ts` (POST, GET)
- Create: `src/app/api/subjects/[id]/relations/[relId]/route.ts` (DELETE)
- Create: `src/app/api/subjects/[id]/relations/wire.test.ts`

**Interfaces:**
- Consumes: `requireMember`, `authErrorResponse` (`@/lib/auth`), `createServiceClient`, `normalizeAssocPair`, `wouldCreateCycle`, `buildLabelI18n`, `isOverBudget`.
- Produces (HTTP) :
  - `POST /api/subjects/[id]/relations` body `{ kind: 'parent'|'assoc', otherId: string, direction?: 'child'|'mother', label?: string, locale?: 'en'|'fr' }` → 201 `{ relation }`. Pour `parent` : `direction='child'` (défaut) ⇒ `id` est la mère, `otherId` la fille ; `direction='mother'` ⇒ inverse. Erreurs : 400 (champs), 409 (cycle/auto/doublon).
  - `GET /api/subjects/[id]/relations` → `{ relations: SubjectRelation[] }` (toutes les relations touchant `id`).
  - `DELETE /api/subjects/[id]/relations/[relId]` → 200 ; purge `inherits` de la fille pointant la mère retirée.

- [ ] **Step 1 : Écrire les tests de logique (échec attendu)**

Extraire la validation pure dans le module de route n'est pas pratique ; on teste plutôt une fonction d'aide exportée. Créer `wire.test.ts` qui importe des helpers exportés depuis la route :

`src/app/api/subjects/[id]/relations/wire.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { parseRelationBody, resolveParentEnds } from './route'

describe('parseRelationBody', () => {
  it('rejette un kind invalide', () => {
    expect(parseRelationBody({ kind: 'x', otherId: 'b' }).error).toBeTruthy()
  })
  it('rejette otherId manquant', () => {
    expect(parseRelationBody({ kind: 'assoc' }).error).toBeTruthy()
  })
  it('accepte un assoc valide', () => {
    const r = parseRelationBody({ kind: 'assoc', otherId: 'b' })
    expect(r.error).toBeFalsy()
    expect(r.value).toMatchObject({ kind: 'assoc', otherId: 'b' })
  })
})

describe('resolveParentEnds', () => {
  it('direction=child : id est la mère', () => {
    expect(resolveParentEnds('id', 'other', 'child')).toEqual({ source_id: 'id', target_id: 'other' })
  })
  it('direction=mother : id est la fille', () => {
    expect(resolveParentEnds('id', 'other', 'mother')).toEqual({ source_id: 'other', target_id: 'id' })
  })
})
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npx vitest run "src/app/api/subjects/[id]/relations/wire.test.ts"`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter la route POST/GET**

`src/app/api/subjects/[id]/relations/route.ts` :
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { normalizeAssocPair, wouldCreateCycle } from '@/lib/subjects/inheritance'
import { buildLabelI18n } from '@/lib/subjects/relation-label'
import { isOverBudget } from '@/lib/rag/usage'
import type { RelationKind } from '@/types'

type Params = { params: Promise<{ id: string }> }

export function parseRelationBody(body: unknown): { error?: string; value?: { kind: RelationKind; otherId: string; direction: 'child' | 'mother'; label: string; locale: 'en' | 'fr' } } {
  const b = (body ?? {}) as Record<string, unknown>
  const kind = b.kind
  if (kind !== 'parent' && kind !== 'assoc') return { error: 'invalid kind' }
  const otherId = typeof b.otherId === 'string' ? b.otherId : ''
  if (!otherId) return { error: 'otherId required' }
  const direction = b.direction === 'mother' ? 'mother' : 'child'
  const label = typeof b.label === 'string' ? b.label : ''
  const locale = b.locale === 'fr' ? 'fr' : 'en'
  return { value: { kind, otherId, direction, label, locale } }
}

/** Pour 'parent' : qui est mère (source) / fille (target) selon la direction depuis `id`. */
export function resolveParentEnds(id: string, otherId: string, direction: 'child' | 'mother'): { source_id: string; target_id: string } {
  return direction === 'mother' ? { source_id: otherId, target_id: id } : { source_id: id, target_id: otherId }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const service = await createServiceClient()
  const { data, error } = await service.from('subject_relations').select('*').or(`source_id.eq.${id},target_id.eq.${id}`)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ relations: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const parsed = parseRelationBody(await req.json())
  if (parsed.error || !parsed.value) return NextResponse.json({ error: parsed.error ?? 'bad request' }, { status: 400 })
  const { kind, otherId, direction, label, locale } = parsed.value
  if (otherId === id) return NextResponse.json({ error: 'self link' }, { status: 409 })

  const service = await createServiceClient()

  if (kind === 'parent') {
    const { source_id, target_id } = resolveParentEnds(id, otherId, direction)
    const { data: edges } = await service.from('subject_relations').select('source_id,target_id').eq('kind', 'parent')
    if (wouldCreateCycle(source_id, target_id, edges ?? [])) {
      return NextResponse.json({ error: 'cycle' }, { status: 409 })
    }
    const { data, error } = await service.from('subject_relations')
      .insert({ source_id, target_id, kind: 'parent', label: '', label_i18n: {} }).select().single()
    if (error?.code === '23505') return NextResponse.json({ error: 'duplicate' }, { status: 409 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ relation: data }, { status: 201 })
  }

  // assoc : non orienté, normalisé
  const { source_id, target_id } = normalizeAssocPair(id, otherId)
  const label_i18n = await buildLabelI18n(label, locale, {
    disabled: process.env.ASSISTANT_DISABLED === '1', overBudget: await isOverBudget(),
  })
  const { data, error } = await service.from('subject_relations')
    .insert({ source_id, target_id, kind: 'assoc', label: label.trim(), label_i18n }).select().single()
  if (error?.code === '23505') return NextResponse.json({ error: 'duplicate' }, { status: 409 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ relation: data }, { status: 201 })
}
```

- [ ] **Step 4 : Implémenter la route DELETE**

`src/app/api/subjects/[id]/relations/[relId]/route.ts` :
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string; relId: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { relId } = await params
  const service = await createServiceClient()

  // Récupérer la relation pour purger l'héritage si c'était un parent.
  const { data: rel } = await service.from('subject_relations').select('*').eq('id', relId).single()
  if (rel && rel.kind === 'parent') {
    // fille = target_id ; retirer du `inherits` les clés pointant vers la mère = source_id.
    const { data: child } = await service.from('subjects').select('inherits').eq('id', rel.target_id).single()
    const inh = (child?.inherits ?? {}) as Record<string, string>
    const cleaned = Object.fromEntries(Object.entries(inh).filter(([, motherId]) => motherId !== rel.source_id))
    await service.from('subjects').update({ inherits: cleaned }).eq('id', rel.target_id)
  }
  const { error } = await service.from('subject_relations').delete().eq('id', relId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5 : Lancer les tests (succès)**

Run: `npx vitest run "src/app/api/subjects/[id]/relations/wire.test.ts"`
Expected: PASS.

- [ ] **Step 6 : tsc + commit**

Run: `npx tsc --noEmit` (0 erreur)
```bash
git add "src/app/api/subjects/[id]/relations"
git commit -m "feat(relations): routes API POST/GET/DELETE relations (+ cycle/doublon/assoc)"
```

---

### Task 6 : `PATCH /api/subjects/[id]` accepte `inherits`

**Files:**
- Modify: `src/app/api/subjects/[id]/route.ts`
- Test: `src/app/api/subjects/inherits-validate.test.ts`

**Interfaces:**
- Produces: helper exporté `sanitizeInherits(raw: unknown, validMotherIds: Set<string>): Record<string, string>` (garde uniquement clés héritables + mères réelles).

- [ ] **Step 1 : Écrire le test (échec attendu)**

`src/app/api/subjects/inherits-validate.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { sanitizeInherits } from './[id]/route'

describe('sanitizeInherits', () => {
  const mothers = new Set(['m1', 'm2'])
  it('garde une clé héritable pointant une mère réelle', () => {
    expect(sanitizeInherits({ context: 'm1' }, mothers)).toEqual({ context: 'm1' })
  })
  it('rejette un champ non héritable', () => {
    expect(sanitizeInherits({ titre: 'm1' }, mothers)).toEqual({})
  })
  it('rejette une mère inconnue', () => {
    expect(sanitizeInherits({ context: 'zzz' }, mothers)).toEqual({})
  })
  it('ignore les valeurs non-string', () => {
    expect(sanitizeInherits({ context: 123 }, mothers)).toEqual({})
  })
})
```

- [ ] **Step 2 : Lancer (échec)**

Run: `npx vitest run src/app/api/subjects/inherits-validate.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Implémenter dans `src/app/api/subjects/[id]/route.ts`**

Ajouter en tête (après les imports) :
```ts
import { isInheritableField } from '@/lib/subjects/inheritance'

export function sanitizeInherits(raw: unknown, validMotherIds: Set<string>): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isInheritableField(k) && typeof v === 'string' && validMotherIds.has(v)) out[k] = v
  }
  return out
}
```

Dans `PATCH`, après le bloc i18n et avant `const service = ...` (déplacer la création du `service` plus haut si besoin) :
```ts
  const svc = await createServiceClient()
  if ('inherits' in body) {
    // mères réelles = sources des relations 'parent' dont la fille est `id`.
    const { data: parents } = await svc.from('subject_relations').select('source_id').eq('kind', 'parent').eq('target_id', id)
    const motherIds = new Set((parents ?? []).map((p: { source_id: string }) => p.source_id))
    updates.inherits = sanitizeInherits(body.inherits, motherIds)
  }
```
Puis réutiliser `svc` pour l'`update` final (remplacer le `const service = await createServiceClient()` existant par l'usage de `svc`).

- [ ] **Step 4 : Lancer (succès)** + `npx tsc --noEmit`

Run: `npx vitest run src/app/api/subjects/inherits-validate.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add "src/app/api/subjects/[id]/route.ts" src/app/api/subjects/inherits-validate.test.ts
git commit -m "feat(relations): PATCH subject valide et enregistre inherits"
```

---

### Task 7 : `POST /api/subjects` accepte `parentId` + `inherits`

**Files:**
- Modify: `src/app/api/subjects/route.ts`

**Interfaces:**
- Consumes: `sanitizeInherits` (de `./[id]/route`), `isInheritableField`.
- Produces (HTTP) : `POST /api/subjects` accepte en plus `parentId?: string` et `inherits?: Record<string,string>`. Si `parentId` fourni : crée la fiche, insère une relation `parent` (`source=parentId`, `target=newId`), filtre `inherits` aux champs héritables pointant `parentId`.

- [ ] **Step 1 : Implémenter** (étend le POST existant ; pas de nouveau test unitaire — couvert par `sanitizeInherits` + vérif manuelle)

Après l'insert du sujet (`const { data, error } = ... .single()`) et avant `scheduleReindex` :
```ts
  // Lien mère→fille optionnel (bouton « créer une fiche fille »).
  const parentId = typeof body.parentId === 'string' ? body.parentId : ''
  if (!error && parentId) {
    await service.from('subject_relations').insert({ source_id: parentId, target_id: data.id, kind: 'parent', label: '', label_i18n: {} })
    const inh: Record<string, string> = {}
    const raw = (body.inherits ?? {}) as Record<string, unknown>
    for (const [k, v] of Object.entries(raw)) {
      if (isInheritableField(k) && v === parentId) inh[k] = parentId
    }
    if (Object.keys(inh).length) {
      await service.from('subjects').update({ inherits: inh }).eq('id', data.id)
      data.inherits = inh
    }
  }
```
Ajouter l'import : `import { isInheritableField } from '@/lib/subjects/inheritance'`.

- [ ] **Step 2 : Vérifier** `npx tsc --noEmit` + suite complète `npx vitest run` (0 régression).

- [ ] **Step 3 : Commit**

```bash
git add src/app/api/subjects/route.ts
git commit -m "feat(relations): POST subject crée fille + lien parent + inherits"
```

---

# PHASE 3 — Lecture & intégration contenu

### Task 8 : Page paper charge les relations + résout l'héritage + badges

**Files:**
- Modify: `src/app/[locale]/[lab]/paper/[id]/page.tsx`
- Modify: `src/components/paper/PaperView.tsx` (props)
- Modify: `src/components/paper/PaperSheet.tsx` (résolution + badges)
- Modify: `messages/en.json`, `messages/fr.json` (clé `paper.relations.inheritedFrom`)

**Interfaces:**
- Consumes: `resolveInheritance`, `buildGraphData` (pas ici), `SubjectRelation`.
- Produces: `PaperView` reçoit `relations: SubjectRelation[]` et `relatedSubjects: Subject[]` (fiches mères/filles/assoc, déjà gate-confidentiel). `PaperSheet` reçoit `byId: Map<string,Subject>` (ou `relatedSubjects`) pour résoudre.

- [ ] **Step 1 : Charger relations + sujets liés dans la page**

Dans `paper/[id]/page.tsx`, ajouter au `Promise.all` :
```ts
    service.from('subject_relations').select('*').or(`source_id.eq.${id},target_id.eq.${id}`),
```
(récupérer dans `{ data: relRows }`). Puis charger les sujets liés (avec gate confidentiel) :
```ts
  const relatedIds = Array.from(new Set((relRows ?? []).flatMap((r: SubjectRelation) => [r.source_id, r.target_id]).filter(x => x !== id)))
  let related: Subject[] = []
  if (relatedIds.length) {
    let rq = service.from('subjects').select('*').in('id', relatedIds)
    if (!isMember) rq = rq.eq('confidentiel', false)
    related = ((await rq).data ?? []) as Subject[]
  }
```
Passer `relations={(relRows ?? []) as SubjectRelation[]}` et `relatedSubjects={related}` à `PaperView`. (Importer `Subject`, `SubjectRelation` du barrel des types.)

- [ ] **Step 2 : `PaperView` transmet à `PaperSheet` + `RelationsPanel`**

Ajouter aux `Props` de `PaperView` : `relations: SubjectRelation[]`, `relatedSubjects: Subject[]`. Construire `const byId = new Map<string, Subject>([subject, ...relatedSubjects].map(s => [s.id, s]))` et passer `byId` à `PaperSheet`. (RelationsPanel câblé en Task 11.)

- [ ] **Step 3 : `PaperSheet` résout l'héritage + badge**

Remplacer `const L = localizedSubject(subject, toLocale2(locale))` par `const L = resolveInheritance(subject, byId, toLocale2(locale))` (importer `resolveInheritance`). Ajouter `byId: Map<string, Subject>` aux props. Pour chaque champ héritable affiché, si `subject.inherits[field]` est défini **et** la mère est dans `byId`, afficher un petit badge `font-mono` cliquable (lien vers `/[locale]/[lab]/paper/{motherId}`) : texte `t('relations.inheritedFrom', { title: localizedSubject(mother, loc).titre })`. Style : `fontSize: 9`, couleur `text-fame-text-muted`, fond `rgba(47,68,134,0.08)`, `borderRadius: 5`, padding `2px 7px`.

- [ ] **Step 4 : Clés i18n**

`messages/en.json` (namespace `paper`, sous-objet `relations`) : `"inheritedFrom": "inherited from {title}"`.
`messages/fr.json` : `"inheritedFrom": "hérité de {title}"`.

- [ ] **Step 5 : Vérifier** `npx tsc --noEmit`, parité clés (script du repo), `npx vitest run src/components/paper` (ajuster le test de `PaperSheet` s'il construit un `subject` littéral → ajouter `inherits: {}` et passer un `byId` vide).

- [ ] **Step 6 : Commit**

```bash
git add "src/app/[locale]/[lab]/paper/[id]/page.tsx" src/components/paper/PaperView.tsx src/components/paper/PaperSheet.tsx messages/en.json messages/fr.json
git commit -m "feat(relations): fiche résout l'héritage + badge « hérité de »"
```

---

### Task 9 : Carte vitrine résout l'héritage

**Files:**
- Modify: `src/components/lab/SubjectGrid.tsx` (passe un `byId`), `src/components/lab/SubjectVitrine.tsx` (résout)

**Interfaces:**
- Consumes: `resolveInheritance`.

- [ ] **Step 1 : `SubjectGrid` construit `byId`**

`SubjectGrid` reçoit déjà tous les sujets (`subjects`). Construire `const byId = useMemo(() => new Map(subjects.map(s => [s.id, s])), [subjects])` et le passer en prop à `SubjectVitrine`.

- [ ] **Step 2 : `SubjectVitrine` résout**

Remplacer `const L = localizedSubject(subject, locale)` (ligne ~33) par `const L = resolveInheritance(subject, byId, locale)` ; ajouter `byId: Map<string, Subject>` aux props. (Les cartes n'affichent que `titre`/`question`/`accroche`/`kicker`/`keywords` — l'héritage de `kicker`/`keywords` est donc visible ; `titre`/`question`/`accroche` ne sont jamais hérités.)

- [ ] **Step 3 : Vérifier** `npx tsc --noEmit`, `npx vitest run src/components/lab` (ajuster `SubjectVitrine.test.tsx` : passer `byId={new Map()}` et ajouter `inherits: {}` aux fixtures).

- [ ] **Step 4 : Commit**

```bash
git add src/components/lab/SubjectGrid.tsx src/components/lab/SubjectVitrine.tsx src/components/lab/SubjectVitrine.test.tsx
git commit -m "feat(relations): carte vitrine résout l'héritage (kicker/keywords)"
```

---

# PHASE 4 — Panneau fiche + créer une fille

### Task 10 : `RelationsPanel` (lecture)

**Files:**
- Create: `src/components/paper/RelationsPanel.tsx`
- Create: `src/components/paper/RelationsPanel.test.tsx` (`// @vitest-environment jsdom`)
- Modify: `messages/en.json`, `messages/fr.json` (`paper.relations.*`)

**Interfaces:**
- Consumes: `SubjectRelation`, `Subject`, `localizedSubject`, `useTranslations`, `useLocale`.
- Produces: `<RelationsPanel subjectId relations relatedById isMember open onToggleOpen locale lab onChanged />`. En lecture : 3 groupes (Mères = relations parent où `target=subjectId` ; Filles = parent où `source=subjectId` ; Associations = assoc touchant `subjectId`). Chaque entrée = `Link` vers la fiche liée. Style calqué sur `TasksPanel` (même conteneur navy `#2f4486`, header repliable).

- [ ] **Step 1 : Test composant (échec attendu)** — rendu des 3 groupes.

`RelationsPanel.test.tsx` : monter avec 1 mère + 1 fille + 1 assoc et un `NextIntlClientProvider` (suivre le pattern de `TaskModal.test.tsx` pour le provider/messages), vérifier que les titres des fiches liées apparaissent et que les libellés de groupe (`t('relations.mothers')` etc.) sont rendus.

- [ ] **Step 2 : Lancer (échec)** `npx vitest run src/components/paper/RelationsPanel.test.tsx`

- [ ] **Step 3 : Implémenter** `RelationsPanel.tsx` (lecture seule pour cette task ; le bloc édition arrive en Task 11 mais on prévoit les props `isMember`/`onChanged`). Dériver les 3 groupes depuis `relations` + `relatedById`. Pour chaque mère, lister les champs hérités d'elle en lisant `subject.inherits` — mais le panel n'a pas le `subject` complet ; **passer aussi `subjectInherits: Subject['inherits']`** en prop pour afficher « hérite : context, method… ».

- [ ] **Step 4 : Clés i18n** dans `paper.relations` (en + fr) : `mothers` (« Mothers »/« Mères »), `daughters` (« Daughters »/« Filles »), `associations` (« Links »/« Associations »), `inheritsFields` (« inherits: {fields} »/« hérite : {fields} »), `none` (« none »/« aucune »), titre de section `title` (« Relations »).

- [ ] **Step 5 : Lancer (succès)** + parité clés + `npx tsc --noEmit`.

- [ ] **Step 6 : Commit**

```bash
git add src/components/paper/RelationsPanel.tsx src/components/paper/RelationsPanel.test.tsx messages/en.json messages/fr.json
git commit -m "feat(relations): RelationsPanel (lecture des mères/filles/associations)"
```

---

### Task 11 : `RelationsPanel` édition + montage sous Tasks

**Files:**
- Modify: `src/components/paper/RelationsPanel.tsx` (mode édition)
- Modify: `src/components/paper/PaperView.tsx` (monter le panneau sous `TasksPanel` ; restructurer la colonne gauche en pile scrollable comme la droite)
- Modify: `messages/en.json`, `messages/fr.json`

**Interfaces:**
- Consumes (HTTP) : `POST/DELETE /api/subjects/[id]/relations`, `PATCH /api/subjects/[id]` (`inherits`).

- [ ] **Step 1 : Colonne gauche pile** dans `PaperView` : remplacer le `TasksPanel` positionné seul par un conteneur `position:absolute; left:14; top:118; bottom:124; width:300; display:flex; fl-direction:column; gap:12; overflow-y:auto` (calqué sur la colonne droite) contenant `TasksPanel` **puis** `RelationsPanel`. Passer à `RelationsPanel` : `subjectId={subject.id}`, `relations`, `relatedById={byId}`, `subjectInherits={subject.inherits}`, `isMember`, `locale`, `lab`, `onChanged={() => router.refresh()}` (importer `useRouter` de `next/navigation`).

- [ ] **Step 2 : Mode édition (membre)** dans `RelationsPanel` : si `isMember`, afficher (a) un bouton « + lien » ouvrant un mini-formulaire (sélecteur de fiche parmi les autres sujets — **note** : le panel doit recevoir la liste des sujets candidats ; passer `allSubjects: Pick<Subject,'id'|'titre'|'i18n'>[]` depuis `PaperView`, chargé dans la page paper via un `select('id,titre,i18n')` global gate-confidentiel), choix `kind` (parent-mère / parent-fille / assoc), `label` si assoc), (b) une croix de suppression par lien → `DELETE`, (c) pour chaque champ héritable, un `<select>` « valeur propre / hériter de {mère} » (options = mères actuelles) → `PATCH inherits`. Toutes les actions appellent l'API puis `onChanged()`.

- [ ] **Step 3 : Charger `allSubjects` dans la page paper** : ajouter `service.from('subjects').select('id,titre,i18n')` (gate confidentiel si visiteur, mais l'édition est membre → liste complète côté membre) au `Promise.all`, passer à `PaperView` → `RelationsPanel`.

- [ ] **Step 4 : Clés i18n** : `addLink`, `linkKind.motherOf` (« is mother of »), `linkKind.daughterOf` (« derives from »), `linkKind.assoc` (« linked to »), `labelOptional` (« label (optional) »), `ownValue` (« own value »), `inheritFrom` (« inherit from {title} »), `pickSubject` (« choose a subject »), `save`, `cancel`, `remove`. (en + fr)

- [ ] **Step 5 : Vérifier** `npx tsc --noEmit`, `npx vitest run src/components/paper`, parité clés. Vérif navigateur (humain) listée au handoff.

- [ ] **Step 6 : Commit**

```bash
git add src/components/paper "src/app/[locale]/[lab]/paper/[id]/page.tsx" messages/en.json messages/fr.json
git commit -m "feat(relations): RelationsPanel édition (liens + héritage par champ) sous Tasks"
```

---

### Task 12 : Bouton « créer une fiche fille »

**Files:**
- Modify: `src/components/paper/PaperView.tsx` (bouton, membre)
- Modify: `src/components/lab/VitrineEditor.tsx` (mode création avec mère)
- Modify: `messages/en.json`, `messages/fr.json`

**Interfaces:**
- Consumes (HTTP) : `POST /api/subjects` avec `parentId` + `inherits` (Task 7).

- [ ] **Step 1 : Prop `motherSubject` sur `VitrineEditor`** : ajouter une prop optionnelle `motherSubject?: Subject`. En mode création, si fournie : initialiser le formulaire en héritant par défaut les champs héritables (état local `inherited: Set<InheritableField>` pré-rempli avec tous les champs héritables), et afficher par champ un toggle « hériter de {mère} / rédiger ». À l'enregistrement (`POST /api/subjects`), inclure `parentId: motherSubject.id` et `inherits` = `{ field: motherSubject.id }` pour chaque champ coché hérité.

- [ ] **Step 2 : Bouton dans `PaperView`** (membre) : un bouton `+ {t('relations.createDaughter')}` (style cohérent avec le bouton « tasksLink »), ouvrant `VitrineEditor` en création avec `motherSubject={subject}`. (Réutiliser le mécanisme d'ouverture existant de `VitrineEditor` ; si `VitrineEditor` est piloté depuis `SubjectGrid`, exposer ici une instance locale contrôlée par un état `creating`.)

- [ ] **Step 3 : Clés i18n** : `paper.relations.createDaughter` (« + Create a daughter card » / « + Créer une fiche fille »), `inheritToggle.inherit` (« inherit » / « hériter »), `inheritToggle.own` (« write » / « rédiger »). (en + fr)

- [ ] **Step 4 : Vérifier** `npx tsc --noEmit`, `npx vitest run`, parité clés.

- [ ] **Step 5 : Commit**

```bash
git add src/components/paper/PaperView.tsx src/components/lab/VitrineEditor.tsx messages/en.json messages/fr.json
git commit -m "feat(relations): bouton « créer une fiche fille » (mère pré-définie + héritage)"
```

---

# PHASE 5 — Page graphe

### Task 13 : RSC `/[locale]/graph` (chargement données)

**Files:**
- Create: `src/app/[locale]/graph/page.tsx`
- Create: `src/components/graph/graph-shared.ts`
- Modify: `messages/en.json`, `messages/fr.json` (namespace `graph`)

**Interfaces:**
- Consumes: `createServiceClient`, `getSession`, `buildGraphData`, `getTranslations`.
- Produces: rend `<RelationGraph nodes edges isMember locale />` (composant en Task 14). `graph-shared.ts` exporte `NODE_STATUS_COLOR: Record<SubjectStatus,string>` (réutiliser `SUBJECT_STATUS_COLOR` existant de `tasks/kanban-shared` si pertinent) et `LAB_STROKE: Record<Lab,string>`.

- [ ] **Step 1 : Page RSC**

`src/app/[locale]/graph/page.tsx` :
```tsx
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { buildGraphData } from '@/lib/subjects/graph-data'
import { toLocale2 } from '@/lib/subjects/localized'
import { RelationGraph } from '@/components/graph/RelationGraph'
import type { Subject, SubjectRelation } from '@/types'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'graph' })
  return { title: t('metaTitle') }
}

export default async function GraphPage({ params }: Props) {
  const { locale } = await params
  const isMember = !!(await getSession())?.member
  const service = await createServiceClient()
  let sq = service.from('subjects').select('*')
  if (!isMember) sq = sq.eq('confidentiel', false)
  const [{ data: subjects }, { data: relations }] = await Promise.all([
    sq.order('ordre', { ascending: true }),
    service.from('subject_relations').select('*'),
  ])
  const { nodes, edges } = buildGraphData((subjects ?? []) as Subject[], (relations ?? []) as SubjectRelation[], toLocale2(locale))
  return <RelationGraph nodes={nodes} edges={edges} isMember={isMember} locale={locale} />
}
```

- [ ] **Step 2 : `graph-shared.ts`** : exporter les constantes couleur/stroke (réutiliser les tokens FAME). 

- [ ] **Step 3 : Clés i18n `graph`** (en + fr) : `metaTitle`, `title` (« Network » / « Réseau »), `kicker` (« FAME / Graph »), `empty`, `filters`, `byLab`, `byStatus`, `treeOnly` (« hierarchy only » / « arborescence seule »), `all`, `editMode`, `editModeOn`, `legendParent` (« mother → daughter »), `legendAssoc` (« association »).

- [ ] **Step 4 : Vérifier** `npx tsc --noEmit` (RelationGraph stub temporaire si nécessaire — sinon faire Task 14 d'abord et committer ensemble). Parité clés.

- [ ] **Step 5 : Commit** (peut être fusionné avec Task 14)

```bash
git add "src/app/[locale]/graph/page.tsx" src/components/graph/graph-shared.ts messages/en.json messages/fr.json
git commit -m "feat(graph): RSC page graphe globale (chargement sujets + relations, gate confidentiel)"
```

---

### Task 14 : `RelationGraph` (rendu d3-force lecture)

**Files:**
- Create: `src/components/graph/RelationGraph.tsx`

**Interfaces:**
- Consumes: `d3` (`d3-force`, `d3-selection`, `d3-zoom` ; tous dans le paquet `d3`), `RelationGraphNode`, `RelationGraphEdge`, `useTranslations`, `useRouter`.
- Produces: `<RelationGraph nodes edges isMember locale />`. Affiche un SVG plein écran : simulation `forceSimulation` (forceLink sur les arêtes, forceManyBody, forceCenter), nœuds = cercles colorés par statut + contour par labo + halo si transversal + libellé `font-mono`, arêtes pleines fléchées (parent) / pointillées (assoc, libellé au survol). Zoom/pan (`d3.zoom`), drag des nœuds, **clic nœud → `router.push('/{locale}/{labo}/paper/{id}')`**, survol → surbrillance voisinage.

- [ ] **Step 1 : Implémenter le rendu** (composant client, `useRef` sur le `<svg>`, `useEffect` qui monte la simulation d3 et nettoie au démontage). Fond `bg-fame-gradient`/navy, identité FAME. Le `labo` du nœud sert à router : **ajouter `labo` à `RelationGraphNode`** (déjà présent — Task 4). Pour router vers la fiche : `/{locale}/{node.labo}/paper/{node.id}`.

- [ ] **Step 2 : Vérification manuelle (humain au handoff)** : la simulation, le zoom et le drag se vérifient au navigateur. Pas de test unitaire du canvas (la logique nœuds/arêtes est déjà testée en Task 4).

- [ ] **Step 3 : Vérifier** `npx tsc --noEmit`, `npm run build` (le SSR ne doit pas planter — d3 monté dans `useEffect` côté client uniquement ; `'use client'` en tête).

- [ ] **Step 4 : Commit**

```bash
git add src/components/graph/RelationGraph.tsx
git commit -m "feat(graph): RelationGraph d3-force (nœuds/arêtes, zoom/pan/drag, clic→fiche)"
```

---

### Task 15 : Filtres + mode édition du graphe

**Files:**
- Modify: `src/components/graph/RelationGraph.tsx`
- Modify: `messages/en.json`, `messages/fr.json` (si clés manquantes)

**Interfaces:**
- Consumes (HTTP) : `POST/DELETE /api/subjects/[id]/relations`.

- [ ] **Step 1 : Filtres** : état local (labo, statut, `treeOnly`) ; recalcul des nœuds/arêtes affichés (filtrer côté composant). Sidebar légère réutilisant l'esthétique `font-mono` des filtres existants.

- [ ] **Step 2 : Mode édition (membre)** : toggle crayon. En mode édition, cliquer un 1er nœud puis un 2nd ouvre un mini-choix (`parent` mère→fille / `assoc` + label) → `POST relations` ; cliquer une arête → `ConfirmDialog` → `DELETE`. Après chaque action, rafraîchir les données (recharger via `fetch('/api/subjects/{id}/relations')` ou `router.refresh()`).

- [ ] **Step 3 : Vérifier** `npx tsc --noEmit`, `npm run build`. Vérif navigateur (humain).

- [ ] **Step 4 : Commit**

```bash
git add src/components/graph/RelationGraph.tsx messages/en.json messages/fr.json
git commit -m "feat(graph): filtres + mode édition membre (créer/supprimer liens)"
```

---

### Task 16 : Entrée nav « Graphe »

**Files:**
- Modify: `src/components/layout/NavMenu.tsx`
- Modify: `messages/en.json`, `messages/fr.json` (`nav.graph`)

**Interfaces:**
- Produces: lien « Graphe » dans le menu, pointant vers `/{locale}/graph` (page globale, hors `[lab]`).

- [ ] **Step 1 : Ajouter le lien** : comme la page est globale, ne pas utiliser `${base}`. Ajouter dans la liste `NAV_LINKS` une entrée gérée à part, OU ajouter un `<Link href={`/${locale}/graph`}>` explicite dans le bloc `NAV_LINKS` rendu (juste après `subjects`). Texte `{t('graph')}`.

- [ ] **Step 2 : Clés i18n** : `nav.graph` (« Graph » / « Graphe »).

- [ ] **Step 3 : Vérifier** `npx tsc --noEmit`, parité clés.

- [ ] **Step 4 : Commit**

```bash
git add src/components/layout/NavMenu.tsx messages/en.json messages/fr.json
git commit -m "feat(graph): entrée nav « Graphe » vers la page globale"
```

---

# PHASE 6 — Finition

### Task 17 : Suite complète, build, STATUS

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1 : Suite complète**

Run: `npx vitest run`
Expected: tout vert.

- [ ] **Step 2 : tsc + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 0 erreur.

- [ ] **Step 3 : Parité i18n**

Run: le script de parité utilisé précédemment (clés EN absentes de FR / FR absentes de EN = 0).

- [ ] **Step 4 : Mettre à jour `docs/STATUS.md`** : entrée résumant la feature, **migration `013` à appliquer en BDD**, raffinement RAG (chunkSubject inchangé), points de vérif navigateur (héritage, badges, panneau, graphe drag/zoom/édition, gate visiteur).

- [ ] **Step 5 : Commit**

```bash
git add docs/STATUS.md
git commit -m "chore(relations): suite verte + STATUS (migration 013 à appliquer)"
```

---

## Self-Review (effectuée)

**Couverture spec :**
- §1 modèle de données → Tasks 1, 4. ✅
- §2 résolution + intégrité → Tasks 2 (resolve/cycle/assoc), 5 (cycle/doublon/purge), 6 (sanitize inherits). ✅
- §3 API → Tasks 5, 6, 7. ✅
- §4 page graphe → Tasks 13, 14, 15, 16. ✅
- §5 panneau + créer fille → Tasks 10, 11, 12. ✅
- §6 i18n + tests → clés ajoutées par task + Task 17 (parité) ; tests TDD dans chaque task lib/API. ✅
- **Écart documenté** : §2 disait « réutilisé dans `chunkSubject` » → raffiné en « chunkSubject inchangé » pour éviter la duplication de chunks RAG. À confirmer au handoff.

**Placeholders :** aucun « TBD/TODO » ; code complet dans les steps cœur ; UI (graphe/édition) décrite précisément avec chemins/props/clés + vérif navigateur humaine (cohérent avec la pratique du repo).

**Cohérence des types :** `resolveInheritance`, `buildGraphData`, `SubjectRelation`, `INHERITABLE_FIELDS`, `sanitizeInherits`, `parseRelationBody`, `resolveParentEnds`, `buildLabelI18n`, `normalizeAssocPair`, `wouldCreateCycle` — signatures identiques entre définition (Tasks 1-7) et usages (Tasks 8-16).
