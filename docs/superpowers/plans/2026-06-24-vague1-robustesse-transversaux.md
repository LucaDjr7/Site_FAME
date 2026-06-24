# Vague 1 — Robustesse + Sujets transversaux — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les bugs 🟠 restants de l'audit (D2/D3) puis livrer la feature « sujets transversaux » (visibilité cross-lab opt-in pour sujets et prompts, publications toujours partagées).

**Architecture:** Deux phases, une seule PR `vague1 → main`. Phase 1 = correctifs ciblés sans migration. Phase 2 = migration additive (`is_transversal`) + requêtes de listing élargies (`.or(...)`, cascade tâches via `sujet_id`) + UI (checkbox + badge). Aucune réintroduction de cloisonnement d'édition : « transversal » ne change QUE la visibilité dans les listes.

**Tech Stack:** Next.js 16.2.9 (App Router, `params` = `Promise`), React 19, TypeScript strict, Supabase (`createServiceClient()` service-role), next-intl, Vitest 3 (env `node`, `include: src/**/*.test.ts`).

**Spec de référence :** `docs/superpowers/specs/2026-06-24-vague1-design.md`. **Audit :** `docs/AUDIT_2026-06-24.md`.

## Global Constraints

Copiées verbatim de la spec §5 (CLAUDE.md / AGENTS.md). Chaque tâche les inclut implicitement :

- **i18n** : zéro chaîne UI hardcodée ; toute clé ajoutée existe dans `messages/en.json` **ET** `messages/fr.json`.
- **DB** : tous les writes via routes `/api/` avec `createServiceClient()` ; `createServiceClient()` **ne porte jamais** les cookies de la requête.
- **Sécurité** : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` server-only, jamais `NEXT_PUBLIC_`. Seuls `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` portent ce préfixe.
- **Routing** : valider le lab slug (`paris` | `montreal`, minuscules) dans chaque handler ; lab invalide → 404 (pages) / 400 (routes API existantes).
- **Next.js 16** : `params` est `Promise<{...}>` → toujours `await params`.
- **Aucune garde `assertLabAccess`** n'est introduite (droits d'édition inchangés ; `requireMember()` suffit). Le type `Lab = 'paris' | 'montreal'` reste **intact**.
- **Gate par tâche** : `npm test` + `npx tsc --noEmit` + `npm run lint` à **0 erreur / 0 warning**.
- **Versioning** : un commit atomique `fix:` / `feat:` par tâche ; ne jamais commiter `.env.local`.

---

## ⚠️ Notes d'exécution (constats d'audit déjà résolus dans le code courant)

L'audit (lecture seule) est partiellement périmé. **Vérifié sur le code courant de la branche `vague1`** :

| Constat audit | État réel | Conséquence dans ce plan |
|---|---|---|
| **F10** keyframes `fameSpin`/`fameSpinRev` manquantes | ✅ présentes (`src/app/globals.css`) ; `Globe.tsx:304-314` les consomme | Pas de fix → **test de garde** (Task 7) |
| **F04** `'use client'` manquant sur `FilterSidebar` | ✅ présent (`FilterSidebar.tsx:1`) | Pas de fix → **test de garde** (Task 7) |
| **F22** `loadAtlas` appelle `draw()` après démontage | ✅ déjà gardé (`Globe.tsx:252` `if (!state.mounted) return`) | Pas de fix → vérifié dans Task 6 |
| **F02** closure périmée dans le `useEffect` de drag | ✅ déjà correct : les handlers mutent `stateRef.current` (identité stable), pas de capture périmée | Pas de fix → vérifié dans Task 6 |
| **F01** lecture de `window` au render | ❌ **réel** (`Globe.tsx:272`) | Fix Task 6 |
| **F6/F7/F8/F5/F21/F06/F05/F07** | ❌ **réels** | Fix Tasks 1-5 |

**Harnais de test — limite assumée :** la suite Vitest est `environment: 'node'` ; **pas** de `@testing-library/react`, **pas** de jsdom. Les correctifs de **composants React** (F21, F06, F05, F07, F01) **ne sont pas testables unitairement** sans ajouter cette infra (hors périmètre Vague 1, scope creep pour 5 petits correctifs). Ils sont donc vérifiés **structurellement** : `tsc` + `lint` + revue de diff + check manuel documenté. Les correctifs **API** (F6, F7, F8, F5) et les **requêtes de listing API** (Phase 2) reçoivent un TDD complet. Cette déviation par rapport à la spec §4 (qui supposait F21/F06 unit-testables via `fetch` mockable) est **explicite et assumée**.

---

# PHASE 1 — ROBUSTESSE

### Task 1: F6 + F7 — PATCH renvoie 404 sur ligne introuvable

**Files:**
- Modify: `src/app/api/subjects/[id]/route.ts:25-26` (PATCH)
- Modify: `src/app/api/tasks/[id]/route.ts:40-41` (PATCH)
- Test (create): `src/app/api/subjects/[id]/route.test.ts`
- Test (create): `src/app/api/tasks/[id]/route.test.ts`

**Interfaces:**
- Consumes : idiome de référence déjà présent dans `src/app/api/prompts/[id]/route.ts:37` — `if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })`.
- Produces : PATCH subjects/tasks → **404** quand `.single()` ne trouve aucune ligne (au lieu de 500).

- [ ] **Step 1: Écrire le test subjects (RED)** — `src/app/api/subjects/[id]/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let singleResult: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve(singleResult) }) }) }),
    }),
  }),
}))

import { PATCH } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/subjects/x', { method: 'PATCH', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris', is_admin: false } })
  singleResult = { data: null, error: null }
})

