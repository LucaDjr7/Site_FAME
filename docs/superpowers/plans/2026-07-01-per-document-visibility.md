# Visibilité par document — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chaque membre de marquer un document déposé (`subject_files`) comme confidentiel ou public, indépendamment du statut de la fiche.

**Architecture:** Nouvelle colonne `subject_files.confidentiel` (default `true`). La visibilité effective d'un doc = `subject.confidentiel OR file.confidentiel`. Cette règle est appliquée au gate de download, au filtrage serveur de la liste (visiteur), et au tiering RAG (`member`/`public`). Une route `PATCH` bascule le statut et re-tier les chunks RAG sans ré-embed.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (service-role), Vitest, next-intl.

## Global Constraints

- Next.js 16 : `params`/`searchParams` sont des `Promise` → toujours `await params`.
- Tous les **writes** passent par les routes `/api/` avec `createServiceClient()` (jamais de cookies sur le service-role).
- Lab slug `paris`|`montreal` en minuscules ; valider dans chaque route.
- **Zéro chaîne hardcodée** dans l'UI : clés dans `messages/en.json` **et** `messages/fr.json`.
- Fail-closed sur la confidentialité : en cas de doute (sujet introuvable), traiter comme confidentiel.
- Tests : `npx vitest run <fichier>` ; vérif globale `npx tsc --noEmit` + `npm run lint`.
- Commits atomiques `feat:`/`fix:`/`chore:`, terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/014_subject_file_confidentiel.sql` | colonne `confidentiel` + backfill (nouveau) |
| `src/types/index.ts` | `SubjectFile.confidentiel: boolean` |
| `src/app/api/subjects/[id]/files/route.ts` | register écrit `confidentiel: true` |
| `src/app/api/subjects/[id]/files/[fileId]/route.ts` | gate `OR` + nouvelle route `PATCH` |
| `src/lib/rag/index-file.ts` | `indexSubjectFile` (OR), `retierFile`, `syncSubjectFileVisibility` (par-fichier) |
| `src/lib/rag/schedule.ts` | `scheduleRetierFile` |
| `src/app/[locale]/[lab]/paper/[id]/page.tsx` | filtre `.eq('confidentiel', false)` pour le visiteur |
| `src/components/paper/FilesPanel.tsx` | bouton cadenas + badge |
| `messages/{en,fr}.json` | clés i18n |

---

## Task 1: Migration + type + default du register

**Files:**
- Create: `supabase/migrations/014_subject_file_confidentiel.sql`
- Modify: `src/types/index.ts` (interface `SubjectFile`, ~L248-258)
- Modify: `src/app/api/subjects/[id]/files/route.ts` (insert, ~L25-29)
- Test: `src/app/api/subjects/[id]/files/route.test.ts`

**Interfaces:**
- Produces: `SubjectFile.confidentiel: boolean` ; nouvelles lignes `subject_files` insérées avec `confidentiel: true`.

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migrations/014_subject_file_confidentiel.sql` :

```sql
-- Visibilité par document, indépendante du sujet.
-- Nouveaux docs : confidentiels par défaut (fail-closed).
alter table subject_files
  add column confidentiel boolean not null default true;

-- Préserver l'existant : les docs déjà déposés gardent leur visibilité actuelle
-- (publics sur fiche publique) — pas de masquage rétroactif.
update subject_files set confidentiel = false;
```

- [ ] **Step 2: Ajouter le champ au type**

Dans `src/types/index.ts`, interface `SubjectFile`, ajouter après `size_bytes: number` :

```typescript
  confidentiel: boolean
```

- [ ] **Step 3: Écrire le test du default à l'insertion (échoue)**

Dans `src/app/api/subjects/[id]/files/route.test.ts` : (a) remplacer le mock `insert` pour capturer les valeurs, (b) ajouter un test. Remplacer la ligne du mock `insert: () => (...)` par :

```typescript
      insert: (row: Record<string, unknown>) => { inserted = row; return { select: () => ({ single: () => Promise.resolve(insertResult) }) } },
```

Ajouter en haut, près de `let insertResult` :

```typescript
let inserted: Record<string, unknown> = {}
```

