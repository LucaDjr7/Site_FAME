# Vague 4 — Dette qualité (D4) + i18n (D5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solder D4 (centralisations, dédup, typage, code mort, migration couleurs/polices vers les tokens `fame-*`) et D5 (kickers/labels i18n, traductions FR, suppression des clés mortes), en garantissant la parité EN/FR.

**Architecture:** Branche `vague4`, PR `vague4 → main`. Dernière vague : gros volume de refactor, protégé par la CI posée en V3. Helpers purs (constantes, `dateBucket`, `apiFetch`) et parité i18n → TDD. Dédup de composants et migration couleur/police → structurel (`tsc`+`lint`+revue+manuel), par lots bornés. **La migration CONV-01/02 est viable car la directive `@config` est en place** (`globals.css`, `29d5f62`).

**Tech Stack:** Next.js 16.2.9, React 19, TypeScript strict (+ `noUncheckedIndexedAccess` posé en V3), Tailwind v4 (`@config`), next-intl, Vitest 3 (env `node`).

**Spec de référence :** `docs/superpowers/specs/2026-06-25-vagues-2-4-design.md`. **Audit brut :** `docs/audit-raw/D4-qualite.md`, `docs/audit-raw/D5-i18n.md`.

## Global Constraints

Verbatim spec §7 :

- **i18n** : zéro chaîne UI hardcodée ; toute clé existe dans `messages/en.json` **ET** `messages/fr.json` ; parité stricte des ensembles de clés.
- **Tailwind v4** : ne JAMAIS retirer `@config` de `globals.css`. Migration vers `fame-*` **seulement** pour les valeurs ayant un token ; conserver les `rgba()` à opacité custom et les composants immersifs (`globe/`, `paper/PaperView`) en inline.
- **Sécurité / DB / Routing / Next 16** : inchangées (cf. spec §7). **Aucune** garde `assertLabAccess` ; `Lab='paris'|'montreal'` intact.
- **Gate par tâche** : `npm run typecheck && npm run lint && npm test` à **0/0**.
- **Versioning** : commit atomique, message terminé par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## ⚠️ Notes d'exécution

- **Harnais node-only** : centralisations (constantes, `dateBucket`, `apiFetch`), parité i18n → TDD RED→GREEN. Dédup de composants, migration couleur/police, suppression de clés → structurel + **test de garde** (compte d'occurrences, présence/absence de chaîne) + manuel documenté.
- **Re-vérifier la deadness** : la liste de clés mortes de l'audit (357 clés) précède V1/V2 (aujourd'hui 362). Avant suppression, **re-grepper** chaque clé ; `common.cancel`/`common.confirm`/`common.close` sont **vivantes** (ConfirmDialog + Modal V2) → ne pas supprimer.
- **Ordre interne** : centralisations d'abord (Tasks 1–4), puis typage/code mort (5), puis i18n (6), puis migrations volumineuses couleur/police en dernier (7–8) — elles touchent le plus de fichiers et bénéficient d'un socle déjà assaini.

---

### Task 1: DUP-04 / MORT-03 / DUP-02 — constantes centralisées

**Files:**
- Modify: `src/lib/constants.ts` (ajouter `VALID_LABS`, `LAB_LABELS`, `FAME_PAGE_BG`)
- Modify: les **18** fichiers déclarant `LABS = ['paris','montreal']` (pages + routes API) → importer `VALID_LABS`
- Test (create): `src/lib/constants.test.ts`

**Interfaces:**
- Produces : `export const VALID_LABS: Lab[] = ['paris','montreal']` ; `export const LAB_LABELS: Record<Lab,string> = { paris: 'Paris', montreal: 'Montréal' }` ; `export const FAME_PAGE_BG: string` (gradient canonique `radial-gradient(... rgba(181,157,135,0.28) ...) + #F9F9FA`).