describe('PATCH /api/subjects/[id]', () => {
  it('renvoie 404 si la ligne est introuvable (PGRST116)', async () => {
    singleResult = { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(404)
  })
  it('renvoie 500 sur autre erreur DB', async () => {
    singleResult = { data: null, error: { code: '08006', message: 'db down' } }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(500)
  })
  it('renvoie 200 en cas de succès', async () => {
    singleResult = { data: { id: 'x', titre: 'x' }, error: null }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(200)
  })
})
```

- [ ] **Step 2: Lancer le test subjects (vérifier l'échec)**

Run: `npx vitest run src/app/api/subjects/\[id\]/route.test.ts`
Expected: FAIL — le cas 404 reçoit 500 (le PGRST116 n'est pas distingué).

- [ ] **Step 3: Implémenter le fix subjects** — `src/app/api/subjects/[id]/route.ts`, remplacer la ligne 26

```ts
  const { data, error } = await service.from('subjects').update(updates).eq('id', id).select().single()
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
```

- [ ] **Step 4: Lancer le test subjects (vérifier le succès)**

Run: `npx vitest run src/app/api/subjects/\[id\]/route.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Écrire le test tasks (RED)** — `src/app/api/tasks/[id]/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let singleResult: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve(singleResult) }) }) }),
    }),
  }),
}))

import { PATCH } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/tasks/x', { method: 'PATCH', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: { user: { id: 'u1' } }, member: { prenom: 'A', nom: 'B', labo: 'paris', is_admin: false } })
  singleResult = { data: null, error: null }
})

// body sans 'statut' → évite le precheck oldStatut (qui appelle .select().eq().single())
describe('PATCH /api/tasks/[id]', () => {
  it('renvoie 404 si la tâche est introuvable (PGRST116)', async () => {
    singleResult = { data: null, error: { code: 'PGRST116', message: 'no rows' } }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(404)
  })
  it('renvoie 500 sur autre erreur DB', async () => {
    singleResult = { data: null, error: { code: '08006', message: 'db down' } }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(500)
  })
  it('renvoie 200 en cas de succès', async () => {
    singleResult = { data: { id: 'x', titre: 'x' }, error: null }
    expect((await PATCH(req({ titre: 'x' }), { params: Promise.resolve({ id: 'x' }) })).status).toBe(200)
  })
})
```

- [ ] **Step 6: Lancer le test tasks (vérifier l'échec)**

Run: `npx vitest run src/app/api/tasks/\[id\]/route.test.ts`
Expected: FAIL — le cas 404 reçoit 500.

- [ ] **Step 7: Implémenter le fix tasks** — `src/app/api/tasks/[id]/route.ts`, remplacer la ligne 41

```ts
  const { data, error } = await service.from('tasks').update(updates).eq('id', id).select().single()
  if (error?.code === 'PGRST116') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
```

(Garder le bloc `task_history` inchangé en dessous.)

- [ ] **Step 8: Lancer la suite complète + gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert, 0 warning.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/subjects/\[id\]/route.ts src/app/api/subjects/\[id\]/route.test.ts src/app/api/tasks/\[id\]/route.ts src/app/api/tasks/\[id\]/route.test.ts
git commit -m "fix(api): PATCH subjects/tasks renvoie 404 sur ligne introuvable (F6, F7)"
```

---

### Task 2: F8 — DELETE dropbox/links renvoie 404 sur 0 suppression

**Files:**
- Modify: `src/app/api/dropbox/links/[id]/route.ts:11-13`
- Test (create): `src/app/api/dropbox/links/[id]/route.test.ts`

**Interfaces:**
- Consumes : idiome de référence dans `src/app/api/prompts/[id]/route.ts:46-48` — `.delete().eq('id', id).select()` puis `if (!data || data.length === 0) return 404`.
- Produces : DELETE → **404** quand aucune ligne supprimée (fin du faux 200).

- [ ] **Step 1: Écrire le test (RED)** — `src/app/api/dropbox/links/[id]/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let deleteResult: { data: unknown; error: unknown } = { data: [], error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ delete: () => ({ eq: () => ({ select: () => Promise.resolve(deleteResult) }) }) }),
  }),
}))

import { DELETE } from './route'

const ctx = { params: Promise.resolve({ id: 'x' }) }
function req() { return new NextRequest('http://localhost/api/dropbox/links/x', { method: 'DELETE' }) }

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris' } })
  deleteResult = { data: [], error: null }
})

describe('DELETE /api/dropbox/links/[id]', () => {
  it('renvoie 404 si aucune ligne supprimée', async () => {
    deleteResult = { data: [], error: null }
    expect((await DELETE(req(), ctx)).status).toBe(404)
  })
  it('renvoie 500 sur erreur DB', async () => {
    deleteResult = { data: null, error: { message: 'db down' } }
    expect((await DELETE(req(), ctx)).status).toBe(500)
  })
  it('renvoie 200 quand une ligne est supprimée', async () => {
    deleteResult = { data: [{ id: 'x' }], error: null }
    expect((await DELETE(req(), ctx)).status).toBe(200)
  })
})
```

- [ ] **Step 2: Lancer le test (vérifier l'échec)**

Run: `npx vitest run src/app/api/dropbox/links/\[id\]/route.test.ts`
Expected: FAIL — le cas 0-suppression reçoit 200.

- [ ] **Step 3: Implémenter le fix** — `src/app/api/dropbox/links/[id]/route.ts`, remplacer le corps après `const service = ...`

```ts
  const service = await createServiceClient()
  const { data, error } = await service.from('dropbox_links').delete().eq('id', id).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
```

- [ ] **Step 4: Lancer le test (vérifier le succès) + gates**

Run: `npx vitest run src/app/api/dropbox/links/\[id\]/route.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS (3/3), 0 warning.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dropbox/links/\[id\]/route.ts src/app/api/dropbox/links/\[id\]/route.test.ts
git commit -m "fix(api): DELETE dropbox/links renvoie 404 sur 0 suppression (F8)"
```

---

### Task 3: F5 — activate propage l'échec de l'activation membre

**Files:**
- Modify: `src/app/api/auth/activate/route.ts:34-41`
- Test (create): `src/app/api/auth/activate/route.test.ts`

**Interfaces:**
- Produces : si la mise à jour `members.activated_at` échoue → **500** (l'activation a réellement échoué). L'échec du `delete` de l'invitation est journalisé mais ne fait pas échouer la requête (l'utilisateur est activé ; l'invitation pendante est du nettoyage).

- [ ] **Step 1: Écrire le test (RED)** — `src/app/api/auth/activate/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// État pilotable par test
let memberUpdateError: unknown = null
let invitationDeleteError: unknown = null

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'invitations') {
        return {
          // chaîne SELECT de validation du token
          select: () => ({ eq: () => ({ gt: () => ({ single: () => Promise.resolve({
            data: { id: 'inv1', member_id: 'm1', members: {} }, error: null,
          }) }) }) }),
          // chaîne DELETE de l'invitation
          delete: () => ({ eq: () => Promise.resolve({ error: invitationDeleteError }) }),
        }
      }
      // table === 'members'
      return { update: () => ({ eq: () => Promise.resolve({ error: memberUpdateError }) }) }
    },
    auth: { admin: { updateUserById: () => Promise.resolve({ error: null }) } },
  }),
}))