Réinitialiser dans `beforeEach` : `inserted = {}`.

Ajouter le test dans le `describe` :

```typescript
  it('insère confidentiel=true par défaut', async () => {
    await POST(req(valid), params)
    expect(inserted.confidentiel).toBe(true)
  })
```

- [ ] **Step 4: Lancer le test (échoue)**

Run: `npx vitest run src/app/api/subjects/\[id\]/files/route.test.ts`
Expected: FAIL — `inserted.confidentiel` vaut `undefined`.

- [ ] **Step 5: Implémenter le default dans le register**

Dans `src/app/api/subjects/[id]/files/route.ts`, l'appel `.insert({ ... })` (~L25) : ajouter `confidentiel: true` :

```typescript
  const { data, error } = await service.from('subject_files').insert({
    subject_id: id, labo: subject.labo, storage_path: body.storage_path,
    file_name: body.file_name, mime_type: body.mime_type, size_bytes: body.size_bytes,
    uploaded_by: member.id, confidentiel: true,
  }).select().single()
```

- [ ] **Step 6: Lancer le test (passe)**

Run: `npx vitest run src/app/api/subjects/\[id\]/files/route.test.ts`
Expected: PASS (tous, dont l'ancien 201/compensation).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/014_subject_file_confidentiel.sql src/types/index.ts "src/app/api/subjects/[id]/files/route.ts" "src/app/api/subjects/[id]/files/route.test.ts"
git commit -m "feat(files): colonne confidentiel + default true à l'upload

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Download gate — `subject.confidentiel OR file.confidentiel`

**Files:**
- Modify: `src/app/api/subjects/[id]/files/[fileId]/route.ts` (`GET`, L9-26)
- Test: `src/app/api/subjects/[id]/files/[fileId]/route.test.ts`

**Interfaces:**
- Consumes: `SubjectFile.confidentiel` (Task 1).
- Produces: gate download qui renvoie 404 au visiteur si le sujet **ou** le fichier est confidentiel.

- [ ] **Step 1: Écrire les tests (échouent)**

Dans `src/app/api/subjects/[id]/files/[fileId]/route.test.ts`, ajouter dans le `describe('GET ...')` :

```typescript
  it('404 doc confidentiel sur sujet public vu par un visiteur', async () => {
    file = { id: 'f1', subject_id: 's1', storage_path: 's1/uuid', file_name: 'a.pdf', confidentiel: true }
    expect((await GET(gReq(), params)).status).toBe(404)
  })
  it('302 doc confidentiel vu par un membre', async () => {
    file = { id: 'f1', subject_id: 's1', storage_path: 's1/uuid', file_name: 'a.pdf', confidentiel: true }
    getSession.mockResolvedValue({ user: { id: 'u' }, member: { id: 'u' } })
    expect((await GET(gReq(), params)).status).toBe(302)
  })
```

- [ ] **Step 2: Lancer les tests (échouent)**

Run: `npx vitest run src/app/api/subjects/\[id\]/files/\[fileId\]/route.test.ts`
Expected: FAIL — le doc confidentiel renvoie 302 au visiteur (pas encore de gate fichier).

- [ ] **Step 3: Implémenter le gate combiné**

Dans `src/app/api/subjects/[id]/files/[fileId]/route.ts`, `GET`, remplacer les L14-20 (charger le fichier **avant** le gate, puis gate combiné) :

```typescript
  const { data: subject } = await service.from('subjects').select('confidentiel').eq('id', id).single()
  if (!subject) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: file } = await service.from('subject_files').select('*').eq('id', fileId).single()
  if (!file || file.subject_id !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Visiteur : un doc confidentiel (par le sujet OU par le doc) n'existe pas.
  if ((subject.confidentiel || file.confidentiel) && !isMember) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

(supprimer l'ancienne ligne `if (subject.confidentiel && !isMember) ...` et l'ancien chargement du fichier plus bas ; la création de l'URL signée reste inchangée juste après).

- [ ] **Step 4: Lancer les tests (passent)**

Run: `npx vitest run src/app/api/subjects/\[id\]/files/\[fileId\]/route.test.ts`
Expected: PASS (dont les anciens tests GET/DELETE).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/subjects/[id]/files/[fileId]/route.ts" "src/app/api/subjects/[id]/files/[fileId]/route.test.ts"
git commit -m "feat(files): gate download sur confidentialité par document

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: RAG — `indexSubjectFile` respecte `file.confidentiel`

**Files:**
- Modify: `src/lib/rag/index-file.ts` (`indexSubjectFile`, L42-45)
- Test: `src/lib/rag/index-file.test.ts`

**Interfaces:**
- Consumes: `subject_files.confidentiel` (déjà dans `file` via `select('*')`).
- Produces: chunks RAG d'un doc confidentiel indexés en `visibility: 'member'` même si le sujet est public.

- [ ] **Step 1: Écrire le test (échoue)**

Dans `src/lib/rag/index-file.test.ts`, ajouter dans `describe('indexSubjectFile')` :

```typescript
  it('doc confidentiel sur sujet public → chunks visibility=member', async () => {
    fileRow = { id: 'f1', subject_id: 's1', storage_path: 's1/u', file_name: 'doc.pdf', mime_type: 'application/pdf', confidentiel: true }
    subjectRow = { confidentiel: false, labo: 'paris', is_transversal: false }
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => 'contenu' })
    expect(inserted[0]!.visibility).toBe('member')
    expect(inserted[0]!.confidentiel).toBe(true)
  })
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run src/lib/rag/index-file.test.ts`
Expected: FAIL — visibility vaut `public` (le flag fichier est ignoré).

- [ ] **Step 3: Implémenter la règle OR**

Dans `src/lib/rag/index-file.ts`, `indexSubjectFile`, remplacer L43-45 :

```typescript
  // Confidentiel si le sujet l'est (fail-closed si introuvable) OU si le doc l'est.
  const confidentiel = (subject ? !!subject.confidentiel : true) || !!file.confidentiel
  const visibility: 'public' | 'member' = confidentiel ? 'member' : 'public'
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run src/lib/rag/index-file.test.ts`
Expected: PASS (dont les anciens tests public/confidentiel/fail-closed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rag/index-file.ts src/lib/rag/index-file.test.ts
git commit -m "feat(rag): indexation respecte la confidentialité par document

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: RAG — `retierFile` + `scheduleRetierFile`

**Files:**
- Modify: `src/lib/rag/index-file.ts` (nouvelle fonction `retierFile`)
- Modify: `src/lib/rag/schedule.ts` (nouvelle fonction `scheduleRetierFile`)
- Test: `src/lib/rag/index-file.test.ts`

**Interfaces:**
- Produces:
  - `retierFile(fileId: string, deps?: IndexFileDeps): Promise<void>` — recalcule la visibilité effective et met à jour `rag_chunks` (`source_id=fileId`, `source_type='subject_file'`) **sans ré-extraire ni ré-embarquer**.
  - `scheduleRetierFile(fileId: string): void` — wrapper `after()`.

- [ ] **Step 1: Écrire les tests (échouent)**

Dans `src/lib/rag/index-file.test.ts`, ajouter un `describe` dédié (le mock `service`/`updated` existe déjà en tête de fichier) :

```typescript
import { indexSubjectFile, retierFile } from './index-file'
```
(remplacer l'import existant `import { indexSubjectFile } from './index-file'`).

```typescript
describe('retierFile', () => {
  it('doc confidentiel sur sujet public → met les chunks en member, sans embed', async () => {
    fileRow = { id: 'f1', subject_id: 's1', confidentiel: true }
    subjectRow = { confidentiel: false }
    let embedded = false
    const prov = { embed: async (t: string[]) => { embedded = true; return t.map(() => [0.1]) } }
    await retierFile('f1', { service: service as never, provider: prov as never })
    expect(embedded).toBe(false)
    expect(updated.at(-1)!.vals).toMatchObject({ visibility: 'member', confidentiel: true })
  })
  it('doc public sur sujet public → chunks public', async () => {
    fileRow = { id: 'f1', subject_id: 's1', confidentiel: false }
    subjectRow = { confidentiel: false }
    await retierFile('f1', { service: service as never })
    expect(updated.at(-1)!.vals).toMatchObject({ visibility: 'public', confidentiel: false })
  })
})
```

- [ ] **Step 2: Lancer les tests (échouent)**

Run: `npx vitest run src/lib/rag/index-file.test.ts`
Expected: FAIL — `retierFile` n'existe pas.

- [ ] **Step 3: Implémenter `retierFile`**

Dans `src/lib/rag/index-file.ts`, ajouter (après `syncSubjectFileVisibility`) :

```typescript
/** Re-tier léger des chunks d'un fichier (au toggle de confidentialité) — pas de ré-embed. */
export async function retierFile(fileId: string, deps: IndexFileDeps = {}): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const { data: file } = await service.from('subject_files').select('subject_id,confidentiel').eq('id', fileId).single()
  if (!file) return
  const { data: subject } = await service.from('subjects').select('confidentiel').eq('id', file.subject_id).single()
  const confidentiel = (subject ? !!subject.confidentiel : true) || !!file.confidentiel
  const visibility: 'public' | 'member' = confidentiel ? 'member' : 'public'
  await service.from('rag_chunks').update({ confidentiel, visibility })
    .eq('source_type', 'subject_file').eq('source_id', fileId)
}
```

- [ ] **Step 4: Ajouter `scheduleRetierFile`**

Dans `src/lib/rag/schedule.ts` : ajouter `retierFile` à l'import depuis `./index-file`, puis la fonction :

```typescript
export function scheduleRetierFile(fileId: string): void {
  after(async () => { try { await retierFile(fileId) } catch { /* avale */ } })
}
```

- [ ] **Step 5: Lancer les tests (passent)**

Run: `npx vitest run src/lib/rag/index-file.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rag/index-file.ts src/lib/rag/schedule.ts src/lib/rag/index-file.test.ts
git commit -m "feat(rag): retierFile + scheduleRetierFile (re-tier sans ré-embed)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: RAG — `syncSubjectFileVisibility` par-fichier