- [ ] **Step 1: Test (RED)** — `src/lib/constants.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { VALID_LABS, LAB_LABELS, FAME_PAGE_BG } from './constants'

describe('constantes labo', () => {
  it('VALID_LABS = paris, montreal', () => expect(VALID_LABS).toEqual(['paris', 'montreal']))
  it('LAB_LABELS mappe les libellés', () => { expect(LAB_LABELS.paris).toBe('Paris'); expect(LAB_LABELS.montreal).toBe('Montréal') })
  it('FAME_PAGE_BG contient le gradient canonique', () => { expect(FAME_PAGE_BG).toContain('rgba(181,157,135'); expect(FAME_PAGE_BG).toContain('#F9F9FA') })
})
```

- [ ] **Step 2: Lancer (échec)** — Run: `npx vitest run src/lib/constants.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter** — ajouter à `src/lib/constants.ts` (avec `import type { Lab } from '@/types'`) :

```ts
import type { Lab } from '@/types'

export const VALID_LABS: Lab[] = ['paris', 'montreal']
export const LAB_LABELS: Record<Lab, string> = { paris: 'Paris', montreal: 'Montréal' }
export const FAME_PAGE_BG =
  'radial-gradient(110% 80% at 50% 0%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 55%), #F9F9FA'
```

- [ ] **Step 4: Lancer (succès)** — Run: `npx vitest run src/lib/constants.test.ts` — Expected: PASS.

- [ ] **Step 5: Remplacer les 18 `LABS` locaux** — dans chaque fichier listé par `grep -rln "LABS.*=.*\['paris'" src`, supprimer la déclaration locale et `import { VALID_LABS } from '@/lib/constants'`, puis remplacer les usages `LABS.includes(...)` par `VALID_LABS.includes(...)`. **Ne change aucun comportement.**

- [ ] **Step 6:** Adopter `LAB_LABELS[lab]` là où `lab === 'paris' ? 'Paris' : 'Montréal'` est recalculé (MORT-03 : `PromptLibrary`, `PaperView`, `DataExplorer`). Adopter `FAME_PAGE_BG` dans les ~8 sites `PAGE_BG` (DUP-02) — garder les variantes documentées en commentaire si l'angle diffère volontairement.

- [ ] **Step 7: Garde** — `grep -rc "LABS: Lab\[\] = \['paris'" src | grep -v ':0' | wc -l` → **0** (plus aucune déclaration locale). Gate complet.
- [ ] **Step 8: Commit** — `refactor: VALID_LABS/LAB_LABELS/FAME_PAGE_BG centralisés (DUP-04/MORT-03/DUP-02)`.

---

### Task 2: DUP-03 / LIS-03 — `dateBucket` + type `DateBucket` centralisés

**Files:**
- Create: `src/lib/utils.ts`
- Modify: `src/types/index.ts` (exporter `DateBucket`)
- Modify: `lab/SubjectGrid.tsx`, `lab/FilterSidebar.tsx`, `tasks/KanbanBoard.tsx`, `tasks/TaskFilterSidebar.tsx` (importer au lieu de redéclarer ; LIS-03 : retirer le `bucket()` inline du Kanban)
- Test (create): `src/lib/utils.test.ts`

**Interfaces:**
- Produces : `export type DateBucket = '2025' | '2024' | 'older'` (dans `types`) ; `export function dateBucket(iso: string): DateBucket` (dans `utils`).

- [ ] **Step 1: Test (RED)** — `src/lib/utils.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { dateBucket } from './utils'

describe('dateBucket', () => {
  it('classe par année', () => {
    expect(dateBucket('2025-03-01')).toBe('2025')
    expect(dateBucket('2024-12-31')).toBe('2024')
    expect(dateBucket('2019-01-01')).toBe('older')
  })
})
```

- [ ] **Step 2: Lancer (échec)** — Run: `npx vitest run src/lib/utils.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter** — `src/types/index.ts` : `export type DateBucket = '2025' | '2024' | 'older'`. `src/lib/utils.ts` :