import { POST } from './route'

function req() {
  return new NextRequest('http://localhost/api/auth/activate', {
    method: 'POST', body: JSON.stringify({ token: 'tok', password: 'password123' }),
  })
}

beforeEach(() => { memberUpdateError = null; invitationDeleteError = null })

describe('POST /api/auth/activate', () => {
  it('renvoie 500 si la mise à jour du membre échoue', async () => {
    memberUpdateError = { message: 'update failed' }
    expect((await POST(req())).status).toBe(500)
  })
  it('renvoie 200 si tout réussit', async () => {
    expect((await POST(req())).status).toBe(200)
  })
  it('renvoie 200 même si la suppression de l\'invitation échoue (non bloquant)', async () => {
    invitationDeleteError = { message: 'delete failed' }
    expect((await POST(req())).status).toBe(200)
  })
})
```

- [ ] **Step 2: Lancer le test (vérifier l'échec)**

Run: `npx vitest run src/app/api/auth/activate/route.test.ts`
Expected: FAIL — le cas member-update-error reçoit 200 (erreur ignorée).

- [ ] **Step 3: Implémenter le fix** — `src/app/api/auth/activate/route.ts`, remplacer les lignes 34-41

```ts
  // Mark member as activated
  const { error: actErr } = await service.from('members')
    .update({ activated_at: new Date().toISOString() })
    .eq('id', invitation.member_id)
  if (actErr) {
    console.error('Activation member update failed:', actErr)
    return NextResponse.json({ error: 'Activation failed' }, { status: 500 })
  }

  // Delete the invitation (non-blocking cleanup)
  const { error: delErr } = await service.from('invitations').delete().eq('id', invitation.id)
  if (delErr) console.error('Invitation cleanup failed:', delErr)

  return NextResponse.json({ ok: true })
```

- [ ] **Step 4: Lancer le test (vérifier le succès) + gates**

Run: `npx vitest run src/app/api/auth/activate/route.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS (3/3), 0 warning.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/activate/route.ts src/app/api/auth/activate/route.test.ts
git commit -m "fix(api): activate propage l'échec d'activation membre, log cleanup invitation (F5)"
```

---

### Task 4: F21 + F06 — garder `res.ok` avant action optimiste

**Files:**
- Modify: `src/components/prompts/PromptCard.tsx:72-76` (`handleDelete`)
- Modify: `src/components/publications/PublicationList.tsx:94-95` (`load`)

**Vérification :** structurelle (pas de harnais DOM — voir Notes d'exécution). `tsc` + `lint` + revue de diff + check manuel.

- [ ] **Step 1: Fix F21** — `PromptCard.tsx`, remplacer `handleDelete` (lignes 72-76)

```ts
  async function handleDelete() {
    setConfirmOpen(false)
    const res = await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(prompt.id)
  }
```

- [ ] **Step 2: Fix F06** — `PublicationList.tsx`, remplacer les lignes 94-95 dans `load()`

```ts
        const r = await fetch(`/api/publications?lab=${lab}`)
        if (!r.ok) throw new Error('fetch failed')
        const data: Publication[] = await r.json()
```

(Le `catch` existant (lignes 97-98) absorbe l'erreur → `publications` reste `[]`, pas de crash de parsing sur un body d'erreur.)

- [ ] **Step 3: Gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert (suite inchangée), 0 warning.

- [ ] **Step 4: Check manuel documenté**

Vérifier dans le diff : (a) `onDeleted` n'est appelé que sous `if (res.ok)` ; (b) `r.json()` n'est atteint qu'après `r.ok`. Aucun autre chemin ne contourne ces gardes.

- [ ] **Step 5: Commit**

```bash
git add src/components/prompts/PromptCard.tsx src/components/publications/PublicationList.tsx
git commit -m "fix(ui): garder res.ok avant suppression optimiste / parsing (F21, F06)"
```

---

### Task 5: F05 + F07 — feedback d'erreur sur les fetch silencieux

**Files:**
- Modify: `src/components/paper/CommentsPanel.tsx` (imports + `addComment` + `remove`)
- Modify: `src/components/admin/AdminProposalsClient.tsx` (`load`, `decide`, `convert`)
- Modify: `messages/en.json`, `messages/fr.json` (clé `comments.error`)

**Vérification :** structurelle (pas de harnais DOM). `tsc` + `lint` + revue de diff. La clé i18n est ajoutée dans les **deux** fichiers (Global Constraint).

**Interfaces :**
- `comments.error` : nouvelle clé i18n (toast d'échec de commentaire). `admin.actionError` existe **déjà** (réutilisée pour F07).

- [ ] **Step 1: Ajouter la clé i18n `comments.error`** — dans `messages/en.json`, objet `comments`, ajouter :

```json
    "error": "Action failed. Please try again."
```

Dans `messages/fr.json`, objet `comments`, ajouter :

```json
    "error": "Action échouée. Réessayez."
```

- [ ] **Step 2: Fix F05** — `CommentsPanel.tsx`. Ajouter l'import toast après la ligne 4 :

```ts
import { useToast } from '@/components/ui/Toast'
```

Dans le composant, après `const tc = useTranslations('comments')` (ligne 17) :

```ts
  const { addToast } = useToast()
