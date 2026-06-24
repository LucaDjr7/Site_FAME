# Remédiation post-audit — Vague 0 (bloquants) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les 7 bloquants de mise en production identifiés dans `docs/AUDIT_2026-06-24.md` (B1–B7), avec une suite de tests Vitest qui en prouve la correction.

**Architecture:** Toutes les corrections sont côté serveur (route handlers `/api/*` + helpers `src/lib`). On introduit Vitest (premier harnais de test du projet) et un mock réutilisable du client service-role Supabase. Aucune migration SQL n'est nécessaire : le schéma existant porte déjà `labo` sur toutes les tables concernées et la PK `(task_id, member_id)` sur `task_assignees`. Le cloisonnement cross-lab est centralisé dans un seul helper `assertLabAccess`.

**Tech Stack:** Next.js 16.2.9 (App Router, route handlers), TypeScript strict, Supabase service-role client, Resend, Vitest (nouveau).

## Global Constraints

- Tous les **writes** passent par des routes `/api/` utilisant `createServiceClient()` de `src/lib/supabase/server.ts` (service-role, contourne RLS volontairement).
- `createServiceClient()` ne doit **jamais** porter les cookies de la requête (sinon bascule sous RLS) — ne pas modifier ce comportement.
- Auth via helpers de `src/lib/auth.ts` : `getSession()` (nullable), `requireMember()` (401), `requireAdmin()` (403), `authErrorResponse(err)` (formate AuthError en NextResponse). Toute nouvelle garde d'autorisation doit lever une `AuthError(status, message)` et être rattrapée par `authErrorResponse`.
- **Règle cross-lab (décision projet 2026-06-24)** : un membre n'agit que sur son propre labo (`member.labo`) ; un **admin** (`member.is_admin`) agit sur les deux labos.
- Lab slug : `paris` | `montreal`, toujours en minuscules.
- Secrets server-only : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` — jamais préfixés `NEXT_PUBLIC_`.
- `npx tsc --noEmit` et `npm run lint` doivent rester à **0 erreur / 0 warning** après chaque tâche.
- Audit de référence : `docs/AUDIT_2026-06-24.md`. Rapports bruts : `docs/audit-raw/`.

---

## File Structure

Fichiers **créés** :
- `vitest.config.ts` — config Vitest (environnement node, alias `@/`).
- `src/test/supabase-mock.ts` — fabrique de mock réutilisable pour le client service-role.
- `src/lib/resend/escape-html.ts` — helper d'échappement HTML (B6).
- `src/lib/resend/escape-html.test.ts`
- `src/lib/app-url.ts` — helper `getAppBaseUrl()` (B7).
- `src/lib/app-url.test.ts`
- `src/lib/auth.test.ts` — tests du nouveau `assertLabAccess` (B5).
- `src/app/api/members/route.test.ts` (B4)
- `src/app/api/subjects/[id]/order/route.test.ts` (B2)
- `src/app/api/tasks/[id]/claim/route.test.ts` (B3)
- `src/app/api/proposals/[id]/convert/route.test.ts` (B1)

Fichiers **modifiés** :
- `package.json` — devDeps Vitest + script `test`.
- `src/lib/auth.ts` — ajout `assertLabAccess` (B5).
- `src/lib/resend/send-invitation.ts`, `send-proposal-result.ts` — échappement (B6).
- `src/app/api/members/invite/route.ts` — guard APP_URL (B7).
- `src/app/api/members/route.ts` — auth sur GET (B4).
- `src/app/api/subjects/[id]/route.ts`, `tasks/[id]/route.ts`, `publications/[id]/route.ts`, `prompts/[id]/route.ts` — cross-lab (B5).
- `src/app/api/subjects/[id]/order/route.ts` — durcissement + cross-lab (B2).
- `src/app/api/tasks/[id]/claim/route.ts` — atomicité (B3).
- `src/app/api/proposals/[id]/convert/route.ts` — action compensatrice (B1).

---

### Task 1: Harnais Vitest + échappement HTML des emails (B6)

Première tâche : on installe Vitest et on prouve le harnais sur une fonction pure (l'échappement HTML), puis on l'applique aux deux templates Resend pour fermer B6 (injection HTML dans les emails).

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/resend/escape-html.ts`
- Create: `src/lib/resend/escape-html.test.ts`
- Modify: `src/lib/resend/send-invitation.ts:22-32`
- Modify: `src/lib/resend/send-proposal-result.ts:23-33`