```ts
import type { DateBucket } from '@/types'

export function dateBucket(iso: string): DateBucket {
  const y = iso.slice(0, 4)
  return y === '2025' ? '2025' : y === '2024' ? '2024' : 'older'
}
```

- [ ] **Step 4: Lancer (succès)** — Run: `npx vitest run src/lib/utils.test.ts` — Expected: PASS.
- [ ] **Step 5:** Remplacer les 4 redéclarations locales par l'import ; supprimer `bucket()` inline du `KanbanBoard` (utiliser `dateBucket`).
- [ ] **Step 6: Garde** — `grep -rn "type DateBucket =" src` → **1** seule occurrence (dans `types`). Gate.
- [ ] **Step 7: Commit** — `refactor: dateBucket + DateBucket centralisés (DUP-03/LIS-03)`.

---

### Task 3: DUP-06 — helper `apiFetch`

**Files:**
- Create: `src/lib/api-fetch.ts`
- Modify: `tasks/KanbanBoard.tsx`, `lab/SubjectGrid.tsx`, `data/DataExplorer.tsx`, `prompts/PromptCard.tsx` (adopter le helper où le pattern fetch+toast d'erreur se répète)
- Test (create): `src/lib/api-fetch.test.ts`

**Interfaces:**
- Produces : `export async function apiFetch<T>(url: string, opts: RequestInit, onError: (msg: string) => void, errMsg: string): Promise<T | null>` — `fetch`, si `!res.ok` → `onError(errMsg)` et `null`, sinon `res.json()` typé. (Le toast reste injecté par l'appelant via `onError` pour rester testable sans contexte React.)

- [ ] **Step 1: Test (RED)** — `src/lib/api-fetch.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { apiFetch } from './api-fetch'

describe('apiFetch', () => {
  it('retourne les données quand ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) })))
    const onError = vi.fn()
    expect(await apiFetch<{ a: number }>('/x', {}, onError, 'err')).toEqual({ a: 1 })
    expect(onError).not.toHaveBeenCalled()
  })
  it('appelle onError et retourne null quand !ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    const onError = vi.fn()
    expect(await apiFetch('/x', {}, onError, 'boom')).toBeNull()
    expect(onError).toHaveBeenCalledWith('boom')
  })
})
```

- [ ] **Step 2: Lancer (échec)** — Run: `npx vitest run src/lib/api-fetch.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter `src/lib/api-fetch.ts`**

```ts
export async function apiFetch<T>(url: string, opts: RequestInit, onError: (msg: string) => void, errMsg: string): Promise<T | null> {
  try {
    const res = await fetch(url, opts)
    if (!res.ok) { onError(errMsg); return null }
    return (await res.json()) as T
  } catch { onError(errMsg); return null }
}
```

- [ ] **Step 4: Lancer (succès)** — Run: `npx vitest run src/lib/api-fetch.test.ts` — Expected: PASS.
- [ ] **Step 5:** Adopter `apiFetch` dans les 4 composants (appel `addToast` via `onError`). Préserver le comportement existant.
- [ ] **Step 6: Gate** + commit `refactor: helper apiFetch (DUP-06)`.

---

### Task 4: DUP-01 / DUP-05 / DUP-07 / MORT-02 — dédup de composants UI

**Files:**
- Create: `src/components/ui/DiffDots.tsx` (signature unifiée `{ level: number }`), `src/components/ui/form-styles.ts`, `src/components/team/team-shared.ts`, `src/components/prompts/prompt-shared.ts`
- Modify: `tasks/kanban-shared.tsx`, `lab/FilterSidebar.tsx`, `lab/SubjectCard.tsx` (DiffDots) ; les 5 modales (form-styles) ; `team/EditMemberModal.tsx`, `team/InviteModal.tsx` (ROLE_KEY) ; `prompts/PromptLibrary.tsx`, `prompts/PromptCard.tsx` (TARGET_META/ORDER)

- [ ] **Step 1: DiffDots** — extraire dans `ui/DiffDots.tsx` (`{ level: number }`). `SubjectCard` convertit sa `Difficulty` en `level` localement (`diffLevel(difficulty)`) puis utilise le composant partagé. Supprimer les 3 implémentations locales.
- [ ] **Step 2: form-styles** — `FORM_INPUT_STYLE`, `FORM_LABEL_STYLE`, `FORM_BTN_CANCEL_STYLE`, `FORM_BTN_SUBMIT_STYLE` ; remplacer les copies dans les 5 modales.
- [ ] **Step 3:** `ROLE_KEY` → `team-shared.ts` ; `TARGET_META`/`TARGET_ORDER` → `prompt-shared.ts` ; remplacer les duplications.
- [ ] **Step 4: Garde** — `grep -rn "function DiffDots\|const DiffDots" src` → **1** (dans `ui/DiffDots.tsx`). Gate (`tsc`+`lint`+`test`). Vérif visuelle manuelle documentée (cartes sujet/tâche identiques avant/après).
- [ ] **Step 5: Commit** — `refactor: DiffDots/form-styles/ROLE_KEY/TARGET_META partagés (DUP-01/05/07/MORT-02)`.

---

### Task 5: TS-01/02/03/05/06 / MORT-01 / CFG-01 / CONV-07 — typage & code mort

**Files (modify):** `paper/[id]/page.tsx` (TS-01 — remplacer le flatten inline + `any` par `flattenTasks()` de `kanban-shared` ; TS-06 — `void` → `_`) ; `lab/AddSubjectModal.tsx`, `publications/AddPublicationModal.tsx` (TS-02 — callbacks typés `Subject`/`Publication`, cast à la frontière JSON) ; `api/publications/route.ts`, `api/members/route.ts`, `api/dropbox/links/route.ts`, `api/prompts/route.ts`, `api/proposals/route.ts` (TS-03 — garder `lab: string | null`, valider `VALID_LABS.includes(lab as Lab)`, n'assigner `as Lab` qu'après) ; `globe/Globe.tsx` (TS-05 — types topojson au lieu de `null as any` ; CONV-07 — `getContext('2d')` gardé ; CFG-01 — documenter le `eslint-disable`) ; `team/EditMemberModal.tsx` (MORT-01 — supprimer la prop morte `isSelf` de `Props` et de l'export, retirer son passage dans `MemberGrid.tsx`).

- [ ] **Step 1: TS-01** — `paper/[id]/page.tsx` : `import { flattenTasks } from '@/components/tasks/kanban-shared'` ; remplacer le mapping `any` par `flattenTasks(tasksRaw ?? [])`. Vérifier que le type produit correspond à `TaskWithRelations[]`.
- [ ] **Step 2: TS-03** — dans les 5 routes, déplacer le cast `as Lab` **après** la validation (modèle `tasks/route.ts:15`). Comportement inchangé, type honnête.
- [ ] **Step 3: TS-02 / TS-05 / TS-06 / CONV-07 / MORT-01 / CFG-01** — appliquer chaque correctif ciblé. Pour `getContext('2d')` : `const ctx = canvas.getContext('2d'); if (!ctx) return`.
- [ ] **Step 4: Garde** — `grep -rn "as Lab" src/app/api | grep -v "includes"` ne montre plus de cast **avant** validation (revue) ; `grep -rn "null as any" src/components/globe` → 0. Gate (`typecheck` strict, désormais avec `noUncheckedIndexedAccess` de V3).
- [ ] **Step 5: Commit** — `refactor: typage strict + suppression code mort (TS-01/02/03/05/06/MORT-01/CFG-01/CONV-07)`.

---

### Task 6: D5 — i18n : kickers, labels, traductions FR, clés mortes

**Files:**
- Modify: `messages/en.json`, `messages/fr.json`
- Modify: `publications/PublicationList.tsx`, `data/DataExplorer.tsx`, `prompts/PromptLibrary.tsx`, `team/MemberGrid.tsx` (F-HC-01 kickers) ; `admin/AdminProposalsClient.tsx:129` (F-HC-02) ; `lab/SubjectCard.tsx:69` (F-HC-04) ; `data/DataExplorer.tsx:568,830` (F-HC-05) ; `team/InviteModal.tsx` (F-HC-06)
- Test (create): `messages/parity.test.ts`

**Interfaces:**
- Produces : kicker i18n `{lab}` interpolé dans 4 namespaces + `admin.kicker` ; labels `data.openInDropbox`/`data.removeLink` ; titre suppression i18n passé en prop à `SubjectCard`. Parité EN/FR stricte.

- [ ] **Step 1: Test parité (garde permanente, RED→GREEN à la fin)** — `messages/parity.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import en from './en.json'
import fr from './fr.json'

const flat = (o: Record<string, unknown>, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => v && typeof v === 'object' ? flat(v as Record<string, unknown>, p + k + '.') : [p + k])

describe('parité i18n', () => {
  it('mêmes clés EN et FR', () => {
    const e = new Set(flat(en)), f = new Set(flat(fr))
    expect([...e].filter(k => !f.has(k))).toEqual([])
    expect([...f].filter(k => !e.has(k))).toEqual([])
  })
})
```
> Ajouter `messages/**/*.test.ts` au `include` Vitest si nécessaire (sinon placer le test sous `src/`).

- [ ] **Step 2:** Ajouter les clés kicker (`publications.kicker`/`data.kicker`/`prompts.kicker`/`team.kicker` = `"FAME / {lab}"`, `admin.kicker` = `"FAME / Admin"`), `data.openInDropbox`/`data.removeLink`, et tout label F-HC-04/06 — dans EN **ET** FR. Brancher chaque composant via `t('kicker', { lab: LAB_LABELS[lab] })` etc.
- [ ] **Step 3: F-FR-01/02** — `fr.json` : `publications.types.preprint` → `"Prépublication"`, `publications.types.working` → `"Document de travail"`.
- [ ] **Step 4: Clés mortes** — pour chacune des 19 clés listées (F-DEAD-01…06), **re-grepper** `t('<clé>')` dans `src/` ; si toujours morte, supprimer dans EN+FR. **Conserver** `common.cancel`/`confirm`/`close` (vivantes). Re-grepper aussi les `common.*` candidates : certaines ont pu être adoptées en V2 (aria-labels) → ne pas supprimer si utilisées.
- [ ] **Step 5: Lancer parité** — Run: `npx vitest run` (test parité) — Expected: PASS (ensembles égaux).
- [ ] **Step 6: Garde** — `grep -rn "FAME / " src/components` → 0 (plus de kicker hardcodé). Gate.
- [ ] **Step 7: Commit** — `feat: kickers/labels i18n + traductions FR + purge clés mortes (D5)`.

---

### Task 7: CONV-02 — migration `fontFamily` inline → `font-serif`/`font-mono`

**Files (modify):** les **31** fichiers `src/components/**.tsx` contenant `fontFamily` (hors `globe/` et `paper/PaperView` immersifs).

**Approche par lots de répertoires** (un commit par lot : `ui/`, `lab/`, `tasks/`, `team/`, `publications/`, `prompts/`, `data/`, `admin/`, `paper/` hors PaperView, `layout/`, `propose/`).

- [ ] **Step 1:** Mapping : `fontFamily: 'Roboto Slab, Georgia, serif'` → `className="… font-serif"` ; `fontFamily: 'IBM Plex Mono, monospace'` → `className="… font-mono"`. Retirer la prop `fontFamily` du `style` inline. Si l'élément n'a pas de `className`, en ajouter une.
- [ ] **Step 2:** Pour chaque lot : appliquer, `grep -c fontFamily` du répertoire (doit chuter), `npx tsc --noEmit && npm run lint`, **vérif visuelle manuelle documentée** (police inchangée à l'écran).
- [ ] **Step 3: Garde finale** — `grep -rln "fontFamily" src/components --include="*.tsx" | grep -vE "globe/|PaperView"` → vide (ou liste justifiée des exemptions immersives).
- [ ] **Step 4: Commits** — un par lot : `refactor(i18n-css): font-serif/font-mono dans <dir> (CONV-02)`.

---

### Task 8: CONV-01 — migration couleurs hex inline → tokens `fame-*`

**Files (modify):** les composants `src/components/**.tsx` contenant `color: '#`/`background: '#` (hors `globe/` et `paper/PaperView`). ~312 occurrences.

**Approche par lots de répertoires**, même découpe que Task 7. **Table de correspondance canonique** (hex → token Tailwind) :

| Hex | Token |
|---|---|
| `#15203f` | `fame-navy` / `text-fame-text-dark` |
| `#2f4486` | `fame-blue` |
| `#1d2b56` | `fame-blue-dark` |
| `#5768ac` | `fame-slate` |
| `#1e9b7e` | `fame-teal` |
| `#e8b149` | `fame-gold` |
| `#ff6f61` | `fame-coral` |
| `#c0473b` | `fame-red` |
| `#fbf9f3` | `fame-sand` |
| `#F9F9FA` | `fame-sand-bg` |
| `#eceadf` | `fame-ecru` |
| `#eef3ff` | `fame-text-light` |
| `#7e95d6` | `fame-text-muted` |
| `#9fb2e6` | `fame-text-dim` |
| `#2a3457` | `fame-text-body` |

- [ ] **Step 1:** Par lot : remplacer `style={{ color: '#2a3457' }}` → `className="… text-fame-text-body"`, `background: '#fbf9f3'` → `bg-fame-sand`, bordures → `border-fame-ecru`. **Exemptions** : valeurs `rgba()` à opacité custom sans token, valeurs proches non chartées (ex. `#fbf8f1` du TaskCard → aligner sur `fame-sand` `#fbf9f3` **seulement si** le diff visuel est nul, sinon laisser + commentaire). Ne pas toucher `globe/` ni `PaperView` immersif.
- [ ] **Step 2:** Par lot : appliquer, `grep -c "color: '#"` du répertoire (doit chuter), `npx tsc --noEmit && npm run lint`, et **vérif visuelle manuelle obligatoire** (le bug Tailwind `@config` étant corrigé, les `fame-*` rendent ; comparer chaque page avant/après). Documenter la vérif dans le rapport.
- [ ] **Step 3:** Vérifier que `@config` est toujours présent dans `globals.css` (régression-test : `grep -n '@config' src/app/globals.css`).
- [ ] **Step 4: Garde finale** — `grep -rn "color: '#\|background: '#" src/components --include="*.tsx" | grep -vE "globe/|PaperView"` → liste résiduelle **justifiée** (rgba/valeurs hors charte), documentée dans le rapport.
- [ ] **Step 5: Commits** — un par lot : `refactor(css): tokens fame-* dans <dir> (CONV-01)`.

---

## Clôture de vague

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` — vert (la CI V3 reproduit ces gates).
- [ ] Vérif visuelle finale des 9 pages (la migration couleur/police ne doit rien changer à l'écran).
- [ ] MAJ `docs/STATUS.md` (Vague 4 : dette + i18n soldées ; audit clos ; lister les exemptions hex/font conservées). MAJ `AGENTS.md` (documenter `privacy/page.tsx`, CONV-06).
- [ ] Revue finale whole-branch (Opus 4.8).
- [ ] `superpowers:finishing-a-development-branch` → PR `vague4 → main`. **Audit pré-prod intégralement soldé** (reste : plan de déploiement production, séparé).