```

Remplacer `addComment` (lignes 24-40) :

```ts
  async function addComment() {
    const text = draft.trim()
    if (!text || posting) return
    if (!isMember && (!firstName.trim() || !lastName.trim())) return
    setPosting(true)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sujet_id: subjectId, texte: text, visitor_prenom: firstName, visitor_nom: lastName }),
      })
      if (!res.ok) throw new Error('post failed')
      const created: Comment = await res.json()
      setComments(prev => [...prev, created])
      setDraft('')
    } catch {
      addToast(tc('error'), 'error')
    } finally {
      setPosting(false)
    }
  }
```

Remplacer `remove` (lignes 42-45) :

```ts
  async function remove(id: string) {
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setComments(prev => prev.filter(c => c.id !== id))
    } catch {
      addToast(tc('error'), 'error')
    }
  }
```

- [ ] **Step 3: Fix F07** — `AdminProposalsClient.tsx`. Remplacer `load` (lignes 44-48) :

```ts
  const load = useCallback(() => {
    fetch(`/api/proposals?lab=${lab}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setProposals(data) })
      .catch(() => addToast(t('actionError'), 'error'))
  }, [lab, t, addToast])
```

Remplacer `decide` (lignes 54-66) :

```ts
  async function decide(id: string, statut: 'accepted' | 'rejected') {
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut, commentaire_admin: comments[id] ?? null }),
      })
      if (res.ok) { addToast(t('decisionSaved'), 'success'); load() }
      else { addToast(t('actionError'), 'error') }
    } catch {
      addToast(t('actionError'), 'error')
    }
  }
```

Remplacer `convert` (lignes 68-77) :

```ts
  async function convert(id: string) {
    try {
      const res = await fetch(`/api/proposals/${id}/convert`, { method: 'POST' })
      if (res.ok) {
        const { subject_id } = await res.json()
        addToast(t('converted'), 'success')
        router.push(`/${locale}/${lab}/paper/${subject_id}`)
      } else {
        addToast(t('actionError'), 'error')
      }
    } catch {
      addToast(t('actionError'), 'error')
    }
  }
```

- [ ] **Step 4: Gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert, 0 warning. (Attention : `useCallback` de `load` dépend désormais de `t` et `addToast` — vérifier que `react-hooks/exhaustive-deps` ne lève pas ; les deux sont stables.)

- [ ] **Step 5: Commit**

```bash
git add src/components/paper/CommentsPanel.tsx src/components/admin/AdminProposalsClient.tsx messages/en.json messages/fr.json
git commit -m "fix(ui): feedback d'erreur sur fetch commentaires/propositions (F05, F07)"
```

---

### Task 6: F01 — Globe ne lit plus `window` au render (hydratation)

**Files:**
- Modify: `src/components/globe/Globe.tsx` (imports ligne 2 + ligne 272)

**Vérification :** structurelle + manuelle. **F02 et F22 sont déjà corrects** (voir Notes d'exécution) — cette tâche les confirme sans les modifier.

- [ ] **Step 1: Fix F01** — `Globe.tsx`. Ligne 2, ajouter `useState` à l'import :

```ts
import { useEffect, useRef, useState } from 'react'
```

Remplacer la ligne 272 :

```ts
  const size = typeof window !== 'undefined' ? computeSize() : 400
```

par :

```ts
  const [size, setSize] = useState(400)
  useEffect(() => { setSize(computeSize()) }, [])
```

Rationale : SSR et premier render client valent tous deux `400` → plus de mismatch d'hydratation. L'effet ajuste la taille du conteneur côté client après le montage. Le canvas est dimensionné indépendamment par `setupCanvas()` (impératif, via `stateRef`) — non affecté.

- [ ] **Step 2: Confirmer F02 / F22 (lecture seule, aucune modification)**

Vérifier et noter dans le commit body :
- F22 : `Globe.tsx` `loadAtlas` contient `if (!state.mounted) return` avant `draw()` → déjà gardé.
- F02 : les handlers de drag (`onPointerDown/Move/Up`) mutent `state` = `stateRef.current` (identité stable capturée une fois) → pas de closure périmée ; le `useEffect([])` est intentionnel.

- [ ] **Step 3: Gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert, 0 warning.

- [ ] **Step 4: Check manuel documenté**

`npm run dev`, ouvrir `/en` : le globe s'affiche sans warning d'hydratation en console, tourne, est draggable, les pins se positionnent.

- [ ] **Step 5: Commit**

```bash
git add src/components/globe/Globe.tsx
git commit -m "fix(ui): Globe initialise sa taille côté client, fin du risque d'hydratation (F01)"
```

---

### Task 7: F10 + F04 — tests de garde des constats déjà résolus

**Files:**
- Test (create): `src/regression-guards.test.ts`

**Rationale :** F10 (keyframes) et F04 (`'use client'`) sont **déjà** présents dans le code. Plutôt qu'un fix inutile, on pose un **test de garde** qui échouera si une régression future les supprime.

**Interfaces :**
- Produces : test asserant (a) `globals.css` contient `@keyframes fameSpin` et `@keyframes fameSpinRev` ; (b) `FilterSidebar.tsx` commence par `'use client'`.

- [ ] **Step 1: Écrire le test de garde** — `src/regression-guards.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
}

describe('garde-fous de régression Vague 1', () => {
  it('globals.css définit les keyframes du globe (F10)', () => {
    const css = read('./app/globals.css')
    expect(css).toMatch(/@keyframes\s+fameSpin\b/)
    expect(css).toMatch(/@keyframes\s+fameSpinRev\b/)
  })
  it('FilterSidebar est un composant client (F04)', () => {
    const src = read('./components/lab/FilterSidebar.tsx')
    expect(src.trimStart().startsWith("'use client'")).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer le test (vérifier le succès immédiat)**

Run: `npx vitest run src/regression-guards.test.ts`
Expected: PASS (2/2) — confirme que F10 et F04 sont déjà satisfaits. (Si un test échoue, le constat est réellement non résolu : appliquer le fix correspondant — ajouter les keyframes / la directive — avant de continuer.)

- [ ] **Step 3: Gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert, 0 warning.

- [ ] **Step 4: Commit**

```bash
git add src/regression-guards.test.ts
git commit -m "test: gardes de régression keyframes globe + use client FilterSidebar (F10, F04)"
```

---

# PHASE 2 — SUJETS TRANSVERSAUX

> **Ordre impératif :** la migration + les types (Task 8) viennent en premier. Phase 2 réécrit `subjects/[id]` et `tasks/[id]` PATCH déjà corrigés en Phase 1 → l'ordre évite les conflits.

### Task 8: Migration + types `is_transversal`

**Files:**
- Create: `supabase/migrations/004_transversal.sql`
- Modify: `src/types/index.ts` (interfaces `Subject` et `Prompt`)

**Interfaces:**
- Produces : colonnes `subjects.is_transversal` et `prompts.is_transversal` (`boolean NOT NULL DEFAULT false`) ; champ TS `is_transversal: boolean` sur `Subject` et `Prompt`. **Aucune** colonne sur `publications` (toujours partagées).

- [ ] **Step 1: Créer la migration** — `supabase/migrations/004_transversal.sql`

```sql
-- Vague 1 — feature « sujets transversaux ».
-- Additive, réversible, défaut false (comportement actuel préservé).
-- Un sujet/prompt transversal est VISIBLE dans les deux labos (visibilité, pas droits).
-- publications : aucune colonne — toujours partagées (le filtre labo est retiré au listing).

ALTER TABLE subjects ADD COLUMN is_transversal boolean NOT NULL DEFAULT false;
ALTER TABLE prompts  ADD COLUMN is_transversal boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Mettre à jour les types** — `src/types/index.ts`. Dans `export interface Subject`, ajouter après `ordre: number` :

```ts
  is_transversal: boolean
```

Dans `export interface Prompt`, ajouter après `texte: string` :

```ts
  is_transversal: boolean
```

- [ ] **Step 3: Appliquer la migration (environnement de dev)**

Run (l'utilisateur applique la migration sur sa BDD Supabase — étape manuelle si pas de CLI locale ; sinon `supabase db push` / exécution du SQL dans l'éditeur Supabase).
Expected: colonnes créées, `default false` sur l'existant.

> ⚠️ Si la migration ne peut pas être appliquée automatiquement dans cet environnement, le noter et signaler à l'utilisateur : les tests unitaires (mocks) passent sans BDD, mais le runtime exige la colonne.

- [ ] **Step 4: Gates (compilation des types)**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur (le champ ajouté ne casse rien ; les `select('*')` le récupèrent au runtime).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004_transversal.sql src/types/index.ts
git commit -m "feat(db): colonne is_transversal sur subjects/prompts + types (Vague 1 Phase 2)"
```

---

### Task 9: Écriture du flag `is_transversal` (POST/PATCH)

**Files:**
- Modify: `src/app/api/subjects/route.ts:29-30,50-51` (POST — whitelist + insert)
- Modify: `src/app/api/subjects/[id]/route.ts:19` (PATCH — `allowed`)
- Modify: `src/app/api/prompts/[id]/route.ts:24-26` (PATCH — ajout du champ)
- Test (modify): `src/app/api/subjects/[id]/route.test.ts` (de Task 1)
- Test (modify): `src/app/api/prompts/[id]/route.test.ts` (créer si absent)

**Interfaces:**
- Consumes : routes PATCH déjà corrigées (Task 1) ; idiome `prompts` PATCH (Task 1 réf).
- Produces : POST `/api/subjects` et PATCH subjects/prompts persistent `is_transversal`. Aucune garde de droits ajoutée (`requireMember()` suffit).

- [ ] **Step 1: Étendre le test subjects PATCH (RED)** — `src/app/api/subjects/[id]/route.test.ts`, capturer le payload d'update. Remplacer le mock supabase par une version qui capture `updates`, et ajouter un cas :

```ts
let updateVals: Record<string, unknown> = {}
let singleResult: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      update: (vals: Record<string, unknown>) => { updateVals = vals; return {
        eq: () => ({ select: () => ({ single: () => Promise.resolve(singleResult) }) }) } },
    }),
  }),
}))
```

Ajouter dans le `describe` :

```ts
  it('whiteliste is_transversal dans l\'update', async () => {
    singleResult = { data: { id: 'x', is_transversal: true }, error: null }
    await PATCH(req({ is_transversal: true }), { params: Promise.resolve({ id: 'x' }) })
    expect(updateVals.is_transversal).toBe(true)
  })