**Interfaces:**
- Produces: `escapeHtml(input: string): string` — exporté depuis `src/lib/resend/escape-html.ts`. Échappe `& < > " '`.

- [ ] **Step 1: Installer Vitest**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME_Website"
npm install -D vitest@^3 @vitest/coverage-v8@^3
```

Expected: ajout de `vitest` dans `devDependencies`, pas d'erreur de peer-deps.

- [ ] **Step 2: Ajouter le script `test` à `package.json`**

Dans `package.json`, bloc `scripts`, ajouter la ligne `test` après `"lint": "eslint",` :

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "seed:admin": "npx tsx src/scripts/seed-admin.ts"
  },
```

- [ ] **Step 3: Créer `vitest.config.ts` à la racine**

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

- [ ] **Step 4: Écrire le test d'échappement (échoue)**

Create `src/lib/resend/escape-html.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escape-html'

describe('escapeHtml', () => {
  it('échappe les caractères HTML dangereux', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
  })
  it('échappe guillemets et esperluette', () => {
    expect(escapeHtml(`Tom & "Jerry" <'x'>`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &lt;&#39;x&#39;&gt;'
    )
  })
  it('laisse un texte sans caractère spécial intact', () => {
    expect(escapeHtml('Éric Dupont')).toBe('Éric Dupont')
  })
})
```

- [ ] **Step 5: Lancer le test pour vérifier l'échec**