**Files:**
- Modify: `src/lib/rag/index-file.ts` (`syncSubjectFileVisibility`, L25-32)
- Modify: `src/lib/rag/index-source.ts` (appel L160-163)
- Test: `src/lib/rag/index-file.test.ts`

**Interfaces:**
- Produces: `syncSubjectFileVisibility(subjectId, vals: { labo: string|null; confidentiel: boolean; is_transversal: boolean }, deps?)` — quand un **sujet** est réindexé, applique `labo`/`is_transversal` en blanket ; visibilité `member` en blanket si le sujet est confidentiel, sinon **par fichier** selon `subject_files.confidentiel`. (La prop `visibility` disparaît de la signature.)

- [ ] **Step 1: Écrire les tests (échouent)**

Dans `src/lib/rag/index-file.test.ts`, ajouter cet import à la ligne d'import de `./index-file` : `syncSubjectFileVisibility`. Puis un `describe` avec un mock local (le service global ne gère pas la lecture liste `subject_files`) :

```typescript
describe('syncSubjectFileVisibility', () => {
  function make(files: Array<{ id: string; confidentiel: boolean }>) {
    const ups: Array<{ vals: Record<string, unknown>; filters: Array<[string, unknown]> }> = []
    const svc = {
      from: (t: string) => ({
        select: () => ({ eq: (_c: string, _v: unknown) => Promise.resolve({ data: t === 'subject_files' ? files : [], error: null }) }),
        update: (vals: Record<string, unknown>) => {
          const filters: Array<[string, unknown]> = []
          const u = { eq: (c: string, v: unknown) => { filters.push([c, v]); return u } }
          ups.push({ vals, filters }); return Object.assign(Promise.resolve({ error: null }), u)
        },
      }),
    }
    return { svc, ups }
  }

  it('sujet confidentiel → blanket member', async () => {
    const { svc, ups } = make([])
    await syncSubjectFileVisibility('s1', { labo: 'paris', confidentiel: true, is_transversal: false }, { service: svc as never })
    expect(ups[0]!.vals).toMatchObject({ visibility: 'member', confidentiel: true })
  })

  it('sujet public → visibilité par fichier (confi reste member)', async () => {
    const { svc, ups } = make([{ id: 'fa', confidentiel: true }, { id: 'fb', confidentiel: false }])
    await syncSubjectFileVisibility('s1', { labo: 'paris', confidentiel: false, is_transversal: false }, { service: svc as never })
    const a = ups.find(u => u.filters.some(f => f[1] === 'fa'))!
    const b = ups.find(u => u.filters.some(f => f[1] === 'fb'))!
    expect(a.vals).toMatchObject({ visibility: 'member', confidentiel: true })
    expect(b.vals).toMatchObject({ visibility: 'public', confidentiel: false })
  })
})
```