```

(Adapter le `beforeEach` pour réinitialiser `updateVals = {}` et `singleResult`.)

- [ ] **Step 2: Lancer (vérifier l'échec)**

Run: `npx vitest run src/app/api/subjects/\[id\]/route.test.ts`
Expected: FAIL — `is_transversal` absent de `updateVals` (pas dans `allowed`).

- [ ] **Step 3: Fix subjects PATCH** — `subjects/[id]/route.ts` ligne 19, ajouter `'is_transversal'` à `allowed` :

```ts
  const allowed = ['titre', 'kicker', 'statut', 'difficulte', 'context', 'method', 'results', 'keywords', 'auteurs', 'dimensions', 'is_transversal']
```

- [ ] **Step 4: Fix subjects POST** — `subjects/route.ts`. Ligne 29-30, ajouter `is_transversal = false` à la déstructuration :

```ts
  const { labo, titre, kicker = '', statut = 'active', difficulte = 'intermediate',
    context = '', method = '', results = '', keywords = [], auteurs = [], dimensions,
    is_transversal = false } = body
```

Ligne 50-51, ajouter au payload `insert` :

```ts
    .insert({ labo, titre, kicker, statut, difficulte, context, method, results, keywords, auteurs,
      dimensions: dimensions ?? { method: '', data: '', theory: '', writing: '' }, ordre,
      is_transversal: !!is_transversal })
```

- [ ] **Step 5: Lancer subjects (vérifier le succès)**

Run: `npx vitest run src/app/api/subjects/\[id\]/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Test prompts PATCH (RED)** — `src/app/api/prompts/[id]/route.test.ts` (créer)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let updateVals: Record<string, unknown> = {}
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      update: (vals: Record<string, unknown>) => { updateVals = vals; return {
        eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'x', is_transversal: true }, error: null }) }) }) } },
    }),
  }),
}))