Run: `npm test -- escape-html`
Expected: FAIL — `Failed to resolve import "./escape-html"` (le module n'existe pas encore).

- [ ] **Step 6: Implémenter `escapeHtml`**

Create `src/lib/resend/escape-html.ts` :

```ts
// Échappe les caractères HTML pour interpolation sûre dans les templates email.
// L'ordre importe : '&' d'abord pour ne pas doubler les entités.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

- [ ] **Step 7: Lancer le test pour vérifier le succès**

Run: `npm test -- escape-html`
Expected: PASS (3 tests).

- [ ] **Step 8: Appliquer l'échappement dans `send-invitation.ts`**

En tête de `src/lib/resend/send-invitation.ts`, après `import { Resend } from 'resend'` :

```ts
import { Resend } from 'resend'
import { escapeHtml } from './escape-html'
```

Puis dans le corps, juste après `const labLabel = lab === 'paris' ? 'Paris' : 'Montréal'`, ajouter :

```ts
  const safePrenom = escapeHtml(prenom)
```

Et dans le template `html`, remplacer `${prenom}` (ligne ~25) par `${safePrenom}`. **Ne pas** échapper `activationUrl` (c'est une URL générée par le serveur, déjà sûre, et l'échapper casserait les `&` d'éventuels query params).

- [ ] **Step 9: Appliquer l'échappement dans `send-proposal-result.ts`**

En tête, après `import { Resend } from 'resend'` :

```ts
import { Resend } from 'resend'
import { escapeHtml } from './escape-html'
```

Puis juste après `const accepted = statut === 'accepted'`, ajouter :

```ts
  const safePrenom = escapeHtml(proposantPrenom)
  const safeTitre = escapeHtml(titreProposal)
  const safeCommentaire = commentaire ? escapeHtml(commentaire) : null
```

Dans le template `html` : remplacer `${proposantPrenom}` par `${safePrenom}`, `${titreProposal}` par `${safeTitre}`, et la ligne du commentaire :

```ts
        ${safeCommentaire ? `<p><em>Team note: ${safeCommentaire}</em></p>` : ''}
```

- [ ] **Step 10: Vérifier types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur, 0 warning.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/resend/
git commit -m "fix(b6): échappe le HTML interpolé dans les emails Resend + harnais Vitest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Guard `NEXT_PUBLIC_APP_URL` (B7)

Sans `NEXT_PUBLIC_APP_URL`, l'URL d'activation devient relative et le lien email est inutilisable. On extrait un helper qui lève une erreur explicite si la variable est absente, et on l'utilise dans la route d'invitation.

**Files:**
- Create: `src/lib/app-url.ts`
- Create: `src/lib/app-url.test.ts`
- Modify: `src/app/api/members/invite/route.ts:34-35`

**Interfaces:**
- Produces: `getAppBaseUrl(): string` — renvoie `NEXT_PUBLIC_APP_URL` sans `/` final ; lève `Error('NEXT_PUBLIC_APP_URL is not set')` si absente ou vide.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/lib/app-url.test.ts` :

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { getAppBaseUrl } from './app-url'

const original = process.env.NEXT_PUBLIC_APP_URL
afterEach(() => { process.env.NEXT_PUBLIC_APP_URL = original })

describe('getAppBaseUrl', () => {
  it('renvoie la base sans slash final', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://fame.example.com/'
    expect(getAppBaseUrl()).toBe('https://fame.example.com')
  })
  it('renvoie la base telle quelle si pas de slash final', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://fame.example.com'
    expect(getAppBaseUrl()).toBe('https://fame.example.com')
  })
  it('lève si la variable est absente', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(() => getAppBaseUrl()).toThrow('NEXT_PUBLIC_APP_URL is not set')
  })
  it('lève si la variable est vide', () => {
    process.env.NEXT_PUBLIC_APP_URL = ''
    expect(() => getAppBaseUrl()).toThrow('NEXT_PUBLIC_APP_URL is not set')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npm test -- app-url`
Expected: FAIL — import non résolu.

- [ ] **Step 3: Implémenter `getAppBaseUrl`**

Create `src/lib/app-url.ts` :

```ts
// Renvoie l'URL de base publique de l'app (pour construire des liens absolus
// dans les emails). Lève si NEXT_PUBLIC_APP_URL n'est pas configurée, pour
// éviter d'envoyer des liens d'activation relatifs (donc inutilisables).
export function getAppBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base || base.trim() === '') {
    throw new Error('NEXT_PUBLIC_APP_URL is not set')
  }
  return base.replace(/\/+$/, '')
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npm test -- app-url`
Expected: PASS (4 tests).

- [ ] **Step 5: Utiliser le helper dans la route d'invitation**

Dans `src/app/api/members/invite/route.ts`, ajouter l'import en tête :

```ts
import { getAppBaseUrl } from '@/lib/app-url'
```

Remplacer les lignes 34-35 :

```ts
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const activationUrl = `${base}/en/auth/activate/${token}`
```

par :

```ts
  let activationUrl: string
  try {
    activationUrl = `${getAppBaseUrl()}/en/auth/activate/${token}`
  } catch {
    console.error('NEXT_PUBLIC_APP_URL is not set — cannot build activation link')
    return NextResponse.json(
      { error: 'Server misconfigured: NEXT_PUBLIC_APP_URL is not set' },
      { status: 500 }
    )
  }
```

Note : à ce stade le membre + l'invitation sont déjà créés en base. Le 500 signale à l'admin que la config est manquante ; le lien reste récupérable une fois la variable posée (l'invitation existe). C'est volontaire — on échoue bruyamment plutôt que d'envoyer un lien cassé.

- [ ] **Step 6: Vérifier types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 erreur, 0 warning.

- [ ] **Step 7: Commit**

```bash
git add src/lib/app-url.ts src/lib/app-url.test.ts src/app/api/members/invite/route.ts
git commit -m "fix(b7): guard explicite sur NEXT_PUBLIC_APP_URL (liens d'activation)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Mock service-role réutilisable + auth sur `GET /api/members` (B4)

`GET /api/members` est public et expose les emails. Décision projet : **réservé aux membres connectés, emails inclus**. On crée d'abord le mock Supabase réutilisable (utilisé par les tâches suivantes), puis on protège la route.

**Files:**
- Create: `src/test/supabase-mock.ts`
- Modify: `src/app/api/members/route.ts:7`
- Create: `src/app/api/members/route.test.ts`

**Interfaces:**
- Produces: `makeServiceMock(result?: { data?: unknown; error?: unknown }): ServiceMock` — renvoie un objet dont **toute** chaîne de méthodes (`.from().select().eq().order()` etc.) est thenable et résout vers `result` (défaut `{ data: [], error: null }`). Les méthodes terminales `single`/`maybeSingle` résolvent aussi vers `result`. Chaque appel est enregistré dans `mock.calls`.

- [ ] **Step 1: Créer le mock service-role réutilisable**

Create `src/test/supabase-mock.ts` :

```ts
import { vi } from 'vitest'

// Builder chaînable : chaque méthode renvoie le même proxy (chaînable) ET est
// thenable (await renvoie `result`). Couvre les chaînes Supabase utilisées par
// les routes : from/select/insert/update/delete/eq/order/limit/single/maybeSingle.
export type ServiceResult = { data?: unknown; error?: unknown }

export function makeServiceMock(result: ServiceResult = { data: [], error: null }) {
  const calls: { method: string; args: unknown[] }[] = []
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop: string) {
      if (prop === 'then') {
        // rend l'objet awaitable → résout vers `result`
        return (resolve: (v: ServiceResult) => void) => resolve(result)
      }
      return (...args: unknown[]) => {
        calls.push({ method: prop, args })
        return chain
      }
    },
  }
  const chain = new Proxy({}, handler)
  return { client: chain as unknown, calls, result }
}
```

- [ ] **Step 2: Écrire le test de la route members (échoue)**

Create `src/app/api/members/route.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { makeServiceMock } from '@/test/supabase-mock'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

const serviceMock = makeServiceMock({ data: [{ id: '1', email: 'a@b.c' }], error: null })
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => serviceMock.client,
}))

import { GET } from './route'
import { AuthError } from '@/lib/auth'

function req(lab: string) {
  return new NextRequest(`http://localhost/api/members?lab=${lab}`)
}