- [ ] **Step 2: Lancer les tests (échouent)**

Run: `npx vitest run src/lib/rag/index-file.test.ts`
Expected: FAIL — un sujet public écrase actuellement tous les chunks avec la visibilité du sujet.

- [ ] **Step 3: Réécrire `syncSubjectFileVisibility`**

Dans `src/lib/rag/index-file.ts`, remplacer la fonction (L25-32) :

```typescript
export async function syncSubjectFileVisibility(
  subjectId: string,
  vals: { labo: string | null; confidentiel: boolean; is_transversal: boolean },
  deps: IndexFileDeps = {},
): Promise<void> {
  const service = deps.service ?? (await createServiceClient())
  const base = { labo: vals.labo, is_transversal: vals.is_transversal }
  if (vals.confidentiel) {
    // Sujet confidentiel : tous ses docs sont member, quel que soit leur flag.
    await service.from('rag_chunks').update({ ...base, confidentiel: true, visibility: 'member' })
      .eq('source_type', 'subject_file').eq('metadata->>subject_id', subjectId)
    return
  }
  // Sujet public : la visibilité de chaque doc suit son propre flag.
  const { data: files } = await service.from('subject_files').select('id,confidentiel').eq('subject_id', subjectId)
  for (const f of (files ?? []) as Array<{ id: string; confidentiel: boolean }>) {
    const confidentiel = !!f.confidentiel
    await service.from('rag_chunks').update({ ...base, confidentiel, visibility: confidentiel ? 'member' : 'public' })
      .eq('source_type', 'subject_file').eq('source_id', f.id)
  }
}
```

