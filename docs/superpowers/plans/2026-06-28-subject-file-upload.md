# Subject File Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux membres de déposer des fichiers (≤50 Mo) directement sur une fiche sujet, en complément des liens Dropbox, avec téléchargement public sur les sujets non confidentiels.

**Architecture:** Bucket privé Supabase Storage `subject-files` + table `subject_files`. Upload direct navigateur → Storage via URL signée (contourne la limite ~4,5 Mo de Vercel) en 3 temps (sign → upload → register). Téléchargement via endpoint app qui regénère une URL signée courte et revérifie le gate `confidentiel`.

**Tech Stack:** Next.js 16 App Router, Supabase (`@supabase/supabase-js` service-role + `@supabase/ssr` browser), Storage, TypeScript, vitest.

## Global Constraints

- Locales `en` + `fr` à parité stricte (test `src/messages-parity.test.ts`) ; zéro chaîne UI hardcodée.
- Tous les writes passent par `/api/` avec `createServiceClient()` (service-role, **sans cookies**).
- `requireMember()` lève 401, `authErrorResponse(e)` formate ; `getSession()` est nullable.
- Lab slug `paris|montreal` ; `VALID_LABS` dans `@/lib/constants`.
- `confidentiel=true` n'est JAMAIS exposé au visiteur (cf. audit B1) ; revérifier côté serveur.
- Secrets server-only ; seul le **token d'upload signé** transite vers le client.
- Migrations appliquées manuellement en BDD (numérotées ; dernière = `009`).
- Tests : vitest, mock `@/lib/auth` et `@/lib/supabase/server` (voir patterns existants `src/app/api/**/route.test.ts`).

---

### Task 1: Migration `010`, type `SubjectFile`, helper de validation

**Files:**
- Create: `supabase/migrations/010_subject_files.sql`
- Modify: `src/types/index.ts` (ajouter `SubjectFile` après `DropboxLink`, ~ligne 218)
- Create: `src/lib/subjects/file-upload.ts`
- Test: `src/lib/subjects/file-upload.test.ts`

**Interfaces:**
- Produces:
  - `SUBJECT_FILES_BUCKET = 'subject-files'`
  - `MAX_FILE_BYTES = 52428800`
  - `ALLOWED_MIME: Record<string, string>` (mime → extension)
  - `validateUpload(input: { mimeType?: unknown; sizeBytes?: unknown; fileName?: unknown }): { ok: true } | { ok: false; error: string }`
  - type `SubjectFile { id; subject_id; labo: Lab; storage_path; file_name; mime_type; size_bytes: number; uploaded_by: string | null; created_at }`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/010_subject_files.sql`:

```sql
-- Subject file uploads (complément des liens Dropbox).
create table subject_files (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  labo text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  uploaded_by uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_subject_files_subject on subject_files(subject_id);
alter table subject_files enable row level security;
-- Aucune policy : tout l'accès passe par l'API service-role (comme dropbox_links).

-- Bucket privé pour les fichiers de sujets (50 Mo, liste blanche MIME).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'subject-files', 'subject-files', false, 52428800,
  array[
    'application/pdf','image/png','image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv','text/plain'
  ]
)
on conflict (id) do nothing;
```

- [ ] **Step 2: Add the `SubjectFile` type**

In `src/types/index.ts`, after the `DropboxLink` interface (ends ~line 218):

```ts
export interface SubjectFile {
  id: string
  subject_id: string
  labo: Lab
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}
```

- [ ] **Step 3: Write the failing test for `validateUpload`**

Create `src/lib/subjects/file-upload.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateUpload, MAX_FILE_BYTES, ALLOWED_MIME } from './file-upload'