beforeEach(() => { requireMember.mockReset() })

describe('GET /api/members', () => {
  it('renvoie 401 si non authentifié', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'Authentication required'))
    const res = await GET(req('paris'))
    expect(res.status).toBe(401)
  })
  it('renvoie 400 si lab invalide même authentifié', async () => {
    requireMember.mockResolvedValue({})
    const res = await GET(req('berlin'))
    expect(res.status).toBe(400)
  })
  it('renvoie les membres si authentifié et lab valide', async () => {
    requireMember.mockResolvedValue({})
    const res = await GET(req('paris'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([{ id: '1', email: 'a@b.c' }])
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier l'échec**

Run: `npm test -- members`
Expected: FAIL — le test 401 échoue (la route actuelle ne vérifie pas l'auth, renvoie 200).

- [ ] **Step 4: Ajouter l'auth à la route**

Dans `src/app/api/members/route.ts`, modifier les imports (ligne 1-3) et le début de `GET` :

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

export async function GET(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  if (!LABS.includes(lab)) return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  // ... reste inchangé
```

(Le reste du corps — sélection des colonnes, `.eq('labo', lab)`, gestion d'erreur — ne change pas.)

- [ ] **Step 5: Lancer le test pour vérifier le succès**

Run: `npm test -- members`
Expected: PASS (3 tests).

- [ ] **Step 6: Vérifier que la page Team consomme toujours la route en contexte connecté**

La page Team (`src/app/[locale]/[lab]/team/page.tsx`) est rendue côté serveur ; vérifier qu'elle lit les membres via le client serveur (RSC) et non via un `fetch` public non authentifié. Si elle appelle `GET /api/members` côté client sans cookie, noter le point pour le reviewer (la route exige désormais une session).

Run: `grep -rn "api/members" src/app src/components`
Expected: recenser les appels ; confirmer qu'ils sont en contexte authentifié (membre connecté). Documenter le résultat dans le rapport de tâche.

- [ ] **Step 7: Vérifier types + lint + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/test/supabase-mock.ts src/app/api/members/route.ts src/app/api/members/route.test.ts
git commit -m "fix(b4): exige une session sur GET /api/members + mock service-role de test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Helper `assertLabAccess` + cloisonnement cross-lab (B5)

Aucune route `[id]` mutative ne vérifie que la ressource appartient au labo du caller. On centralise la règle (membres cloisonnés, admins globaux) dans un helper testé, puis on l'applique aux routes de mutation.

**Files:**
- Modify: `src/lib/auth.ts` (ajout `assertLabAccess`)
- Create: `src/lib/auth.test.ts`
- Modify: `src/app/api/subjects/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/tasks/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/publications/[id]/route.ts` (DELETE)
- Modify: `src/app/api/prompts/[id]/route.ts` (DELETE)

**Interfaces:**
- Consumes: `requireMember()`, `AuthError` (existants).
- Produces: `assertLabAccess(member: Member, labo: Lab): void` — ne fait rien si `member.is_admin` est vrai ou si `member.labo === labo` ; sinon lève `AuthError(403, 'Cross-lab access denied')`.

- [ ] **Step 1: Écrire le test du helper (échoue)**

Create `src/lib/auth.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { assertLabAccess, AuthError } from './auth'
import type { Member } from '@/types'

function member(partial: Partial<Member>): Member {
  return {
    id: 'm1', prenom: 'A', nom: 'B', email: 'a@b.c', role: 'researcher',
    labo: 'paris', domaines: [], photo_url: null, is_admin: false,
    activated_at: null, created_at: '2026-01-01',
    ...partial,
  } as Member
}

describe('assertLabAccess', () => {
  it('autorise un membre sur son propre labo', () => {
    expect(() => assertLabAccess(member({ labo: 'paris' }), 'paris')).not.toThrow()
  })
  it('refuse un membre sur un autre labo (403)', () => {
    try {
      assertLabAccess(member({ labo: 'paris' }), 'montreal')
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(403)
    }
  })
  it('autorise un admin sur n’importe quel labo', () => {
    expect(() => assertLabAccess(member({ labo: 'paris', is_admin: true }), 'montreal')).not.toThrow()
  })
})
```

> Note d'implémentation : vérifier les noms de propriétés réels du type `Member` dans `src/types/index.ts` avant d'écrire le helper. Le helper n'utilise que `member.is_admin` et `member.labo` — ajuster le factory de test si les champs diffèrent, sans changer la logique testée.

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npm test -- auth`
Expected: FAIL — `assertLabAccess` n'existe pas.

- [ ] **Step 3: Implémenter `assertLabAccess` dans `src/lib/auth.ts`**

Ajouter les imports de type si besoin (en tête, `Lab` depuis `@/types`) et la fonction après `requireAdmin` :

```ts
import type { Member, Session, Lab } from '@/types'

// ... (getSession, requireMember, requireAdmin inchangés)

// Cloisonnement cross-lab : un membre n'agit que sur son labo ; un admin agit
// sur les deux. À appeler après requireMember() avec le `labo` de la ressource.
export function assertLabAccess(member: Member, labo: Lab): void {
  if (member.is_admin) return
  if (member.labo !== labo) {
    throw new AuthError(403, 'Cross-lab access denied')
  }
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `npm test -- auth`
Expected: PASS (3 tests).

- [ ] **Step 5: Appliquer à `subjects/[id]` (PATCH + DELETE)**

Dans `src/app/api/subjects/[id]/route.ts`, importer `assertLabAccess` :

```ts
import { requireMember, assertLabAccess, authErrorResponse } from '@/lib/auth'
```

Dans `PATCH`, après `const { id } = await params` et la création du `service`, charger la ressource et vérifier le labo **avant** l'update. Réécrire le corps de PATCH ainsi :

```ts
export async function PATCH(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json()
  const allowed = ['titre', 'kicker', 'statut', 'difficulte', 'context', 'method', 'results', 'keywords', 'auteurs', 'dimensions']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  const service = await createServiceClient()
  const { data: existing } = await service.from('subjects').select('labo').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try { assertLabAccess(member, existing.labo) } catch (e) { return authErrorResponse(e) }
  const { data, error } = await service.from('subjects').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

Dans `DELETE`, même schéma :

```ts
export async function DELETE(_req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()
  const { data: existing } = await service.from('subjects').select('labo').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try { assertLabAccess(member, existing.labo) } catch (e) { return authErrorResponse(e) }
  const { error } = await service.from('subjects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Appliquer à `tasks/[id]` (PATCH + DELETE)**

Dans `src/app/api/tasks/[id]/route.ts`, importer `assertLabAccess`. Dans `PATCH`, après création du `service` et **avant** la lecture de `oldStatut`, ajouter :

```ts
  const service = await createServiceClient()
  const { data: existingTask } = await service.from('tasks').select('labo').eq('id', id).single()
  if (!existingTask) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try { assertLabAccess(member, existingTask.labo) } catch (e) { return authErrorResponse(e) }
```

(`member` est déjà extrait de `requireMember()` dans cette route.) Dans `DELETE`, ajouter après le `service` :

```ts
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()
  const { data: existingTask } = await service.from('tasks').select('labo').eq('id', id).single()
  if (!existingTask) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try { assertLabAccess(member, existingTask.labo) } catch (e) { return authErrorResponse(e) }
  const { error } = await service.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
```

- [ ] **Step 7: Appliquer à `publications/[id]` et `prompts/[id]` (DELETE)**

Lire d'abord les deux fichiers pour confirmer la signature exacte des handlers. Pour chaque handler mutatif (DELETE et PATCH s'il existe), suivre le même schéma : `requireMember()` → charger `select('labo').eq('id', id).single()` → `assertLabAccess(member, existing.labo)` → exécuter la mutation. La table `publications` et la table `prompts` portent toutes deux la colonne `labo` (cf. `001_initial_schema.sql:127,141`).

- [ ] **Step 8: Vérifier types + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 0 erreur, 0 warning ; tous les tests passent.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/app/api/subjects/[id]/route.ts src/app/api/tasks/[id]/route.ts src/app/api/publications/[id]/route.ts src/app/api/prompts/[id]/route.ts
git commit -m "fix(b5): cloisonnement cross-lab sur les routes [id] (membres labo, admins globaux)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Durcissement de `subjects/[id]/order` (B2)

Le réordonnancement avale les erreurs Supabase (`Promise.all` sans vérifier les `error`) et ne valide ni l'entrée ni le labo. On valide l'entrée, on vérifie l'accès cross-lab, et on remonte un 500 si une mise à jour échoue.

**Files:**
- Modify: `src/app/api/subjects/[id]/order/route.ts`
- Create: `src/app/api/subjects/[id]/order/route.test.ts`

**Interfaces:**
- Consumes: `requireMember`, `assertLabAccess`, `authErrorResponse` (Task 4), `createServiceClient`.

- [ ] **Step 1: Écrire les tests (échouent)**

Create `src/app/api/subjects/[id]/order/route.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
const assertLabAccess = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return {
    ...actual,
    requireMember: () => requireMember(),
    assertLabAccess: (...a: unknown[]) => assertLabAccess(...a),
  }
})

let updateError: unknown = null
const updateCalls: unknown[][] = []
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      // lecture des labos des ids
      select: () => ({ in: () => Promise.resolve({ data: [{ labo: 'paris' }], error: null }) }),
      update: (vals: unknown) => ({
        eq: (_c: string, id: string) => {
          updateCalls.push([vals, id])
          return Promise.resolve({ error: updateError })
        },
      }),
    }),
  }),
}))