- [ ] **Step 4: Mettre à jour l'appelant**

Dans `src/lib/rag/index-source.ts` (~L160-163), retirer `visibility` de l'objet passé :

```typescript
    await syncSubjectFileVisibility(id, {
      labo: batch.labo, confidentiel: batch.confidentiel,
      is_transversal: batch.is_transversal,
    }, { service })
```

- [ ] **Step 5: Lancer les tests (passent)**

Run: `npx vitest run src/lib/rag/index-file.test.ts src/lib/rag/index-source.test.ts`
Expected: PASS (le test existant `index-source` « sujet confidentiel » reste vert : branche blanket).

- [ ] **Step 6: Commit**

```bash
git add src/lib/rag/index-file.ts src/lib/rag/index-source.ts src/lib/rag/index-file.test.ts
git commit -m "fix(rag): resync sujet ne clobbe plus la confidentialité par doc

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Route `PATCH` de bascule du statut

**Files:**
- Modify: `src/app/api/subjects/[id]/files/[fileId]/route.ts` (nouvelle export `PATCH`)
- Test: `src/app/api/subjects/[id]/files/[fileId]/route.test.ts`

**Interfaces:**
- Consumes: `scheduleRetierFile` (Task 4).
- Produces: `PATCH /api/subjects/[id]/files/[fileId]` body `{ confidentiel: boolean }` → 200 `{ ok: true, confidentiel }` ; 401 non-membre ; 404 mauvais sujet ; 400 corps invalide.

- [ ] **Step 1: Étendre le mock puis écrire les tests (échouent)**

Dans `src/app/api/subjects/[id]/files/[fileId]/route.test.ts` :

Étendre le mock `@/lib/rag/schedule` :
```typescript
vi.mock('@/lib/rag/schedule', () => ({ scheduleDeleteFileChunks: () => {}, scheduleReindex: () => {}, scheduleRetierFile: () => {} }))
```

Ajouter `update` au mock `from()` (capture des valeurs) — remplacer l'objet retourné par `from` pour inclure :
```typescript
      update: (vals: Record<string, unknown>) => { updated = vals; return { eq: () => Promise.resolve({ error: null }) } },