describe('validateUpload', () => {
  it('accepte un PDF valide', () => {
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 1000, fileName: 'a.pdf' }))
      .toEqual({ ok: true })
  })
  it('refuse un type non autorisé', () => {
    const r = validateUpload({ mimeType: 'application/x-msdownload', sizeBytes: 10, fileName: 'a.exe' })
    expect(r.ok).toBe(false)
  })
  it('refuse un fichier trop volumineux', () => {
    const r = validateUpload({ mimeType: 'application/pdf', sizeBytes: MAX_FILE_BYTES + 1, fileName: 'a.pdf' })
    expect(r.ok).toBe(false)
  })
  it('refuse un nom vide', () => {
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 10, fileName: '  ' }).ok).toBe(false)
  })
  it('refuse une taille invalide', () => {
    expect(validateUpload({ mimeType: 'application/pdf', sizeBytes: 0, fileName: 'a.pdf' }).ok).toBe(false)
  })
  it('expose png/jpeg/docx dans la liste blanche', () => {
    expect(ALLOWED_MIME['image/png']).toBeDefined()
    expect(ALLOWED_MIME['image/jpeg']).toBeDefined()
    expect(ALLOWED_MIME['application/vnd.openxmlformats-officedocument.wordprocessingml.document']).toBeDefined()
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/lib/subjects/file-upload.test.ts`
Expected: FAIL — `Cannot find module './file-upload'`.

- [ ] **Step 5: Implement the helper**

Create `src/lib/subjects/file-upload.ts`:

```ts
export const SUBJECT_FILES_BUCKET = 'subject-files'
export const MAX_FILE_BYTES = 52428800 // 50 Mo

// Liste blanche MIME → extension (défense côté app, en plus du bucket).
export const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv',
  'text/plain': 'txt',
}

export function validateUpload(
  input: { mimeType?: unknown; sizeBytes?: unknown; fileName?: unknown },
): { ok: true } | { ok: false; error: string } {
  const { mimeType, sizeBytes, fileName } = input
  if (typeof fileName !== 'string' || !fileName.trim()) return { ok: false, error: 'file_name required' }
  if (typeof mimeType !== 'string' || !(mimeType in ALLOWED_MIME)) return { ok: false, error: 'unsupported file type' }
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) return { ok: false, error: 'invalid size' }
  if (sizeBytes > MAX_FILE_BYTES) return { ok: false, error: 'file too large' }
  return { ok: true }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/subjects/file-upload.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/010_subject_files.sql src/types/index.ts src/lib/subjects/file-upload.ts src/lib/subjects/file-upload.test.ts
git commit -m "feat(files): migration 010 subject_files + bucket + validation helper"
```

---

### Task 2: Endpoint `sign` (URL d'upload signée)

**Files:**
- Create: `src/app/api/subjects/[id]/files/sign/route.ts`
- Test: `src/app/api/subjects/[id]/files/sign/route.test.ts`

**Interfaces:**
- Consumes: `validateUpload`, `SUBJECT_FILES_BUCKET` (Task 1) ; `requireMember`, `authErrorResponse`, `createServiceClient`.
- Produces: `POST` → `200 { path: string, token: string }` ; body attendu `{ file_name, mime_type, size_bytes }`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/subjects/[id]/files/sign/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let subject: unknown = { id: 's1' }
const createSignedUploadUrl = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: subject, error: subject ? null : { message: 'nf' } }) }) }) }),
    storage: { from: () => ({ createSignedUploadUrl: (...a: unknown[]) => createSignedUploadUrl(...a) }) },
  }),
}))

import { POST } from './route'
import { AuthError } from '@/lib/auth'

const params = { params: Promise.resolve({ id: 's1' }) }
const req = (b: unknown) => new NextRequest('http://localhost/api/subjects/s1/files/sign', { method: 'POST', body: JSON.stringify(b) })
const valid = { file_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 1000 }

beforeEach(() => {
  requireMember.mockReset(); requireMember.mockResolvedValue({ session: {}, member: { id: 'm' } })
  subject = { id: 's1' }
  createSignedUploadUrl.mockReset()
  createSignedUploadUrl.mockResolvedValue({ data: { path: 's1/uuid', token: 'tok', signedUrl: 'http://x' }, error: null })
})

describe('POST /api/subjects/[id]/files/sign', () => {
  it('401 si non-membre', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'x'))
    expect((await POST(req(valid), params)).status).toBe(401)
  })
  it('400 si type non autorisé', async () => {
    expect((await POST(req({ ...valid, mime_type: 'application/x-msdownload' }), params)).status).toBe(400)
  })
  it('400 si trop volumineux', async () => {
    expect((await POST(req({ ...valid, size_bytes: 60_000_000 }), params)).status).toBe(400)
  })
  it('404 si sujet inexistant', async () => {
    subject = null
    expect((await POST(req(valid), params)).status).toBe(404)
  })
  it('200 + path/token en succès', async () => {
    const res = await POST(req(valid), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ path: 's1/uuid', token: 'tok' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "src/app/api/subjects/[id]/files/sign/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/subjects/[id]/files/sign/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { validateUpload, SUBJECT_FILES_BUCKET } from '@/lib/subjects/file-upload'
import crypto from 'crypto'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const v = validateUpload({ mimeType: body.mime_type, sizeBytes: body.size_bytes, fileName: body.file_name })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const service = await createServiceClient()
  const { data: subject } = await service.from('subjects').select('id').eq('id', id).single()
  if (!subject) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const path = `${id}/${crypto.randomUUID()}`
  const { data, error } = await service.storage.from(SUBJECT_FILES_BUCKET).createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'sign failed' }, { status: 500 })
  return NextResponse.json({ path: data.path, token: data.token })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "src/app/api/subjects/[id]/files/sign/route.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/subjects/[id]/files/sign/"
git commit -m "feat(files): signed upload URL endpoint"
```

---

### Task 3: Endpoint `register` (insertion des métadonnées)

**Files:**
- Create: `src/app/api/subjects/[id]/files/route.ts`
- Test: `src/app/api/subjects/[id]/files/route.test.ts`

**Interfaces:**
- Consumes: `validateUpload`, `SUBJECT_FILES_BUCKET` ; `requireMember`, `createServiceClient`.
- Produces: `POST` → `201 SubjectFile` ; body `{ storage_path, file_name, mime_type, size_bytes }`. Compensation : supprime l'objet Storage si l'insert échoue.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/subjects/[id]/files/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, requireMember: () => requireMember() }
})

