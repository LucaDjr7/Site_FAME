# Vague 3 — Durcissement sécurité / config / CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solder le reste du domaine D1 (hors cross-lab, won't-fix) et tout D7 — bornes & rate-limit sur soumissions publiques, restriction du `select` public des propositions, complexité mot de passe, guards env, headers HTTP, `.env.example`, `requireAdmin` sur le layout admin, `seed-admin` paramétré — puis poser la **CI GitHub Actions** et activer `noUncheckedIndexedAccess`.

**Architecture:** Branche `vague3`, PR `vague3 → main`. Routes API → TDD complet (mocks service-role déjà en place dans la suite). `next.config.ts`/`.env.example`/CI/tsconfig → testables partiellement + structurel. **Aucune** garde `assertLabAccess` réintroduite (constats cross-lab = won't-fix, mémoire `b5-cross-lab-pas-isolation`).

**Tech Stack:** Next.js 16.2.9, React 19, TypeScript strict, Supabase service-role, Vitest 3 (env `node`), GitHub Actions.

**Spec de référence :** `docs/superpowers/specs/2026-06-25-vagues-2-4-design.md`. **Audit brut :** `docs/audit-raw/D1-securite.md`, `docs/audit-raw/D7-config-deploy.md`, D4 (CFG-02, TS-04).

## Global Constraints

Verbatim spec §7 :

- **Sécurité** : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` server-only, jamais `NEXT_PUBLIC_`. Seuls `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` portent ce préfixe.
- **DB** : writes via `/api/` + `createServiceClient()` ; ce client **ne porte jamais** les cookies de la requête.
- **Routing** : lab slug validé (`paris`|`montreal`) ; invalide → 400 (API).
- **Next.js 16** : `params` = `Promise` → `await params`.
- **Aucune** garde `assertLabAccess` ; `Lab='paris'|'montreal'` intact. **Les constats cross-lab de D1 sont won't-fix.**
- **Gate par tâche** : `npm test` + `npx tsc --noEmit` + `npm run lint` à **0/0**.
- **Versioning** : commit atomique, message terminé par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` ; ne jamais commiter `.env.local`.

---

## ⚠️ Notes d'exécution (état vérifié sur le code courant)

| Constat | État réel | Conséquence |
|---|---|---|
| §5 `order` : `Array.isArray(orderedIds)` + éléments string | ✅ **déjà fait** (`subjects/[id]/order/route.ts:11-13`, test existant) | **test de garde**, pas de fix |
| B4/CONV-03 `GET /api/members` sans auth | ✅ **déjà fait** (V0) | exclu |
| B7 garde `NEXT_PUBLIC_APP_URL` | ✅ **déjà fait** (V0) | exclu |
| Sec-2 / §4 writes cross-lab | ⛔ **won't-fix** (décision produit) | exclu, aucune garde labo |
| `admin/layout.tsx` sans `requireAdmin()` | ❌ **réel** (vérifié) | fix Task 7 |
| `next.config.ts` sans `headers()` | ❌ **réel** (vide) | fix Task 6 |
| `.env.example` absent | ❌ **réel** | fix Task 6 |
| pas de CI | ❌ **réel** | fix Task 8 |

**Harnais node-only** : routes API et lib `rate-limit` → TDD RED→GREEN. `next.config`/CI/tsconfig → garde + manuel documenté.

---

### Task 1: Sec-4 — bornes de longueur sur `POST /api/comments`

**Files:**
- Modify: `src/app/api/comments/route.ts`
- Test (create): `src/app/api/comments/route.test.ts`

**Interfaces:**
- Consumes : `getSession` (mockable), `createServiceClient` (mockable).
- Produces : `texte` > 4000 → 400 ; nom/prénom visiteur > 80 → 400. Bornes appliquées **après** les checks de présence existants.

- [ ] **Step 1: Test (RED)** — `src/app/api/comments/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ getSession: () => Promise.resolve(null) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: '1' }, error: null }) }) }) }),
  }),
}))
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/comments', { method: 'POST', body: JSON.stringify(b) })

beforeEach(() => {})

describe('POST /api/comments — bornes', () => {
  it('refuse un texte > 4000 caractères (400)', async () => {
    const r = await POST(req({ sujet_id: 's', texte: 'a'.repeat(4001), visitor_prenom: 'A', visitor_nom: 'B' }))
    expect(r.status).toBe(400)
  })
  it('refuse un nom visiteur > 80 caractères (400)', async () => {
    const r = await POST(req({ sujet_id: 's', texte: 'ok', visitor_prenom: 'x'.repeat(81), visitor_nom: 'B' }))
    expect(r.status).toBe(400)
  })
  it('accepte un commentaire valide (201)', async () => {
    const r = await POST(req({ sujet_id: 's', texte: 'ok', visitor_prenom: 'A', visitor_nom: 'B' }))
    expect(r.status).toBe(201)
  })
})
```

- [ ] **Step 2: Lancer (échec)** — Run: `npx vitest run src/app/api/comments/route.test.ts` — Expected: FAIL (textes longs acceptés).

- [ ] **Step 3: Implémenter** — `src/app/api/comments/route.ts`, après le check `if (!sujet_id || !texte?.trim())` :

```ts
  if (typeof texte !== 'string' || texte.length > 4000) {
    return NextResponse.json({ error: 'texte too long' }, { status: 400 })
  }
```
et, dans la branche visiteur, après le check de présence :
```ts
    if (visitor_prenom.trim().length > 80 || visitor_nom.trim().length > 80) {
      return NextResponse.json({ error: 'visitor name too long' }, { status: 400 })
    }
```

- [ ] **Step 4: Lancer (succès)** — Run: `npx vitest run src/app/api/comments/route.test.ts` — Expected: PASS (3/3).
- [ ] **Step 5: Gate** + commit `fix: bornes de longueur sur POST /api/comments (Sec-4)`.

---

### Task 2: Sec-4 + §3 — bornes propositions + `select` public restreint

**Files:**
- Modify: `src/app/api/proposals/route.ts`
- Test (create): `src/app/api/proposals/route.test.ts`

**Interfaces:**
- Produces : POST → `titre` > 300 / `description` > 5000 / email mal formé → 400. GET `?ids=` (public) → `select` **excluant** `proposant_email` et `commentaire_admin`.

- [ ] **Step 1: Test (RED)** — `src/app/api/proposals/route.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

let lastSelect = ''
vi.mock('@/lib/auth', () => ({ requireMember: () => Promise.resolve({}), authErrorResponse: () => new Response(null, { status: 401 }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: (cols: string) => { lastSelect = cols; return { in: () => ({ order: () => Promise.resolve({ data: [], error: null }) }), eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) } },
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: '1' }, error: null }) }) }),
    }),
  }),
}))
import { GET, POST } from './route'
const post = (b: unknown) => new NextRequest('http://localhost/api/proposals', { method: 'POST', body: JSON.stringify(b) })
const valid = { labo: 'paris', titre: 'T', domaine: 'finance', difficulte: 'easy', description: 'D', proposant_prenom: 'A', proposant_nom: 'B' }

describe('proposals POST — bornes', () => {
  it('refuse titre > 300 (400)', async () => expect((await POST(post({ ...valid, titre: 't'.repeat(301) }))).status).toBe(400))
  it('refuse description > 5000 (400)', async () => expect((await POST(post({ ...valid, description: 'd'.repeat(5001) }))).status).toBe(400))
  it('refuse email mal formé (400)', async () => expect((await POST(post({ ...valid, proposant_email: 'pasunmail' }))).status).toBe(400))
})
describe('proposals GET ?ids — fuite de données', () => {
  it('le select public exclut proposant_email et commentaire_admin', async () => {
    await GET(new NextRequest('http://localhost/api/proposals?ids=a,b'))
    expect(lastSelect).not.toContain('proposant_email')
    expect(lastSelect).not.toContain('commentaire_admin')
    expect(lastSelect).not.toBe('*')
  })
})
```

- [ ] **Step 2: Lancer (échec)** — Run: `npx vitest run src/app/api/proposals/route.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter** — dans `POST`, après les checks de présence existants :

```ts
  if (titre.trim().length > 300 || description.trim().length > 5000) {
    return NextResponse.json({ error: 'titre or description too long' }, { status: 400 })
  }
  if (typeof proposant_email === 'string' && proposant_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proposant_email.trim())) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