import { PATCH } from './route'
import { AuthError } from '@/lib/auth'

function req(body: unknown) {
  return new NextRequest('http://localhost/api/subjects/x/order', {
    method: 'PATCH', body: JSON.stringify(body),
  })
}

beforeEach(() => {
  requireMember.mockReset(); assertLabAccess.mockReset()
  updateError = null; updateCalls.length = 0
  requireMember.mockResolvedValue({ member: { labo: 'paris', is_admin: false } })
  assertLabAccess.mockReturnValue(undefined)
})

describe('PATCH /api/subjects/[id]/order', () => {
  it('renvoie 401 si non authentifié', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'x'))
    expect((await PATCH(req({ orderedIds: ['a'] }))).status).toBe(401)
  })
  it('renvoie 400 si orderedIds absent ou non-tableau', async () => {
    expect((await PATCH(req({}))).status).toBe(400)
    expect((await PATCH(req({ orderedIds: 'nope' }))).status).toBe(400)
  })
  it('renvoie 500 si une mise à jour échoue', async () => {
    updateError = { message: 'db down' }
    expect((await PATCH(req({ orderedIds: ['a', 'b'] }))).status).toBe(500)
  })
  it('renvoie 200 et met à jour chaque id en cas de succès', async () => {
    const res = await PATCH(req({ orderedIds: ['a', 'b', 'c'] }))
    expect(res.status).toBe(200)
    expect(updateCalls.map((c) => c[1])).toEqual(['a', 'b', 'c'])
    expect(updateCalls.map((c) => c[0])).toEqual([{ ordre: 0 }, { ordre: 1 }, { ordre: 2 }])
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test -- order`
Expected: FAIL (la route actuelle ne valide rien et ne remonte pas les erreurs).

- [ ] **Step 3: Réécrire la route**

Replace tout le contenu de `src/app/api/subjects/[id]/order/route.ts` :

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, assertLabAccess, authErrorResponse } from '@/lib/auth'

// Body: { orderedIds: string[] } — full ordered array of subject IDs for a lab
export async function PATCH(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }

  const body = await req.json().catch(() => null)
  const orderedIds = body?.orderedIds
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 ||
      !orderedIds.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'orderedIds must be a non-empty string array' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Cross-lab : tous les sujets réordonnés doivent appartenir à un labo accessible.
  const { data: rows, error: readErr } = await service
    .from('subjects').select('labo').in('id', orderedIds)
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  const labos = [...new Set((rows ?? []).map((r: { labo: string }) => r.labo))]
  try {
    for (const labo of labos) assertLabAccess(member, labo as 'paris' | 'montreal')
  } catch (e) { return authErrorResponse(e) }

  // Mise à jour ordonnée — on remonte la première erreur.
  const results = await Promise.all(
    orderedIds.map((id, ordre) => service.from('subjects').update({ ordre }).eq('id', id))
  )
  const failed = results.find((r) => r.error)
  if (failed) return NextResponse.json({ error: failed.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test -- order`
Expected: PASS (4 blocs).

- [ ] **Step 5: Vérifier types + lint + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/subjects/[id]/order/route.ts src/app/api/subjects/[id]/order/route.test.ts
git commit -m "fix(b2): order remonte les erreurs Supabase + valide entrée et labo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Atomicité de `tasks/[id]/claim` (B3)

Le toggle lit puis écrit sans atomicité et avale les erreurs d'insert/delete. La PK `(task_id, member_id)` garantit déjà l'unicité ; on s'appuie dessus : on traite une violation d'unicité (code Postgres `23505`) comme « déjà réclamé » et on remonte les autres erreurs.

**Files:**
- Modify: `src/app/api/tasks/[id]/claim/route.ts`
- Create: `src/app/api/tasks/[id]/claim/route.test.ts`

- [ ] **Step 1: Écrire les tests (échouent)**

Create `src/app/api/tasks/[id]/claim/route.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let existing: unknown = null
let insertError: unknown = null
let deleteError: unknown = null
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing, error: null }) }) }) }),
      insert: () => Promise.resolve({ error: insertError }),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: deleteError }) }) }),
    }),
  }),
}))

import { POST } from './route'

function req() { return new NextRequest('http://localhost/api/tasks/t1/claim', { method: 'POST' }) }
const params = { params: Promise.resolve({ id: 't1' }) }

beforeEach(() => {
  requireMember.mockReset(); existing = null; insertError = null; deleteError = null
  requireMember.mockResolvedValue({ member: { id: 'm1' } })
})

describe('POST /api/tasks/[id]/claim', () => {
  it('réclame (insert) quand non assigné → claimed:true', async () => {
    const res = await POST(req(), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ claimed: true })
  })
  it('libère (delete) quand déjà assigné → claimed:false', async () => {
    existing = { task_id: 't1', member_id: 'm1' }
    expect(await (await POST(req(), params)).json()).toEqual({ claimed: false })
  })
  it('traite la violation d’unicité (23505) comme claimed:true', async () => {
    insertError = { code: '23505', message: 'duplicate key' }
    expect(await (await POST(req(), params)).json()).toEqual({ claimed: true })
  })
  it('remonte une vraie erreur d’insert en 500', async () => {
    insertError = { code: '42P01', message: 'relation does not exist' }
    expect((await POST(req(), params)).status).toBe(500)
  })
  it('remonte une erreur de delete en 500', async () => {
    existing = { task_id: 't1', member_id: 'm1' }
    deleteError = { code: 'XX000', message: 'boom' }
    expect((await POST(req(), params)).status).toBe(500)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test -- claim`
Expected: FAIL (la route actuelle utilise `.single()` et ignore les erreurs).

- [ ] **Step 3: Réécrire la route**

Replace tout le contenu de `src/app/api/tasks/[id]/claim/route.ts` :

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST: toggle d'assignation. S'appuie sur la PK (task_id, member_id) de
// task_assignees pour l'atomicité : une violation d'unicité (23505) lors de
// l'insert signifie « déjà réclamé » (course gagnée par une autre requête).
export async function POST(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id: task_id } = await params
  const service = await createServiceClient()

  const { data: existing } = await service.from('task_assignees')
    .select('*').eq('task_id', task_id).eq('member_id', member.id).maybeSingle()

  if (existing) {
    const { error } = await service.from('task_assignees')
      .delete().eq('task_id', task_id).eq('member_id', member.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ claimed: false })
  }

  const { error } = await service.from('task_assignees').insert({ task_id, member_id: member.id })
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ claimed: true })
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test -- claim`
Expected: PASS (5 blocs).

- [ ] **Step 5: Vérifier types + lint + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/api/tasks/[id]/claim/route.ts src/app/api/tasks/[id]/claim/route.test.ts
git commit -m "fix(b3): claim atomique via PK task_assignees + remontée d'erreurs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Action compensatrice sur `proposals/[id]/convert` (B1)

Si l'insertion du sujet réussit mais que la mise à jour de la proposition échoue, un sujet orphelin est créé (proposition sans `subject_id`, donc l'idempotence ne le rattrape pas — un retry crée un second sujet). On compense : en cas d'échec de l'update, on supprime le sujet créé et on renvoie 500.

**Files:**
- Modify: `src/app/api/proposals/[id]/convert/route.ts:50-58`
- Create: `src/app/api/proposals/[id]/convert/route.test.ts`

- [ ] **Step 1: Écrire les tests (échouent)**

Create `src/app/api/proposals/[id]/convert/route.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireAdmin = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireAdmin: () => requireAdmin() }
})