import { PATCH } from './route'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/prompts/x', { method: 'PATCH', body: JSON.stringify(body) })
}

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris' } })
  updateVals = {}
})

describe('PATCH /api/prompts/[id] is_transversal', () => {
  it('persiste is_transversal=true', async () => {
    await PATCH(req({ is_transversal: true }), { params: Promise.resolve({ id: 'x' }) })
    expect(updateVals.is_transversal).toBe(true)
  })
  it('persiste is_transversal=false (coercition booléenne)', async () => {
    await PATCH(req({ is_transversal: 0 }), { params: Promise.resolve({ id: 'x' }) })
    expect(updateVals.is_transversal).toBe(false)
  })
})
```

- [ ] **Step 7: Lancer (vérifier l'échec)**

Run: `npx vitest run src/app/api/prompts/\[id\]/route.test.ts`
Expected: FAIL — `is_transversal` non géré (et `updates` vide → 400, donc `update` jamais appelé).

- [ ] **Step 8: Fix prompts PATCH** — `prompts/[id]/route.ts`, après le bloc `texte` (ligne 24-26), ajouter :

```ts
  if ('is_transversal' in body) {
    updates.is_transversal = !!body.is_transversal
  }
```

- [ ] **Step 9: Lancer prompts (vérifier le succès) + suite + gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert, 0 warning.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/subjects/route.ts src/app/api/subjects/\[id\]/route.ts src/app/api/subjects/\[id\]/route.test.ts src/app/api/prompts/\[id\]/route.ts src/app/api/prompts/\[id\]/route.test.ts
git commit -m "feat(api): écriture du flag is_transversal (POST/PATCH subjects, PATCH prompts)"
```

---

### Task 10: Requêtes de listing transversales + cascade tâches

**Files:**
- Modify: `src/app/api/prompts/route.ts:14-18` (GET — `.or`)
- Modify: `src/app/api/publications/route.ts:12-16` (GET — retrait filtre labo)
- Modify: `src/app/[locale]/[lab]/page.tsx:17` (sujets — `.or`)
- Modify: `src/app/[locale]/[lab]/tasks/page.tsx:17-24` (sujets `.or` + cascade tâches `.in`)
- Test (create): `src/app/api/prompts/route.test.ts`
- Test (create): `src/app/api/publications/route.test.ts`

**Vérification :** TDD pour les deux GET API ; **structurelle** pour les RSC pages (`lab/page.tsx`, `tasks/page.tsx`) — unit-tester un Server Component async produisant du JSX est à haute friction / faible valeur ; vérifié par `tsc` + revue de diff + check manuel.

**Interfaces:**
- Produces : prompts GET et listing sujets renvoient `labo == lab` **OU** `is_transversal == true` ; publications GET renvoie tout (plus de filtre `labo`) ; tâches dérivées des sujets visibles via `.in('sujet_id', visibleSubjectIds)` (cascade).

- [ ] **Step 1: Test prompts GET (RED)** — `src/app/api/prompts/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

const orCalls: string[] = []
const eqCalls: [string, unknown][] = []
vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    select: () => chain,
    eq: (c: string, v: unknown) => { eqCalls.push([c, v]); return chain },
    or: (s: string) => { orCalls.push(s); return chain },
    order: () => Promise.resolve({ data: [], error: null }),
  })
  return { createServiceClient: async () => ({ from: () => chain }) }
})

import { GET } from './route'

beforeEach(() => {
  requireMember.mockReset()
  requireMember.mockResolvedValue({ session: {}, member: { labo: 'paris' } })
  orCalls.length = 0; eqCalls.length = 0
})

describe('GET /api/prompts', () => {
  it('inclut les prompts transversaux via .or', async () => {
    const res = await GET(new NextRequest('http://localhost/api/prompts?lab=paris'))
    expect(res.status).toBe(200)
    expect(orCalls).toContain('labo.eq.paris,is_transversal.eq.true')
    expect(eqCalls.find(([c]) => c === 'labo')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Lancer (vérifier l'échec)**

Run: `npx vitest run src/app/api/prompts/route.test.ts`
Expected: FAIL — utilise encore `.eq('labo', ...)`.

- [ ] **Step 3: Fix prompts GET** — `prompts/route.ts`, remplacer lignes 14-18 :

```ts
  const { data, error } = await service
    .from('prompts')
    .or(`labo.eq.${lab},is_transversal.eq.true`)
    .order('created_at', { ascending: false })
```

(Le `.select('*')` est implicite avec `.or` ? Non — garder `.select('*')` avant `.or` :)

```ts
  const { data, error } = await service
    .from('prompts')
    .select('*')
    .or(`labo.eq.${lab},is_transversal.eq.true`)
    .order('created_at', { ascending: false })
```

- [ ] **Step 4: Test publications GET (RED)** — `src/app/api/publications/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const eqCalls: [string, unknown][] = []
vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {}
  Object.assign(chain, {
    select: () => chain,
    eq: (c: string, v: unknown) => { eqCalls.push([c, v]); return chain },
    order: () => Promise.resolve({ data: [], error: null }),
  })
  return { createServiceClient: async () => ({ from: () => chain }) }
})

import { GET } from './route'

beforeEach(() => { eqCalls.length = 0 })