```
et dans la branche `if (idsParam)` du GET, remplacer `.select('*')` par :
```ts
      .select('id,labo,titre,domaine,difficulte,description,proposant_prenom,proposant_nom,statut,created_at')
```

- [ ] **Step 4: Lancer (succès)** — Run: `npx vitest run src/app/api/proposals/route.test.ts` — Expected: PASS.
- [ ] **Step 5: Gate** + commit `fix: bornes propositions + select public restreint (Sec-4/§3)`.

---

### Task 3: §5 (garde) + CONV-04 — order validé + complexité mot de passe

**Files:**
- Modify: `src/app/api/auth/activate/route.ts`
- Test (modify): `src/app/api/subjects/[id]/order/route.test.ts` (ajouter garde si absente)
- Test (create): `src/app/api/auth/activate/route.test.ts`

**Interfaces:**
- Produces : activation refuse un mot de passe sans majuscule **ou** sans chiffre **ou** < 8 (400).

- [ ] **Step 1: Garde order** — vérifier que `order/route.test.ts` couvre déjà `orderedIds` non-array → 400. Si absent, ajouter le cas. (Le fix est **déjà en place** `order/route.ts:11-13`.)

- [ ] **Step 2: Test activate (RED)** — `src/app/api/auth/activate/route.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: async () => ({}) }))
import { POST } from './route'
const req = (b: unknown) => new NextRequest('http://localhost/api/auth/activate', { method: 'POST', body: JSON.stringify(b) })