let proposal: Record<string, unknown> | null
let updateError: unknown = null
const deletedSubjectIds: string[] = []
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => {
      if (table === 'proposals') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: proposal, error: proposal ? null : { message: 'nf' } }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: updateError }) }),
        }
      }
      // subjects
      return {
        select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { ordre: 4 }, error: null }) }) }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'subj-new' }, error: null }) }) }),
        delete: () => ({ eq: (_c: string, id: string) => { deletedSubjectIds.push(id); return Promise.resolve({ error: null }) } }),
      }
    },
  }),
}))

import { POST } from './route'

function req() { return new NextRequest('http://localhost/api/proposals/p1/convert', { method: 'POST' }) }
const params = { params: Promise.resolve({ id: 'p1' }) }

beforeEach(() => {
  requireAdmin.mockReset(); updateError = null; deletedSubjectIds.length = 0
  requireAdmin.mockResolvedValue({ member: { id: 'admin1' } })
  proposal = { id: 'p1', labo: 'paris', statut: 'pending', titre: 'T', description: 'D', domaine: 'finance', difficulte: 'easy', subject_id: null }
})

describe('POST /api/proposals/[id]/convert', () => {
  it('crée le sujet et renvoie 201 en cas de succès', async () => {
    const res = await POST(req(), params)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ subject_id: 'subj-new' })
    expect(deletedSubjectIds).toEqual([])
  })
  it('supprime le sujet et renvoie 500 si l’update de la proposition échoue', async () => {
    updateError = { message: 'update failed' }
    const res = await POST(req(), params)
    expect(res.status).toBe(500)
    expect(deletedSubjectIds).toEqual(['subj-new']) // compensation
  })
  it('reste idempotent si déjà converti', async () => {
    proposal = { ...proposal, subject_id: 'existing' }
    const res = await POST(req(), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ subject_id: 'existing' })
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test -- convert`
Expected: FAIL — le test de compensation échoue (la route actuelle log et renvoie 201 sans supprimer le sujet).

- [ ] **Step 3: Remplacer le bloc de mise à jour de la proposition**

Dans `src/app/api/proposals/[id]/convert/route.ts`, remplacer les lignes 50-58 (du `const { error: updErr } = ...` jusqu'au `return` final) par :

```ts
  const { error: updErr } = await service.from('proposals').update({
    statut: 'accepted',
    traitee_at: new Date().toISOString(),
    traitee_par: member.id,
    subject_id: subject.id,
  }).eq('id', id)

  if (updErr) {
    // Compensation : la proposition n'a pas pu être liée au sujet → on supprime
    // le sujet pour éviter un orphelin (sinon un retry recréerait un doublon).
    await service.from('subjects').delete().eq('id', subject.id)
    console.error('proposal convert: rolled back orphan subject after proposal update failure', { id, subjectId: subject.id, error: updErr.message })
    return NextResponse.json({ error: 'Conversion failed; rolled back' }, { status: 500 })
  }

  return NextResponse.json({ subject_id: subject.id }, { status: 201 })
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npm test -- convert`
Expected: PASS (3 blocs).

- [ ] **Step 5: Lancer toute la suite + types + lint**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tous les tests passent ; 0 erreur ; 0 warning.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/proposals/[id]/convert/route.ts src/app/api/proposals/[id]/convert/route.test.ts
git commit -m "fix(b1): convert supprime le sujet orphelin si l'update proposition échoue

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes d'exécution

- **Aucune migration SQL** n'est requise pour cette vague. Si le reviewer estime que B1 mérite l'atomicité transactionnelle stricte (RPC Postgres `convert_proposal_to_subject`), c'est une amélioration de vague ultérieure qui nécessiterait une migration appliquée manuellement en prod — hors périmètre vague 0.
- **B4 effet de bord** : `GET /api/members` exige désormais une session. Confirmer (Task 3 Step 6) qu'aucun appelant public ne s'appuie sur l'accès anonyme. Si la page Team publique en dépend, escalader avant de merger.
- Type `Member` : avant Task 4, vérifier les noms de champs réels dans `src/types/index.ts` (`is_admin`, `labo`). Le helper et son test n'utilisent que ces deux champs.
- Après la vague : mettre à jour `docs/STATUS.md` (les 7 bloquants levés), puis ouvrir la **PR `audit` → `main`** convenue, et **alors seulement** déclencher le déploiement (vars Vercel, `NEXT_PUBLIC_APP_URL`, domaine Resend, `seed:admin`).