let subject: unknown = { id: 's1', labo: 'paris' }
let insertResult: { data: unknown; error: unknown } = { data: { id: 'f1' }, error: null }
const removed: string[][] = []
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: subject, error: subject ? null : { message: 'nf' } }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve(insertResult) }) }),
    }),
    storage: { from: () => ({ remove: (paths: string[]) => { removed.push(paths); return Promise.resolve({ error: null }) } }) },
  }),
}))

import { POST } from './route'

const params = { params: Promise.resolve({ id: 's1' }) }
const req = (b: unknown) => new NextRequest('http://localhost/api/subjects/s1/files', { method: 'POST', body: JSON.stringify(b) })
const valid = { storage_path: 's1/uuid', file_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 1000 }

beforeEach(() => {
  requireMember.mockReset(); requireMember.mockResolvedValue({ session: {}, member: { id: 'm' } })
  subject = { id: 's1', labo: 'paris' }
  insertResult = { data: { id: 'f1' }, error: null }
  removed.length = 0
})

describe('POST /api/subjects/[id]/files (register)', () => {
  it('400 si type non autorisé', async () => {
    expect((await POST(req({ ...valid, mime_type: 'x/y' }), params)).status).toBe(400)
  })
  it('400 si storage_path hors du dossier du sujet', async () => {
    expect((await POST(req({ ...valid, storage_path: 'other/uuid' }), params)).status).toBe(400)
  })
  it('404 si sujet inexistant', async () => {
    subject = null
    expect((await POST(req(valid), params)).status).toBe(404)
  })
  it('201 en succès', async () => {
    expect((await POST(req(valid), params)).status).toBe(201)
  })
  it('compense (supprime l’objet) si l’insert échoue', async () => {
    insertResult = { data: null, error: { message: 'db down' } }
    const res = await POST(req(valid), params)
    expect(res.status).toBe(500)
    expect(removed).toEqual([['s1/uuid']])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "src/app/api/subjects/[id]/files/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/subjects/[id]/files/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import { validateUpload, SUBJECT_FILES_BUCKET } from '@/lib/subjects/file-upload'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const v = validateUpload({ mimeType: body.mime_type, sizeBytes: body.size_bytes, fileName: body.file_name })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  // Le chemin doit appartenir au dossier du sujet (anti-forgerie).
  if (typeof body.storage_path !== 'string' || !body.storage_path.startsWith(`${id}/`)) {
    return NextResponse.json({ error: 'invalid storage_path' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: subject } = await service.from('subjects').select('id,labo').eq('id', id).single()
  if (!subject) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await service.from('subject_files').insert({
    subject_id: id, labo: subject.labo, storage_path: body.storage_path,
    file_name: body.file_name, mime_type: body.mime_type, size_bytes: body.size_bytes,
    uploaded_by: member.id,
  }).select().single()

  if (error) {
    // Compensation : pas de ligne → on retire l'objet orphelin du bucket.
    await service.storage.from(SUBJECT_FILES_BUCKET).remove([body.storage_path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "src/app/api/subjects/[id]/files/route.test.ts"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/subjects/[id]/files/route.ts" "src/app/api/subjects/[id]/files/route.test.ts"
git commit -m "feat(files): register endpoint with orphan compensation"
```

---

### Task 4: Endpoint `download` + `delete`

**Files:**
- Create: `src/app/api/subjects/[id]/files/[fileId]/route.ts`
- Test: `src/app/api/subjects/[id]/files/[fileId]/route.test.ts`

**Interfaces:**
- Consumes: `SUBJECT_FILES_BUCKET` ; `getSession`, `requireMember`, `createServiceClient`.
- Produces:
  - `GET` → `302` redirige vers une URL signée (60 s). `404` si sujet confidentiel vu par un visiteur, ou fichier absent / mauvais sujet.
  - `DELETE` → `200 { ok: true }` (membre requis, idempotent).

- [ ] **Step 1: Write the failing test**

Create `src/app/api/subjects/[id]/files/[fileId]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getSession = vi.fn()
const requireMember = vi.fn()
vi.mock('@/lib/auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/auth')>()
  return { ...actual, getSession: () => getSession(), requireMember: () => requireMember() }
})

let subject: unknown = { confidentiel: false }
let file: unknown = { id: 'f1', subject_id: 's1', storage_path: 's1/uuid', file_name: 'a.pdf' }
const removed: string[][] = []
const createSignedUrl = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: table === 'subjects' ? subject : file, error: (table === 'subjects' ? subject : file) ? null : { message: 'nf' } }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    storage: { from: () => ({
      createSignedUrl: (...a: unknown[]) => createSignedUrl(...a),
      remove: (paths: string[]) => { removed.push(paths); return Promise.resolve({ error: null }) },
    }) },
  }),
}))

import { GET, DELETE } from './route'
import { AuthError } from '@/lib/auth'

const params = { params: Promise.resolve({ id: 's1', fileId: 'f1' }) }
const gReq = () => new NextRequest('http://localhost/api/subjects/s1/files/f1')
const dReq = () => new NextRequest('http://localhost/api/subjects/s1/files/f1', { method: 'DELETE' })

beforeEach(() => {
  getSession.mockReset(); getSession.mockResolvedValue(null)
  requireMember.mockReset(); requireMember.mockResolvedValue({ session: {}, member: { id: 'm' } })
  subject = { confidentiel: false }
  file = { id: 'f1', subject_id: 's1', storage_path: 's1/uuid', file_name: 'a.pdf' }
  removed.length = 0
  createSignedUrl.mockReset()
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://storage.example/signed' }, error: null })
})

describe('GET /api/subjects/[id]/files/[fileId] (download)', () => {
  it('404 sujet confidentiel vu par un visiteur', async () => {
    subject = { confidentiel: true }
    expect((await GET(gReq(), params)).status).toBe(404)
  })
  it('302 sujet confidentiel vu par un membre', async () => {
    subject = { confidentiel: true }
    getSession.mockResolvedValue({ user: { id: 'u' }, member: { id: 'u' } })
    expect((await GET(gReq(), params)).status).toBe(302)
  })
  it('404 si le fichier appartient à un autre sujet', async () => {
    file = { id: 'f1', subject_id: 'OTHER', storage_path: 'x', file_name: 'a' }
    expect((await GET(gReq(), params)).status).toBe(404)
  })
  it('302 vers l’URL signée en succès (visiteur, sujet public)', async () => {
    const res = await GET(gReq(), params)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://storage.example/signed')
  })
})

describe('DELETE /api/subjects/[id]/files/[fileId]', () => {
  it('401 si non-membre', async () => {
    requireMember.mockRejectedValue(new AuthError(401, 'x'))
    expect((await DELETE(dReq(), params)).status).toBe(401)
  })
  it('200 + suppression de l’objet en succès', async () => {
    const res = await DELETE(dReq(), params)
    expect(res.status).toBe(200)
    expect(removed).toEqual([['s1/uuid']])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "src/app/api/subjects/[id]/files/[fileId]/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/subjects/[id]/files/[fileId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession, requireMember, authErrorResponse } from '@/lib/auth'
import { SUBJECT_FILES_BUCKET } from '@/lib/subjects/file-upload'

type Params = { params: Promise<{ id: string; fileId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, fileId } = await params
  const isMember = !!(await getSession())?.member
  const service = await createServiceClient()

  const { data: subject } = await service.from('subjects').select('confidentiel').eq('id', id).single()
  if (!subject) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Visiteur : un fichier de sujet confidentiel n'existe pas.
  if (subject.confidentiel && !isMember) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: file } = await service.from('subject_files').select('*').eq('id', fileId).single()
  if (!file || file.subject_id !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: signed, error } = await service.storage.from(SUBJECT_FILES_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.file_name })
  if (error || !signed) return NextResponse.json({ error: 'download failed' }, { status: 500 })
  return NextResponse.redirect(signed.signedUrl, 302)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id, fileId } = await params
  const service = await createServiceClient()
  const { data: file } = await service.from('subject_files').select('storage_path,subject_id').eq('id', fileId).single()
  if (!file || file.subject_id !== id) return NextResponse.json({ ok: true }) // idempotent
  await service.storage.from(SUBJECT_FILES_BUCKET).remove([file.storage_path])
  await service.from('subject_files').delete().eq('id', fileId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "src/app/api/subjects/[id]/files/[fileId]/route.test.ts"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/subjects/[id]/files/[fileId]/"
git commit -m "feat(files): download (signed, confidentiel-gated) + delete endpoints"
```

---

### Task 5: Charger les fichiers dans la page sujet (RSC)

**Files:**
- Modify: `src/app/[locale]/[lab]/paper/[id]/page.tsx` (le `Promise.all`, ~lignes 29-40, et le JSX `<PaperView ... />`)
- Modify: `src/components/paper/PaperView.tsx` (Props + passage à `FilesPanel`)

**Interfaces:**
- Consumes: type `SubjectFile` (Task 1).
- Produces: `PaperView` accepte une prop `files: SubjectFile[]` et la transmet à `FilesPanel`.

- [ ] **Step 1: Charger `subject_files` dans le RSC**

Dans `src/app/[locale]/[lab]/paper/[id]/page.tsx`, ajouter l'import du type et une requête au `Promise.all`. Remplacer le tableau déstructuré et son `Promise.all` :

```tsx
  const [{ data: subject }, { data: navRows }, { data: members }, { data: tasksRaw },
    { data: comments }, { data: links }, { data: files }] = await Promise.all([
    service.from('subjects').select('*').eq('id', id).single(),
    navQuery.order('ordre', { ascending: true }),
    service.from('members').select('id,prenom,nom,photo_url').eq('labo', lab),
    service.from('tasks')
      .select('*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)')
      .eq('sujet_id', id).order('date_creation', { ascending: true }),
    service.from('comments').select('*').eq('sujet_id', id).order('created_at', { ascending: true }),
    service.from('dropbox_links').select('*').eq('subject_id', id),
    service.from('subject_files').select('*').eq('subject_id', id).order('created_at', { ascending: true }),
  ])
```

Et passer la prop dans le JSX :

```tsx
      links={(links ?? []) as DropboxLink[]}
      files={(files ?? []) as SubjectFile[]}
      isMember={isMember}
```

Ajouter `SubjectFile` à l'import de types en haut du fichier :

```tsx
import type { Lab, Subject, MemberRef, Comment, DropboxLink, SubjectFile } from '@/types'
```

- [ ] **Step 2: Étendre `PaperView`**

Dans `src/components/paper/PaperView.tsx` :

```tsx
import type { Lab, Subject, MemberRef, TaskWithRelations, Comment, DropboxLink, SubjectFile } from '@/types'
```

Ajouter à `type Props` (après `links: DropboxLink[]`) :

```tsx
  files: SubjectFile[]
```

Ajouter `files` à la déstructuration des props :

```tsx
  locale, lab, subject, navSubjects, members, tasks: initialTasks, initialComments, links, files, isMember,
```

Et passer à `FilesPanel` :

```tsx
          <FilesPanel
            links={links} files={files} subjectId={subject.id} isMember={isMember}
            open={panels.files} onToggleOpen={() => toggle('files')}
          />
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — exit 0. (`FilesPanel` n'accepte pas encore `files/subjectId/isMember` → l'erreur de type sera résolue en Task 6 ; si tsc échoue ici, c'est attendu, passer à Task 6 puis revérifier. Ne pas committer un état rouge.)

- [ ] **Step 4: Commit (après Task 6 vert)**

> Note : committer Task 5 + Task 6 ensemble (l'API de `FilesPanel` change en Task 6). Voir Task 6, Step 8.

---

### Task 6: UI `FilesPanel` — fichiers déposés, upload, suppression + i18n

**Files:**
- Modify: `src/components/paper/FilesPanel.tsx`
- Modify: `messages/en.json` (namespace `paper`)
- Modify: `messages/fr.json` (namespace `paper`)

**Interfaces:**
- Consumes: `validateUpload`, `SUBJECT_FILES_BUCKET` (Task 1) ; `createClient` (browser) ; `useToast`, `useRouter` ; endpoints Tasks 2-4 ; type `SubjectFile`.
- Produces: `FilesPanel` accepte `{ links: DropboxLink[]; files: SubjectFile[]; subjectId: string; isMember: boolean; open: boolean; onToggleOpen: () => void }`.

- [ ] **Step 1: Ajouter les clés i18n (en)**

Dans `messages/en.json`, sous le namespace `paper`, ajouter (à côté de `filesLinks`/`dropboxSub`) :

```json
    "filesUploaded": "Uploaded files",
    "uploadButton": "Upload a file",
    "uploading": "Uploading…",
    "uploadFailed": "Upload failed",
    "fileTooLarge": "File too large (max 50 MB)",
    "fileTypeNotAllowed": "File type not allowed",
    "deleteFile": "Delete file",
    "confirmDeleteFile": "Delete this file? This cannot be undone."
```

- [ ] **Step 2: Ajouter les clés i18n (fr)**

Dans `messages/fr.json`, sous le namespace `paper`, mêmes clés :

```json
    "filesUploaded": "Fichiers déposés",
    "uploadButton": "Déposer un fichier",
    "uploading": "Envoi en cours…",
    "uploadFailed": "Échec de l'envoi",
    "fileTooLarge": "Fichier trop volumineux (max 50 Mo)",
    "fileTypeNotAllowed": "Type de fichier non autorisé",
    "deleteFile": "Supprimer le fichier",
    "confirmDeleteFile": "Supprimer ce fichier ? Action irréversible."
```

- [ ] **Step 3: Verify i18n parity**

Run: `npx vitest run src/messages-parity.test.ts`
Expected: PASS (clés en/fr à parité).

- [ ] **Step 4: Réécrire `FilesPanel`**

Replace `src/components/paper/FilesPanel.tsx`:

```tsx
'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { validateUpload, SUBJECT_FILES_BUCKET, MAX_FILE_BYTES } from '@/lib/subjects/file-upload'
import type { DropboxLink, SubjectFile } from '@/types'

type Props = {
  links: DropboxLink[]
  files: SubjectFile[]
  subjectId: string
  isMember: boolean
  open: boolean
  onToggleOpen: () => void
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`
  return `${bytes} B`
}

export function FilesPanel({ links, files, subjectId, isMember, open, onToggleOpen }: Props) {
  const t = useTranslations('paper')
  const router = useRouter()
  const { addToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SubjectFile | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    if (!file) return
    const v = validateUpload({ mimeType: file.type, sizeBytes: file.size, fileName: file.name })
    if (!v.ok) { addToast(file.size > MAX_FILE_BYTES ? t('fileTooLarge') : t('fileTypeNotAllowed'), 'error'); return }
    setBusy(true)
    try {
      const signRes = await fetch(`/api/subjects/${subjectId}/files/sign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: file.name, mime_type: file.type, size_bytes: file.size }),
      })
      if (!signRes.ok) throw new Error('sign')
      const { path, token } = await signRes.json()
      const supabase = createClient()
      const up = await supabase.storage.from(SUBJECT_FILES_BUCKET).uploadToSignedUrl(path, token, file)
      if (up.error) throw new Error('upload')
      const regRes = await fetch(`/api/subjects/${subjectId}/files`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size }),
      })
      if (!regRes.ok) throw new Error('register')
      router.refresh()
    } catch {
      addToast(t('uploadFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    const f = pendingDelete
    setPendingDelete(null)
    if (!f) return
    const res = await fetch(`/api/subjects/${subjectId}/files/${f.id}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
    else addToast(t('uploadFailed'), 'error')
  }

  return (
    <section style={{
      flex: 'none', pointerEvents: 'auto', background: '#2f4486', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(150,180,255,0.18)', borderRadius: 14, boxShadow: '0 22px 60px -18px rgba(0,5,30,0.75)', overflow: 'hidden',
    }}>
      <button onClick={onToggleOpen} className="text-fame-text-light" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4cd2a0' }} />{t('filesLinks')}
        </span>
        <span className="font-mono text-fame-text-muted" style={{ fontSize: 11 }}>{links.length + files.length} {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding: '2px 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Liens Dropbox (inchangé) */}
          {links.map(l => (
            <a key={l.id} href={`https://www.dropbox.com/home${l.node_path}`} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10, textDecoration: 'none',
              border: '1px solid rgba(150,180,255,0.12)', background: 'rgba(31,46,92,0.5)',
            }}>
              <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'rgba(76,210,160,0.2)', color: '#74e0bb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>◷</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="text-fame-text-light" style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.node_name}</span>
              </span>
              <span style={{ color: '#8ea4df', fontSize: 13 }}>↗</span>
            </a>
          ))}

          {/* Fichiers déposés */}
          {files.length > 0 && (
            <p className="font-mono text-fame-text-muted" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 2px 0' }}>{t('filesUploaded')}</p>
          )}
          {files.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 11px', borderRadius: 10,
              border: '1px solid rgba(150,180,255,0.12)', background: 'rgba(31,46,92,0.5)',
            }}>
              <a href={`/api/subjects/${subjectId}/files/${f.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
                <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'rgba(120,160,255,0.2)', color: '#9fb2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>⬇</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="text-fame-text-light" style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file_name}</span>
                  <span className="font-mono text-fame-text-muted" style={{ fontSize: 10 }}>{fmtSize(f.size_bytes)}</span>
                </span>
              </a>
              {isMember && (
                <button onClick={() => setPendingDelete(f)} aria-label={t('deleteFile')} style={{ flex: 'none', background: 'none', border: 'none', color: '#ff8a7d', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>
          ))}

          {links.length === 0 && files.length === 0 && (
            <p className="font-mono text-fame-text-muted" style={{ fontSize: 10, padding: '4px 2px' }}>{t('dropboxSub')}</p>
          )}

          {/* Dépôt (membres) */}
          {isMember && (
            <>
              <input ref={inputRef} type="file" hidden onChange={onPick}
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx,.csv,.txt" />
              <button onClick={() => inputRef.current?.click()} disabled={busy} style={{
                marginTop: 4, padding: '9px 11px', borderRadius: 10, cursor: busy ? 'default' : 'pointer',
                border: '1px dashed rgba(150,180,255,0.35)', background: 'rgba(31,46,92,0.3)', color: '#eef3ff',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, opacity: busy ? 0.6 : 1,
              }}>{busy ? t('uploading') : `+ ${t('uploadButton')}`}</button>
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        message={t('confirmDeleteFile')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
```

> **Signatures confirmées :** `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`) = `{ open, message, onConfirm, onCancel, danger? }` (toujours monté, piloté par `open`). `useToast()` = `{ addToast(message: string, level: 'success' | 'error' | 'info') }` (cf. `SubjectGrid.tsx`).

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — exit 0.

- [ ] **Step 6: Verify lint**

Run: `npx eslint`
Expected: exit 0 (0 erreur).

- [ ] **Step 7: Verify build**

Run: `npx next build`
Expected: exit 0.

- [ ] **Step 8: Commit (Tasks 5 + 6 ensemble)**

```bash
git add src/app/[locale]/[lab]/paper/[id]/page.tsx src/components/paper/PaperView.tsx src/components/paper/FilesPanel.tsx messages/en.json messages/fr.json
git commit -m "feat(files): FilesPanel upload/download/delete UI + load subject_files in paper page"
```

---

### Task 7: Vérification finale + STATUS

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Suite complète**

Run: `npx vitest run`
Expected: PASS (toute la suite verte, incl. les ~22 nouveaux tests files).

- [ ] **Step 2: typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint && npx next build`
Expected: tous exit 0.

- [ ] **Step 3: Mettre à jour STATUS**

Dans `docs/STATUS.md`, ajouter une entrée sous « Où on en est » :

```markdown
- **Upload de fichiers sur fiche sujet** (branche `feat/subject-file-upload`) : dépôt direct (≤50 Mo, docs courants) en complément des liens Dropbox. Bucket privé `subject-files` + table `subject_files` (**migration `010` à appliquer en BDD**). Upload 3-temps signé (sign → upload direct → register), download via endpoint app (URL signée 60 s, gate `confidentiel`). Spec `docs/superpowers/specs/2026-06-28-subject-file-upload-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs(status): subject file upload feature"
```

---

## Notes de déploiement (hors code)

- **Appliquer `supabase/migrations/010_subject_files.sql`** en BDD (dev + prod) avant d'utiliser la fonctionnalité — sinon `sign`/`register` échouent (table/bucket absents).
- Aucune nouvelle variable d'environnement.
- **Vérification manuelle navigateur** (nécessite Storage réel + migration appliquée) : déposer un PDF sur une fiche, le voir apparaître, le télécharger (membre et visiteur sur sujet public), le supprimer ; confirmer qu'un visiteur ne voit rien sur un sujet confidentiel.