describe('activate — complexité mot de passe', () => {
  it('refuse sans majuscule (400)', async () => expect((await POST(req({ token: 't', password: 'abcd1234' }))).status).toBe(400))
  it('refuse sans chiffre (400)', async () => expect((await POST(req({ token: 't', password: 'Abcdefgh' }))).status).toBe(400))
  it('refuse trop court (400)', async () => expect((await POST(req({ token: 't', password: 'Ab1' }))).status).toBe(400))
})
```

- [ ] **Step 3: Lancer (échec)** — Run: `npx vitest run src/app/api/auth/activate/route.test.ts` — Expected: FAIL (le check n'est que `length < 8`).

- [ ] **Step 4: Implémenter** — `activate/route.ts`, remplacer la condition d'entrée :

```ts
  const strong = typeof password === 'string' && password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
  if (!token || !strong) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
```

- [ ] **Step 5: Lancer (succès)** — Run: `npx vitest run src/app/api/auth/activate/route.test.ts` — Expected: PASS.
- [ ] **Step 6: Gate** + commit `fix: complexité mot de passe activation + garde order (CONV-04/§5)`.

---

### Task 4: Sec-6 — rate-limit (lib + sign-in + soumissions publiques)

**Files:**
- Create: `src/lib/rate-limit.ts`
- Modify: `src/app/api/auth/sign-in/route.ts`, `src/app/api/comments/route.ts`, `src/app/api/proposals/route.ts`
- Test (create): `src/lib/rate-limit.test.ts`

**Interfaces:**
- Produces : `rateLimit(key: string, limit: number, windowMs: number): boolean` (true = autorisé) — fenêtre glissante mémoire (`Map<string, number[]>`). `clientIp(req: NextRequest): string` depuis `x-forwarded-for`/`x-real-ip` (fallback `'unknown'`). Quand dépassé → la route renvoie **429**.

- [ ] **Step 1: Test (RED)** — `src/lib/rate-limit.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { rateLimit } from './rate-limit'