```
et déclarer près des autres `let` : `let updated: Record<string, unknown> = {}` (réinitialiser `updated = {}` dans `beforeEach`).

Importer `PATCH` : `import { GET, DELETE, PATCH } from './route'`.

Ajouter :
```typescript
const pReq = (b: unknown) => new NextRequest('http://localhost/api/subjects/s1/files/f1', { method: 'PATCH', body: JSON.stringify(b) })

describe('PATCH /api/subjects/[id]/files/[fileId]', () => {
  it('401 si non-membre', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'x'))
    expect((await PATCH(pReq({ confidentiel: true }), params)).status).toBe(401)
  })
  it('400 si confidentiel absent', async () => {
    expect((await PATCH(pReq({}), params)).status).toBe(400)
  })
  it('404 si le fichier appartient à un autre sujet', async () => {
    file = { id: 'f1', subject_id: 'OTHER' }
    expect((await PATCH(pReq({ confidentiel: true }), params)).status).toBe(404)
  })
  it('200 + met à jour confidentiel', async () => {
    const res = await PATCH(pReq({ confidentiel: true }), params)
    expect(res.status).toBe(200)
    expect(updated.confidentiel).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer les tests (échouent)**

Run: `npx vitest run src/app/api/subjects/\[id\]/files/\[fileId\]/route.test.ts`
Expected: FAIL — `PATCH` n'est pas exporté.

- [ ] **Step 3: Implémenter `PATCH`**

Dans `src/app/api/subjects/[id]/files/[fileId]/route.ts`, ajouter l'import et la route. Import (en tête) : ajouter `scheduleRetierFile` à côté de `scheduleDeleteFileChunks`. Puis :

```typescript
export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id, fileId } = await params
  const body = await req.json().catch(() => ({}))
  if (typeof body.confidentiel !== 'boolean') return NextResponse.json({ error: 'confidentiel required' }, { status: 400 })

  const service = await createServiceClient()
  const { data: file } = await service.from('subject_files').select('subject_id').eq('id', fileId).single()
  if (!file || file.subject_id !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await service.from('subject_files').update({ confidentiel: body.confidentiel }).eq('id', fileId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  scheduleRetierFile(fileId)
  return NextResponse.json({ ok: true, confidentiel: body.confidentiel })
}
```

- [ ] **Step 4: Lancer les tests (passent)**

Run: `npx vitest run src/app/api/subjects/\[id\]/files/\[fileId\]/route.test.ts`
Expected: PASS (dont GET/DELETE existants).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/subjects/[id]/files/[fileId]/route.ts" "src/app/api/subjects/[id]/files/[fileId]/route.test.ts"
git commit -m "feat(files): PATCH bascule la confidentialité d'un document

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Filtrage serveur de la liste (visiteur)

**Files:**
- Modify: `src/app/[locale]/[lab]/paper/[id]/page.tsx` (requête `subject_files`, L57)

**Interfaces:**
- Consumes: `subject_files.confidentiel`, `isMember` (déjà en scope L36).
- Produces: la liste `files` passée à `PaperView` exclut les docs confidentiels pour un visiteur.

> Note : composant serveur (pas de test unitaire ici). Vérification = `tsc`/build + navigateur.

- [ ] **Step 1: Construire la requête filtrée**

Dans `src/app/[locale]/[lab]/paper/[id]/page.tsx`, juste avant le `Promise.all` (après `allSubjectsQuery`, ~L46), ajouter :

```typescript
  // Fichiers : le visiteur ne voit pas les docs confidentiels (même sur une fiche publique).
  let filesQuery = service.from('subject_files').select('*').eq('subject_id', id)
  if (!isMember) filesQuery = filesQuery.eq('confidentiel', false)
```

- [ ] **Step 2: Remplacer l'entrée du `Promise.all`**

Remplacer la ligne L57 (`service.from('subject_files')...`) par :

```typescript
    filesQuery.order('created_at', { ascending: true }),
```

- [ ] **Step 3: Vérifier types + build**

Run: `npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add "src/app/[locale]/[lab]/paper/[id]/page.tsx"
git commit -m "feat(paper): masque les docs confidentiels au visiteur

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: UI `FilesPanel` — cadenas + badge + i18n

**Files:**
- Modify: `src/components/paper/FilesPanel.tsx`
- Modify: `messages/en.json`, `messages/fr.json`

**Interfaces:**
- Consumes: `SubjectFile.confidentiel` ; `PATCH /api/subjects/[id]/files/[fileId]` (Task 6).
- Produces: bouton de bascule + indicateur visuel pour les membres.

> Note : composant client (rendu). Vérification = `tsc`/`lint`/build + navigateur.

- [ ] **Step 1: Ajouter les clés i18n**

Dans `messages/en.json`, namespace `paper`, ajouter :
```json
    "makeFileConfidential": "Make confidential",
    "makeFilePublic": "Make public",
    "fileConfidential": "Confidential",
    "updateFailed": "Update failed"
```
Dans `messages/fr.json`, même namespace :
```json
    "makeFileConfidential": "Rendre confidentiel",
    "makeFilePublic": "Rendre public",
    "fileConfidential": "Confidentiel",
    "updateFailed": "Échec de la mise à jour"
```
(Si `updateFailed` existe déjà dans `paper`, ne pas le dupliquer.)

- [ ] **Step 2: Ajouter la fonction de bascule dans le composant**

Dans `src/components/paper/FilesPanel.tsx`, à l'intérieur de `FilesPanel`, ajouter après `confirmDelete` :

```typescript
  async function toggleConfidential(f: SubjectFile) {
    const res = await fetch(`/api/subjects/${subjectId}/files/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confidentiel: !f.confidentiel }),
    })
    if (res.ok) router.refresh()
    else addToast(t('updateFailed'), 'error')
  }
```

- [ ] **Step 3: Afficher le statut + le bouton (membres)**

Dans le rendu de chaque fichier (bloc `{files.map(f => (...))}`), entre le lien de download et le bouton de suppression, insérer (visible seulement aux membres) :

```tsx
              {isMember && (
                <button
                  onClick={() => toggleConfidential(f)}
                  aria-label={f.confidentiel ? t('makeFilePublic') : t('makeFileConfidential')}
                  title={f.confidentiel ? t('fileConfidential') : t('makeFileConfidential')}
                  style={{ flex: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: f.confidentiel ? '#e8b149' : '#8ea4df' }}
                >{f.confidentiel ? '🔒' : '🔓'}</button>
              )}
```

Et pour signaler le statut d'un coup d'œil, ajouter un badge sous le nom quand le doc est confidentiel — après le `<span>` de la taille (`fmtSize`), dans le même bloc `<span style={{ flex: 1, minWidth: 0 }}>` :

```tsx
                  {f.confidentiel && (
                    <span className="font-mono" style={{ marginLeft: 8, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e8b149' }}>{t('fileConfidential')}</span>
                  )}
```

- [ ] **Step 4: Vérifier types, lint, build**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add src/components/paper/FilesPanel.tsx messages/en.json messages/fr.json
git commit -m "feat(paper): bascule confidentiel/public d'un document dans FilesPanel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Vérification globale + STATUS

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Suite complète**

Run: `npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: tous verts, 0 erreur.

- [ ] **Step 2: Noter dans STATUS.md**

Ajouter une puce en tête de « Où on en est » décrivant : visibilité par document (`subject_files.confidentiel`), **migration `014` à appliquer en BDD**, default confidentiel, doc confi invisible au visiteur, re-tier RAG. Mentionner que la vérif navigateur (toggle, download 404 visiteur, badge) reste humaine.

- [ ] **Step 3: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): visibilité par document livrée

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes de déploiement

- ⚠️ **Migration `014_subject_file_confidentiel.sql` à appliquer en BDD** (Supabase) — sinon la colonne `confidentiel` manque et les insert/lectures échouent.
- Non rétroactif côté RAG : les chunks des docs déjà indexés ne changent de tier qu'au prochain toggle, réindexation du sujet, ou re-upload. (Optionnel : `npm run index:rag` si un rafraîchissement global est souhaité.)
- Les **liens Dropbox** restent hors périmètre (pas de visibilité par-lien).