describe('GET /api/publications', () => {
  it('ne filtre plus par labo (toujours partagées)', async () => {
    const res = await GET(new NextRequest('http://localhost/api/publications?lab=paris'))
    expect(res.status).toBe(200)
    expect(eqCalls.find(([c]) => c === 'labo')).toBeUndefined()
  })
  it('valide toujours le lab slug (400 si invalide)', async () => {
    const res = await GET(new NextRequest('http://localhost/api/publications?lab=tokyo'))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 5: Lancer (vérifier l'échec)**

Run: `npx vitest run src/app/api/publications/route.test.ts`
Expected: FAIL — `.eq('labo', lab)` toujours présent.

- [ ] **Step 6: Fix publications GET** — `publications/route.ts`, remplacer lignes 12-16 (garder la validation lab lignes 9-10) :

```ts
  const { data, error } = await service
    .from('publications')
    .select('*')
    .order('annee', { ascending: false })
```

- [ ] **Step 7: Lancer les deux tests (vérifier le succès)**

Run: `npx vitest run src/app/api/prompts/route.test.ts src/app/api/publications/route.test.ts`
Expected: PASS.

- [ ] **Step 8: Fix listing sujets (lab page)** — `src/app/[locale]/[lab]/page.tsx`, remplacer ligne 17 :

```ts
    service.from('subjects').select('*').or(`labo.eq.${lab},is_transversal.eq.true`).order('ordre', { ascending: true }),
```

- [ ] **Step 9: Fix listing sujets + cascade tâches (tasks page)** — `src/app/[locale]/[lab]/tasks/page.tsx`, remplacer le bloc lignes 16-24 :

```ts
  const service = await createServiceClient()
  const [{ data: subjects }, { data: members }, session] = await Promise.all([
    service.from('subjects').select('*').or(`labo.eq.${lab},is_transversal.eq.true`).order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
    getSession(),
  ])

  // Cascade : les tâches visibles sont celles rattachées aux sujets visibles
  // (sujets du labo + sujets transversaux). Un sujet transversal partage donc ses tâches.
  const visibleSubjectIds = (subjects ?? []).map(s => s.id)
  const { data: tasksRaw } = visibleSubjectIds.length > 0
    ? await service.from('tasks')
        .select('*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)')
        .in('sujet_id', visibleSubjectIds)
        .order('date_creation', { ascending: false })
    : { data: [] }
```

> Note : les tâches sans `sujet_id` (orphelines) n'apparaissent plus. Dans ce modèle, toute tâche appartient à un sujet → conforme. À confirmer au check manuel (Step 11).

- [ ] **Step 10: Gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert, 0 warning. (`subjects` est typé via le retour du client ; si `s` est `any`/untyped, garder `(subjects ?? []).map((s: { id: string }) => s.id)` — vérifier le diagnostic `tsc`.)

- [ ] **Step 11: Check manuel documenté**

Avec la migration appliquée et un sujet marqué transversal côté Paris : il apparaît dans la grille `/en/paris` ET `/en/montreal` ; ses tâches apparaissent dans le kanban des deux labos ; les publications sont identiques sur les deux labos ; un prompt transversal apparaît dans les deux.

- [ ] **Step 12: Commit**

```bash
git add src/app/api/prompts/route.ts src/app/api/prompts/route.test.ts src/app/api/publications/route.ts src/app/api/publications/route.test.ts "src/app/[locale]/[lab]/page.tsx" "src/app/[locale]/[lab]/tasks/page.tsx"
git commit -m "feat: listing transversal (sujets/prompts .or, publications partagées, cascade tâches)"
```

---

### Task 11: Clés i18n (badge + checkbox)

**Files:**
- Modify: `messages/en.json` (namespaces `lab`, `prompts`)
- Modify: `messages/fr.json` (namespaces `lab`, `prompts`)

**Interfaces:**
- Produces : `lab.transversalLabel`, `lab.transversalBadge`, `prompts.transversalLabel`, `prompts.transversalBadge` — présentes dans **les deux** fichiers (Global Constraint i18n).

- [ ] **Step 1: Ajouter les clés EN** — `messages/en.json`. Dans l'objet `lab`, ajouter :

```json
  "transversalLabel": "Transversal — visible in both labs",
  "transversalBadge": "Transversal",
```

Dans l'objet `prompts`, ajouter :

```json
  "transversalLabel": "Transversal — visible in both labs",
  "transversalBadge": "Transversal",
```

- [ ] **Step 2: Ajouter les clés FR** — `messages/fr.json`. Dans l'objet `lab`, ajouter :

```json
  "transversalLabel": "Transversal — visible dans les deux labos",
  "transversalBadge": "Transversal",
```

Dans l'objet `prompts`, ajouter :

```json
  "transversalLabel": "Transversal — visible dans les deux labos",
  "transversalBadge": "Transversal",
```

- [ ] **Step 3: Gates (JSON valide + build i18n)**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur (JSON bien formé ; pas de virgule finale).

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/fr.json
git commit -m "feat(i18n): clés transversal (label checkbox + badge) EN/FR"
```

---

### Task 12: UI sujets — checkbox modale + badge carte

**Files:**
- Modify: `src/components/lab/AddSubjectModal.tsx` (state + checkbox + POST body)
- Modify: `src/components/lab/SubjectCard.tsx` (prop + badge)
- Modify: `src/components/lab/SubjectGrid.tsx:417-419` (passer `transversalLabel`)

**Vérification :** structurelle (pas de harnais DOM). `tsc` + `lint` + check manuel.

**Interfaces:**
- Consumes : clé `lab.transversalLabel` / `lab.transversalBadge` (Task 11) ; `subjects` POST acceptant `is_transversal` (Task 9).
- Produces : `SubjectCard` reçoit `transversalLabel?: string` et affiche un badge quand `subject.is_transversal`.

- [ ] **Step 1: AddSubjectModal — state** — après `const [context, setContext] = useState('')` (ligne 53) :

```ts
  const [isTransversal, setIsTransversal] = useState(false)
```

Dans `reset()` (après `setContext('')`) :

```ts
    setIsTransversal(false)
```

- [ ] **Step 2: AddSubjectModal — POST body** — dans `handleSubmit`, ajouter au `body` (après `auteurs: ...`) :

```ts
        is_transversal: isTransversal,
```

- [ ] **Step 3: AddSubjectModal — checkbox UI** — avant le bloc `{/* Error */}` (ligne 229), insérer :

```tsx
        {/* Transversal */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', ...labelStyle, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
            <input
              type="checkbox"
              checked={isTransversal}
              onChange={e => setIsTransversal(e.target.checked)}
            />
            {t('transversalLabel')}
          </label>
        </div>
```

- [ ] **Step 4: SubjectCard — prop + badge** — ajouter `transversalLabel?: string` au type `Props` (après `doneLabel: string`) et au destructuring du composant. Dans la barre de statut (après le `<span>` du kicker, avant la fermeture du div ligne 143), ajouter :

```tsx
            {subject.is_transversal && transversalLabel && (
              <span style={{
                marginLeft: 'auto',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 6.5,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#1e9b7e',
                background: 'rgba(30,155,126,0.12)',
                border: '1px solid rgba(30,155,126,0.3)',
                borderRadius: 10,
                padding: '1px 5px',
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
              }}>
                {transversalLabel}
              </span>
            )}
```

- [ ] **Step 5: SubjectGrid — passer le label** — dans le `<SubjectCard ... />` (lignes 412-421), ajouter la prop :

```tsx
                      transversalLabel={t('transversalBadge')}
```

- [ ] **Step 6: Gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert, 0 warning.

- [ ] **Step 7: Check manuel documenté**

`/en/paris` en mode édition → « Add subject » → cocher Transversal → créer ; la carte affiche le badge « Transversal » et apparaît aussi sur `/en/montreal`.

- [ ] **Step 8: Commit**

```bash
git add src/components/lab/AddSubjectModal.tsx src/components/lab/SubjectCard.tsx src/components/lab/SubjectGrid.tsx
git commit -m "feat(ui): checkbox transversal (modale sujet) + badge sur la carte"
```

---

### Task 13: UI prompts — checkbox édition + badge carte

**Files:**
- Modify: `src/components/prompts/PromptCard.tsx` (state édition + checkbox + PATCH body + badge vue)

**Vérification :** structurelle (pas de harnais DOM). `tsc` + `lint` + check manuel.

**Interfaces:**
- Consumes : clé `prompts.transversalLabel` / `prompts.transversalBadge` (Task 11) ; PATCH prompts acceptant `is_transversal` (Task 9).
- Produces : édition d'un prompt → toggle transversal persisté ; badge en vue quand `prompt.is_transversal`.

- [ ] **Step 1: State d'édition** — après `const [editTexte, setEditTexte] = useState(prompt.texte)` (ligne 34) :

```ts
  const [editTransversal, setEditTransversal] = useState(prompt.is_transversal)
```

Dans `startEdit()` (après `setEditTexte(prompt.texte)`) :

```ts
    setEditTransversal(prompt.is_transversal)
```

- [ ] **Step 2: PATCH body** — dans `handleSave`, étendre le body :

```ts
        body: JSON.stringify({ titre: editTitre, type_cible: editTypeCible, texte: editTexte, is_transversal: editTransversal }),
```

- [ ] **Step 3: Checkbox en édition** — dans le bloc d'édition, juste avant la rangée des boutons cancel/save (avant `<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>`, ligne 167), insérer :

```tsx
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#5a6486' }}>
              <input type="checkbox" checked={editTransversal} onChange={e => setEditTransversal(e.target.checked)} />
              {t('transversalLabel')}
            </label>
```

- [ ] **Step 4: Badge en vue** — dans l'en-tête de la carte (vue), à côté du badge de type, après la fermeture du `</div>` du target badge (juste avant le `<h3>` titre, ligne 262), insérer :

```tsx
            {prompt.is_transversal && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginLeft: 7,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#1e9b7e',
                background: 'rgba(30,155,126,0.08)',
                border: '1px solid rgba(30,155,126,0.2)',
                borderRadius: 20,
                padding: '4px 9px',
              }}>
                {t('transversalBadge')}
              </span>
            )}
```

- [ ] **Step 5: Gates**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tout vert, 0 warning.

- [ ] **Step 6: Check manuel documenté**

`/en/paris/prompts` → éditer un prompt → cocher Transversal → sauver ; le badge « Transversal » s'affiche et le prompt apparaît aussi sur `/en/montreal/prompts`.

- [ ] **Step 7: Commit**

```bash
git add src/components/prompts/PromptCard.tsx
git commit -m "feat(ui): toggle transversal (édition prompt) + badge sur la carte"
```

---

## Clôture de vague (après Task 13)

- [ ] Mettre à jour `docs/STATUS.md` (section Vague 1 : robustesse + transversaux livrés).
- [ ] Revue finale whole-branch (Opus 4.8) sur `git merge-base main HEAD..HEAD`.
- [ ] `superpowers:finishing-a-development-branch` → PR `vague1 → main`.

---

## Self-Review (writing-plans)

**1. Couverture de la spec :**
- §2 Phase 1 : F6/F7 (Task 1), F8 (Task 2), F5 (Task 3), F21/F06 (Task 4), F05/F07 (Task 5), F01 (Task 6), F10/F04/F22/F02 (Tasks 6-7, vérifiés/gardés — déjà résolus). ✅ Tous couverts.
- §3 Phase 2 : migration (Task 8), types (Task 8), écriture flag (Task 9), listing + cascade (Task 10), i18n (Task 11), UI sujets (Task 12), UI prompts (Task 13). ✅
- §4 stratégie de test : TDD API (Tasks 1-3, 9-10) ; déviation composants documentée (Notes d'exécution). ✅
- §5 contraintes : reportées en Global Constraints. ✅

**2. Placeholders :** aucun « TBD »/« handle errors » — chaque step porte le code réel. Le seul point manuel (application migration BDD) est explicitement signalé comme étape utilisateur.

**3. Cohérence des types :** `is_transversal: boolean` cohérent (types Task 8 → API Task 9 → UI Tasks 12-13) ; `.or(\`labo.eq.${lab},is_transversal.eq.true\`)` identique sur prompts GET / lab page / tasks page ; `transversalLabel`/`transversalBadge` cohérents entre i18n (Task 11) et consommateurs (Tasks 12-13).

**Déviations assumées à signaler à l'exécution :** (a) F10/F04/F22/F02 déjà résolus → tests de garde au lieu de fixes ; (b) pas de harnais DOM → 5 correctifs React vérifiés structurellement, pas en unit-test ; (c) application de la migration 004 = étape manuelle utilisateur.