describe('rateLimit', () => {
  it('autorise jusqu’à la limite puis bloque', () => {
    const key = `k-${Math.random()}`
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(true)
    expect(rateLimit(key, 3, 1000)).toBe(false)
  })
  it('isole les clés', () => {
    expect(rateLimit(`a-${Math.random()}`, 1, 1000)).toBe(true)
    expect(rateLimit(`b-${Math.random()}`, 1, 1000)).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer (échec)** — Run: `npx vitest run src/lib/rate-limit.test.ts` — Expected: FAIL (module absent).

- [ ] **Step 3: Implémenter `src/lib/rate-limit.ts`**

```ts
import type { NextRequest } from 'next/server'

const hits = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (hits.get(key) ?? []).filter(t => now - t < windowMs)
  if (arr.length >= limit) { hits.set(key, arr); return false }
  arr.push(now); hits.set(key, arr)
  return true
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')?.trim() ?? 'unknown'
}
```

- [ ] **Step 4: Lancer (succès)** — Run: `npx vitest run src/lib/rate-limit.test.ts` — Expected: PASS.

- [ ] **Step 5: Brancher dans les routes** — en tête de chaque `POST`, avant tout traitement :
  - sign-in : `if (!rateLimit('signin:' + clientIp(req), 10, 60_000)) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })`
  - comments : `if (!rateLimit('comment:' + clientIp(req), 20, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })`
  - proposals : `if (!rateLimit('proposal:' + clientIp(req), 10, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })`

- [ ] **Step 6: Gate** — `npm test && npx tsc --noEmit && npm run lint`. Note manuelle : limiteur mémoire **par instance** (suffisant pour la cible Vercel actuelle ; documenter la limite multi-instance).
- [ ] **Step 7: Commit** — `feat: rate-limit mémoire sur sign-in + soumissions publiques (Sec-6)`.

---

### Task 5: §6 — résidu colonne `password_hash`

**Files:**
- Create (conditionnel): `supabase/migrations/005_drop_password_hash.sql`

- [ ] **Step 1:** Confirmer la présence d'une colonne `password_hash` sur `members` (`grep -rn password_hash supabase/migrations`) et son non-usage (`grep -rn password_hash src/`). Auth gérée par Supabase Auth → colonne morte.
- [ ] **Step 2:** Si confirmée inutilisée, créer `005_drop_password_hash.sql` : `ALTER TABLE members DROP COLUMN IF EXISTS password_hash;`. Si absente, **noter dans le rapport** « pas de résidu » et ne pas créer de migration.
- [ ] **Step 3: Gate** (`tsc`/`lint` inchangés) + commit `chore: drop colonne morte password_hash (§6)` (ou rapport si non applicable).

---

### Task 6: D7 — headers HTTP + `.env.example`

**Files:**
- Modify: `next.config.ts`
- Create: `.env.example`
- Test (create): `next.config.test.ts`

**Interfaces:**
- Produces : `nextConfig.headers()` retourne les 4 en-têtes de sécurité sur toutes les routes.

- [ ] **Step 1: Test (RED)** — `next.config.test.ts` (racine)

```ts
import { describe, it, expect } from 'vitest'
import config from './next.config'

describe('security headers', () => {
  it('définit les en-têtes de sécurité', async () => {
    const headers = await (config.headers as () => Promise<{ source: string; headers: { key: string; value: string }[] }[]>)()
    const keys = headers[0].headers.map(h => h.key)
    expect(keys).toEqual(expect.arrayContaining(['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']))
  })
})
```
> Si l'import du plugin next-intl gêne le test en env node, tester à la place la fonction `securityHeaders()` extraite et exportée depuis `next.config.ts`.

- [ ] **Step 2: Implémenter `next.config.ts`**

```ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  },
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 3:** Créer `.env.example` (clés sans valeurs, commentées) :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only
# App
NEXT_PUBLIC_APP_URL=                # ex: https://fame.example
# Intégrations (server-only)
DROPBOX_ACCESS_TOKEN=
RESEND_API_KEY=
EMAIL_FROM=                         # ex: FAME <no-reply@fame.example>
# Seed admin (npm run seed:admin)
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
```

- [ ] **Step 4: Lancer** — Run: `npx vitest run next.config.test.ts` (ajouter `next.config.test.ts` au include si nécessaire) — Expected: PASS. **Vérif build** : `npm run build` (smoke) — documenté.
- [ ] **Step 5: Commit** — `feat: headers de sécurité + .env.example (D7)`.

---

### Task 7: D7/D1 + TS-04 — `requireAdmin` layout + guards env `server.ts`

**Files:**
- Modify: `src/app/[locale]/admin/layout.tsx` (ajouter `await requireAdmin()`)
- Modify: `src/scripts/seed-admin.ts` (email via `SEED_ADMIN_EMAIL`)
- Modify: `src/lib/supabase/server.ts` (guards env explicites)

- [ ] **Step 1:** `admin/layout.tsx` — après `await params`, ajouter :
```ts
  try { await requireAdmin() } catch { notFound() }
```
(import `requireAdmin` de `@/lib/auth`, `notFound` de `next/navigation`). Ainsi la zone admin est protégée au niveau layout, pas seulement par middleware.

- [ ] **Step 2:** `seed-admin.ts` — remplacer l'email hardcodé par `process.env.SEED_ADMIN_EMAIL` ; conserver la validation existante des vars (lever si absente).

- [ ] **Step 3:** `server.ts` — dans `createServiceClient()` et `createClient()`, remplacer les `process.env.X!` par des lectures gardées :
```ts
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env (URL / SERVICE_ROLE_KEY)')
```
(idem `NEXT_PUBLIC_SUPABASE_ANON_KEY` pour `createClient`). `createServiceClient()` **ne porte toujours pas** les cookies (mémoire `service-role-no-cookies`).

- [ ] **Step 4: Garde** — test lisant `admin/layout.tsx` : contient `requireAdmin`. `server.ts` : ne contient plus `process.env.NEXT_PUBLIC_SUPABASE_URL!` (assertion `!`).
- [ ] **Step 5: Gate** + commit `fix: requireAdmin sur layout admin + guards env server.ts + seed email paramétré (D7/TS-04)`.

---

### Task 8: CI GitHub Actions + script `typecheck`

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json` (script `typecheck`)

- [ ] **Step 1:** Ajouter à `package.json` `scripts` : `"typecheck": "tsc --noEmit"`.

- [ ] **Step 2:** Créer `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm audit --audit-level=high || true   # informatif (postcss modéré connu)
```

- [ ] **Step 3:** Vérifier localement : `npm run typecheck && npm run lint && npm test` (équivalent des steps CI) — Expected: 0/0.
- [ ] **Step 4: Commit** — `ci: GitHub Actions (typecheck + lint + test + audit) + script typecheck`.

---

### Task 9: CFG-02 — `noUncheckedIndexedAccess`

**Files:**
- Modify: `tsconfig.json`
- Modify: les ~10 sites d'accès indexé non gardé révélés par le compilateur (`TasksPanel.tsx:63`, `SubjectCard.tsx:58`, etc.).

- [ ] **Step 1:** Ajouter `"noUncheckedIndexedAccess": true` aux `compilerOptions`.
- [ ] **Step 2:** Run: `npx tsc --noEmit` → lister chaque erreur `possibly 'undefined'`.
- [ ] **Step 3:** Corriger chaque site (garde `?.`, `if (x)`, ou destructuring avec défaut). Ne pas masquer par `!` ; ajouter de vraies gardes.
- [ ] **Step 4: Gate** — `npm test && npx tsc --noEmit && npm run lint` — 0/0.
- [ ] **Step 5: Commit** — `chore: activer noUncheckedIndexedAccess + gardes d'accès indexé (CFG-02)`.

---

## Clôture de vague

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` — vert.
- [ ] MAJ `docs/STATUS.md` (Vague 3 : durcissement + CI ; noter la limite multi-instance du rate-limit).
- [ ] Revue finale whole-branch (Opus 4.8).
- [ ] `superpowers:finishing-a-development-branch` → PR `vague3 → main`.
