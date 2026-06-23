# FAME Website — Implementation Plan (Part 1: Foundation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy the complete FAME research-lab website — internal coordination tool + public showcase for two independent labs (Paris and Montréal).

**Architecture:** Next.js 16 App Router with locale-based routing (`/[locale]/[lab]/...`), Supabase as the only database/auth backend, and a clean API-route layer between the React UI and Supabase. All data mutations go through `/api/` routes (server-side Supabase service client) so Row Level Security is enforced uniformly; read-heavy pages use React Server Components with the server Supabase client.

**Tech Stack:** Next.js 16.2.9 · React 19 · TypeScript · Supabase (PostgreSQL + Auth + Storage) · next-intl 4.13 · Tailwind CSS · D3.js + TopoJSON (globe) · Resend (email) · Dropbox JS SDK (server-only) · Vercel (hosting)

## Global Constraints

- Node ≥ 20, npm ≥ 10
- All UI strings must use `next-intl` `useTranslations()` / `getTranslations()` — no hardcoded copy
- Locales: `en` (default) and `fr` — keys live in `messages/en.json` and `messages/fr.json`
- Labs: `paris` | `montreal` — always lowercase in code, URL, and DB
- Lab slug is validated in every route handler; invalid lab → 404
- Roles: `visitor` (unauthenticated) · `member` · `admin`
- Auth: Supabase email+password, sessions via httpOnly cookie managed by `@supabase/ssr`
- Token Dropbox **never** in client bundle — server-only env var
- Desktop-first v1; no responsive work until v2
- `NEXT_PUBLIC_` prefix only for Supabase URL + anon key — all other secrets are server-only
- Every DB write goes through `/api/` routes using the service-role client
- All `params` in App Router are `Promise<{...}>` — always `await params`

---

## File Map (complete project structure)

```
src/
  app/
    layout.tsx                          ← root layout (returns children only)
    page.tsx                            ← redirect to /en
    globals.css                         ← FAME tokens, animations (done)
    [locale]/
      layout.tsx                        ← html/body + NextIntlClientProvider
      page.tsx                          ← Home globe
      auth/
        login/page.tsx                  ← Sign-in form
        activate/[token]/page.tsx       ← Member activation (set password)
      [lab]/
        layout.tsx                      ← TopBar + auth context for lab
        page.tsx                        ← Lab grid
        paper/[id]/page.tsx             ← Paper detail
        tasks/page.tsx                  ← Kanban board
        publications/page.tsx           ← Publication list
        team/page.tsx                   ← Trombinoscope
        data/page.tsx                   ← Dropbox explorer (member only)
        prompts/page.tsx                ← Prompt library (member only)
        propose/page.tsx                ← Proposal form
      admin/
        proposals/page.tsx              ← Admin proposals dashboard
      privacy/page.tsx                  ← RGPD policy
    api/
      auth/
        sign-in/route.ts
        sign-out/route.ts
        activate/route.ts
      subjects/
        route.ts                        ← GET list, POST create
        [id]/route.ts                   ← GET, PATCH, DELETE
        [id]/order/route.ts             ← PATCH (reorder grid)
      tasks/
        route.ts                        ← GET list, POST create
        [id]/route.ts                   ← GET, PATCH, DELETE
        [id]/subtasks/route.ts          ← POST subtask, PATCH subtask
        [id]/claim/route.ts             ← POST (toggle assignee self)
      comments/
        route.ts                        ← POST create
        [id]/route.ts                   ← DELETE
      publications/
        route.ts                        ← GET, POST
        [id]/route.ts                   ← PATCH, DELETE
      members/
        route.ts                        ← GET list
        [id]/route.ts                   ← PATCH, DELETE
        invite/route.ts                 ← POST (create + send invite email)
      prompts/
        route.ts                        ← GET, POST
        [id]/route.ts                   ← PATCH, DELETE
      proposals/
        route.ts                        ← GET, POST
        [id]/route.ts                   ← PATCH (accept/reject)
        [id]/convert/route.ts           ← POST (convert to subject)
      dropbox/
        tree/route.ts                   ← GET (member only)
        links/route.ts                  ← GET, POST
        links/[id]/route.ts             ← DELETE
  components/
    ui/
      Avatar.tsx                        ← Colored initials avatar
      StatusBadge.tsx                   ← Colored status pill
      SegmentedBar.tsx                  ← N-segment progress bar (reused everywhere)
      Modal.tsx                         ← Generic overlay wrapper
      Toast.tsx                         ← Top-center toast notification
      ConfirmDialog.tsx                 ← Destructive action confirm modal
      EditModeToggle.tsx                ← Pencil toggle button
    layout/
      TopBar.tsx                        ← Nav + lab context + auth state
      NavMenu.tsx                       ← Hamburger dropdown
      LanguageSwitcher.tsx              ← EN / FR pill toggle
      AuthButton.tsx                    ← Sign in / Sign out button
    globe/
      Globe.tsx                         ← D3 interactive globe (client)
      StarField.tsx                     ← Canvas star background
      LabPin.tsx                        ← Pulsing SVG pin
    lab/
      SubjectCard.tsx                   ← A4 poster card (hover zoom)
      SubjectGrid.tsx                   ← Grid with drag-to-reorder
      FilterSidebar.tsx                 ← Collapsible filter panel
      AddSubjectModal.tsx               ← Create/edit subject form
    paper/
      PaperSheet.tsx                    ← Central A4 paper (editable inline)
      TasksPanel.tsx                    ← Left floating panel
      FilesPanel.tsx                    ← Right panel tab: files & links
      CommentsPanel.tsx                 ← Right panel tab: comments
      PaperNav.tsx                      ← Bottom thumbnail strip
    tasks/
      KanbanBoard.tsx                   ← Outer scroll + column layout
      KanbanColumn.tsx                  ← Per-subject column
      TaskCard.tsx                      ← Single task card
      TaskModal.tsx                     ← Detail modal (subtasks, assignees, history)
      SubtaskList.tsx                   ← Checklist with toggle
      AssigneeList.tsx                  ← Assignee avatars + add/remove
      TaskHistory.tsx                   ← Collapsible history log
    publications/
      PublicationList.tsx               ← Grouped by year
      PublicationCard.tsx               ← Single entry row
      PublicationFilters.tsx            ← Type / author / year / search
      AddPublicationModal.tsx
    team/
      MemberGrid.tsx                    ← Sections by role
      MemberCard.tsx                    ← Photo or avatar + info
      InviteModal.tsx                   ← Admin invite form
      EditProfileModal.tsx              ← Self-edit profile form
    data/
      DropboxTree.tsx                   ← Recursive file tree
      DropboxNode.tsx                   ← Single row (folder | file)
      LinkPanel.tsx                     ← Right panel for subject/task linking
    prompts/
      PromptList.tsx
      PromptCard.tsx                    ← Copy + edit + delete
      PromptTypeSidebar.tsx
    propose/
      ProposalForm.tsx
      ProposalTracker.tsx               ← Session proposals sidebar
    admin/
      ProposalTable.tsx
  lib/
    supabase/
      client.ts                         ← Browser client (done)
      server.ts                         ← Server + service role clients (done)
    auth.ts                             ← getSession(), requireMember(), requireAdmin()
    resend/
      send-invitation.ts
      send-proposal-result.ts
    dropbox/
      client.ts                         ← Dropbox SDK init (server-only)
      tree.ts                           ← Build JSON tree from API response
  types/
    index.ts                            ← All shared TypeScript types
  i18n/
    routing.ts                          ← done
    request.ts                          ← done
  middleware.ts                         ← done (will be extended for auth guards)
  scripts/
    seed-admin.ts                       ← Creates luca.desjardin@dauphine.eu
supabase/
  migrations/
    001_initial_schema.sql              ← All tables + indexes + RLS policies
messages/
  en.json                               ← done
  fr.json                               ← done
```

---

## Task 1: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Lab`, `Role`, `SubjectStatus`, `TaskStatus`, `Difficulty`, `PromptTarget`, `ProposalStatus`, `PublicationType`, `Subject`, `Task`, `Subtask`, `TaskAssignee`, `SubtaskAssignee`, `TaskSubject`, `TaskHistory`, `Comment`, `Member`, `Publication`, `Prompt`, `Proposal`, `DropboxLink`, `Invitation` — used by every other task

- [ ] **Step 1: Write `src/types/index.ts`**

```typescript
export type Lab = 'paris' | 'montreal'
export type Role = 'direction' | 'researcher' | 'phd' | 'engineering'
export type SubjectStatus = 'active' | 'done' | 'on-hold'
export type TaskStatus = 'to-do' | 'in-progress' | 'done'
export type Difficulty = 'easy' | 'intermediate' | 'advanced'
export type PromptTarget = 'subject' | 'publication' | 'data' | 'member' | 'task'
export type ProposalStatus = 'pending' | 'accepted' | 'rejected'
export type PublicationType = 'article' | 'preprint' | 'conference' | 'working-paper'

export interface Member {
  id: string
  prenom: string
  nom: string
  email: string
  role: Role
  labo: Lab
  domaines: string[]
  photo_url: string | null
  is_admin: boolean
  activated_at: string | null
  created_at: string
}

export interface Subject {
  id: string
  labo: Lab
  titre: string
  kicker: string
  statut: SubjectStatus
  context: string
  method: string
  results: string
  keywords: string[]
  auteurs: string[]           // array of member IDs
  dimensions: {
    method: string
    data: string
    theory: string
    writing: string
  }
  ordre: number
  created_at: string
  updated_at: string
}

export interface SubjectWithProgress extends Subject {
  tasks_total: number
  tasks_done: number
  members: Pick<Member, 'id' | 'prenom' | 'nom' | 'photo_url'>[]
}

export interface Task {
  id: string
  labo: Lab
  titre: string
  description: string
  statut: TaskStatus
  difficulte: Difficulty
  sujet_id: string
  date_creation: string
  date_echeance: string | null
}

export interface TaskWithRelations extends Task {
  assignees: Pick<Member, 'id' | 'prenom' | 'nom' | 'photo_url'>[]
  subtasks: Subtask[]
  subject_titre?: string
}

export interface Subtask {
  id: string
  task_id: string
  label: string
  done: boolean
  ordre: number
  assignees: Pick<Member, 'id' | 'prenom' | 'nom' | 'photo_url'>[]
}

export interface TaskHistory {
  id: string
  task_id: string
  auteur_id: string
  auteur_nom: string
  champ: string
  valeur_avant: unknown
  valeur_apres: unknown
  created_at: string
}

export interface Comment {
  id: string
  sujet_id: string
  auteur_type: 'visitor' | 'member'
  auteur_nom: string
  membre_id: string | null
  texte: string
  created_at: string
}

export interface Publication {
  id: string
  labo: Lab
  titre: string
  auteurs: string[]
  annee: number
  type: PublicationType
  revue_ou_conf: string | null
  lien: string | null
  created_at: string
}

export interface Prompt {
  id: string
  labo: Lab
  titre: string
  type_cible: PromptTarget
  texte: string
  created_by: string
  created_at: string
}

export interface Proposal {
  id: string
  labo: Lab
  titre: string
  domaine: string
  difficulte: Difficulty
  description: string
  proposant_prenom: string
  proposant_nom: string
  proposant_email: string | null
  statut: ProposalStatus
  commentaire_admin: string | null
  created_at: string
  traitee_at: string | null
  traitee_par: string | null
}

export interface DropboxLink {
  id: string
  node_id: string
  node_path: string
  node_name: string
  labo: Lab
  subject_id: string | null
  task_id: string | null
  created_at: string
}

export interface DropboxNode {
  id: string
  name: string
  path_lower: string
  is_folder: boolean
  children?: DropboxNode[]
  linked?: boolean
}

export interface Invitation {
  id: string
  email: string
  token: string
  member_id: string
  expires_at: string
  created_at: string
}

export interface Session {
  user: {
    id: string
    email: string
  }
  member: Member | null
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add complete TypeScript types for all data models"
```

---

## Task 2: Database Schema — SQL Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Interfaces:**
- Consumes: types from Task 1 (as reference for column names)
- Produces: all DB tables — referenced by every API route

- [ ] **Step 1: Create the SQL migration file**

```sql
-- supabase/migrations/001_initial_schema.sql
-- Run in Supabase SQL editor or via supabase CLI

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── MEMBERS ────────────────────────────────────────────────────────────────
create table members (
  id           uuid primary key default gen_random_uuid(),
  prenom       text not null,
  nom          text not null,
  email        text not null unique,
  role         text not null check (role in ('direction','researcher','phd','engineering')),
  labo         text not null check (labo in ('paris','montreal')),
  domaines     text[] not null default '{}',
  photo_url    text,
  is_admin     boolean not null default false,
  password_hash text,
  activated_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ─── INVITATIONS ────────────────────────────────────────────────────────────
create table invitations (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  token      text not null unique,
  member_id  uuid not null references members(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ─── SUBJECTS ───────────────────────────────────────────────────────────────
create table subjects (
  id         uuid primary key default gen_random_uuid(),
  labo       text not null check (labo in ('paris','montreal')),
  titre      text not null,
  kicker     text not null default '',
  statut     text not null default 'active' check (statut in ('active','done','on-hold')),
  context    text not null default '',
  method     text not null default '',
  results    text not null default '',
  keywords   text[] not null default '{}',
  auteurs    uuid[] not null default '{}',
  dimensions jsonb not null default '{"method":"","data":"","theory":"","writing":""}',
  ordre      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subjects_labo on subjects(labo);
create index idx_subjects_ordre on subjects(labo, ordre);

-- ─── TASKS ──────────────────────────────────────────────────────────────────
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  labo           text not null check (labo in ('paris','montreal')),
  titre          text not null,
  description    text not null default '',
  statut         text not null default 'to-do' check (statut in ('to-do','in-progress','done')),
  difficulte     text not null default 'easy' check (difficulte in ('easy','intermediate','advanced')),
  sujet_id       uuid not null references subjects(id) on delete cascade,
  date_creation  timestamptz not null default now(),
  date_echeance  timestamptz
);
create index idx_tasks_labo on tasks(labo);
create index idx_tasks_sujet on tasks(sujet_id);

-- ─── TASK_ASSIGNEES ─────────────────────────────────────────────────────────
create table task_assignees (
  task_id   uuid not null references tasks(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (task_id, member_id)
);

-- ─── TASK_SUBJECTS (future many-to-many) ────────────────────────────────────
create table task_subjects (
  task_id    uuid not null references tasks(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  primary key (task_id, subject_id)
);

-- ─── SUBTASKS ───────────────────────────────────────────────────────────────
create table subtasks (
  id      uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  label   text not null,
  done    boolean not null default false,
  ordre   integer not null default 0
);
create index idx_subtasks_task on subtasks(task_id);

-- ─── SUBTASK_ASSIGNEES ──────────────────────────────────────────────────────
create table subtask_assignees (
  subtask_id uuid not null references subtasks(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  primary key (subtask_id, member_id)
);

-- ─── TASK_HISTORY ───────────────────────────────────────────────────────────
create table task_history (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  auteur_id    uuid references members(id) on delete set null,
  auteur_nom   text not null,
  champ        text not null,
  valeur_avant jsonb,
  valeur_apres jsonb,
  created_at   timestamptz not null default now()
);
create index idx_task_history_task on task_history(task_id);

-- ─── COMMENTS ───────────────────────────────────────────────────────────────
create table comments (
  id           uuid primary key default gen_random_uuid(),
  sujet_id     uuid not null references subjects(id) on delete cascade,
  auteur_type  text not null check (auteur_type in ('visitor','member')),
  auteur_nom   text not null,
  membre_id    uuid references members(id) on delete set null,
  texte        text not null,
  created_at   timestamptz not null default now()
);
create index idx_comments_sujet on comments(sujet_id);

-- ─── PUBLICATIONS ───────────────────────────────────────────────────────────
create table publications (
  id            uuid primary key default gen_random_uuid(),
  labo          text not null check (labo in ('paris','montreal')),
  titre         text not null,
  auteurs       text[] not null default '{}',
  annee         integer not null,
  type          text not null check (type in ('article','preprint','conference','working-paper')),
  revue_ou_conf text,
  lien          text,
  created_at    timestamptz not null default now()
);
create index idx_publications_labo on publications(labo);

-- ─── PROMPTS ────────────────────────────────────────────────────────────────
create table prompts (
  id          uuid primary key default gen_random_uuid(),
  labo        text not null check (labo in ('paris','montreal')),
  titre       text not null,
  type_cible  text not null check (type_cible in ('subject','publication','data','member','task')),
  texte       text not null,
  created_by  uuid references members(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── PROPOSALS ──────────────────────────────────────────────────────────────
create table proposals (
  id                  uuid primary key default gen_random_uuid(),
  labo                text not null check (labo in ('paris','montreal')),
  titre               text not null,
  domaine             text not null,
  difficulte          text not null check (difficulte in ('easy','intermediate','advanced')),
  description         text not null,
  proposant_prenom    text not null,
  proposant_nom       text not null,
  proposant_email     text,
  statut              text not null default 'pending' check (statut in ('pending','accepted','rejected')),
  commentaire_admin   text,
  created_at          timestamptz not null default now(),
  traitee_at          timestamptz,
  traitee_par         uuid references members(id) on delete set null
);

-- ─── DROPBOX_LINKS ──────────────────────────────────────────────────────────
create table dropbox_links (
  id         uuid primary key default gen_random_uuid(),
  node_id    text not null,
  node_path  text not null,
  node_name  text not null,
  labo       text not null check (labo in ('paris','montreal')),
  subject_id uuid references subjects(id) on delete cascade,
  task_id    uuid references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chk_linked check (subject_id is not null or task_id is not null)
);
create index idx_dropbox_links_labo on dropbox_links(labo);
create index idx_dropbox_links_subject on dropbox_links(subject_id);

-- ─── AUTO-UPDATE updated_at ─────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger subjects_updated_at
  before update on subjects
  for each row execute function update_updated_at();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────────────────
-- NOTE: We use the service-role client in all API routes, which bypasses RLS.
-- RLS below is a defense-in-depth measure (blocks direct DB access).
-- All application-level auth is enforced in the /api/ route handlers.

alter table members enable row level security;
alter table subjects enable row level security;
alter table tasks enable row level security;
alter table task_assignees enable row level security;
alter table subtasks enable row level security;
alter table subtask_assignees enable row level security;
alter table task_history enable row level security;
alter table comments enable row level security;
alter table publications enable row level security;
alter table prompts enable row level security;
alter table proposals enable row level security;
alter table dropbox_links enable row level security;
alter table invitations enable row level security;
alter table task_subjects enable row level security;

-- Service role bypasses all RLS (used by API routes)
-- Anonymous/authenticated roles are blocked by default (no permissive policies)
-- This means all reads/writes must go through /api/ routes using the service key
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Go to: Supabase dashboard → SQL Editor → paste the SQL above → Run.

Expected: "Success. No rows returned." for each statement. Check the Table Editor — you should see: `members`, `subjects`, `tasks`, `task_assignees`, `task_subjects`, `subtasks`, `subtask_assignees`, `task_history`, `comments`, `publications`, `prompts`, `proposals`, `dropbox_links`, `invitations`.

- [ ] **Step 3: Commit the SQL file**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: initial database schema — all tables, indexes, RLS"
```

---

## Task 3: Admin Seed Script

**Files:**
- Create: `src/scripts/seed-admin.ts`

**Interfaces:**
- Consumes: `Member` type, `createServiceClient()` from `src/lib/supabase/server.ts`
- Produces: row in `members` table for `luca.desjardin@dauphine.eu`

Note: Supabase Auth handles password hashing internally. We create the Supabase Auth user first, then insert the profile row in `members`.

- [ ] **Step 1: Write the seed script**

```typescript
// src/scripts/seed-admin.ts
// Run: npx tsx src/scripts/seed-admin.ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'luca.desjardin@dauphine.eu'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? ''

if (!ADMIN_PASSWORD) {
  console.error('Set SEED_ADMIN_PASSWORD in .env.local before running this script.')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  })
  if (authError && !authError.message.includes('already been registered')) {
    console.error('Auth error:', authError.message)
    process.exit(1)
  }
  const userId = authData?.user?.id

  // 2. Check if member profile already exists
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .single()

  if (existing) {
    console.log('Admin member profile already exists.')
    return
  }

  // 3. Insert member profile
  const { error: memberError } = await supabase.from('members').insert({
    id: userId,
    prenom: 'Luca',
    nom: 'Desjardin',
    email: ADMIN_EMAIL,
    role: 'direction',
    labo: 'paris',
    domaines: [],
    is_admin: true,
    activated_at: new Date().toISOString(),
  })

  if (memberError) {
    console.error('Member insert error:', memberError.message)
    process.exit(1)
  }

  console.log(`Admin created: ${ADMIN_EMAIL}`)
}

main()
```

- [ ] **Step 2: Add script to package.json**

In `package.json`, add inside `"scripts"`:
```json
"seed:admin": "npx tsx src/scripts/seed-admin.ts"
```

- [ ] **Step 3: Add `SEED_ADMIN_PASSWORD` to `.env.local`**

```
SEED_ADMIN_PASSWORD=<choose a strong initial password>
```

- [ ] **Step 4: Install tsx (dev dependency for running TS scripts)**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm install --save-dev tsx dotenv
```

Expected: `added N packages`

- [ ] **Step 5: Run the seed script**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm run seed:admin
```

Expected: `Admin created: luca.desjardin@dauphine.eu`

Verify in Supabase dashboard → Table Editor → `members` → should show one row.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/seed-admin.ts package.json package-lock.json
git commit -m "feat: admin seed script — creates initial admin account"
```

---

## Task 4: Auth Helpers + Protected Middleware

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/sign-in/route.ts`
- Create: `src/app/api/auth/sign-out/route.ts`
- Create: `src/app/api/auth/activate/route.ts`
- Create: `src/app/[locale]/auth/login/page.tsx`
- Create: `src/app/[locale]/auth/activate/[token]/page.tsx`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: `createServerClient()` from `src/lib/supabase/server.ts`, `Member` type
- Produces:
  - `getSession(req?): Promise<Session | null>` — used in every API route to identify caller
  - `requireMember(req): Promise<{ session: Session; member: Member }>` — throws 401 if unauthenticated
  - `requireAdmin(req): Promise<{ session: Session; member: Member }>` — throws 403 if not admin

- [ ] **Step 1: Write `src/lib/auth.ts`**

```typescript
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from './supabase/server'
import type { Member, Session } from '@/types'

export async function getSession(): Promise<Session | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const { data: member } = await service
    .from('members')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user: { id: user.id, email: user.email! }, member: member ?? null }
}

export async function requireMember(): Promise<{ session: Session; member: Member }> {
  const session = await getSession()
  if (!session?.member) {
    throw new AuthError(401, 'Authentication required')
  }
  return { session, member: session.member }
}

export async function requireAdmin(): Promise<{ session: Session; member: Member }> {
  const { session, member } = await requireMember()
  if (!member.is_admin) {
    throw new AuthError(403, 'Admin access required')
  }
  return { session, member }
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  console.error(err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

- [ ] **Step 2: Write `src/app/api/auth/sign-in/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/app/api/auth/sign-out/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Write `src/app/api/auth/activate/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient()

  // Validate token
  const { data: invitation, error: invErr } = await service
    .from('invitations')
    .select('*, members(*)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (invErr || !invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 400 })
  }

  // Update Supabase Auth password
  const { error: pwErr } = await service.auth.admin.updateUserById(
    invitation.member_id,
    { password }
  )
  if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 })

  // Mark member as activated
  await service.from('members').update({ activated_at: new Date().toISOString() })
    .eq('id', invitation.member_id)

  // Delete the invitation
  await service.from('invitations').delete().eq('id', invitation.id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Write the login page `src/app/[locale]/auth/login/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

export default function LoginPage() {
  const t = useTranslations('auth')
  const params = useParams<{ locale: string }>()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)
    if (!res.ok) {
      setError(t('signInError'))
      return
    }
    router.push(`/${params.locale}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-fame-navy flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-fame-sand p-10 rounded-xl w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="font-serif text-2xl text-fame-blue-dark">{t('signIn')}</h1>
        {error && <p className="text-fame-red text-sm">{error}</p>}
        <input
          type="email"
          placeholder={t('email')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="border border-fame-ecru rounded px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder={t('password')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="border border-fame-ecru rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-fame-blue text-white rounded py-2 text-sm font-medium hover:bg-fame-blue-dark disabled:opacity-50"
        >
          {loading ? t('loading') : t('signIn')}
        </button>
      </form>
    </div>
  )
}
```

Add the missing i18n key to `messages/en.json` and `messages/fr.json`:
```json
"auth": {
  "signInError": "Invalid email or password."
}
```
(FR: `"signInError": "Email ou mot de passe invalide."`)

- [ ] **Step 6: Add activate page `src/app/[locale]/auth/activate/[token]/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function ActivatePage() {
  const { token, locale } = useParams<{ token: string; locale: string }>()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    const res = await fetch('/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (!res.ok) {
      const { error: msg } = await res.json()
      setError(msg)
      return
    }
    setDone(true)
    setTimeout(() => router.push(`/${locale}/auth/login`), 2000)
  }

  if (done) return (
    <div className="min-h-screen bg-fame-navy flex items-center justify-center text-white">
      Account activated! Redirecting to login…
    </div>
  )

  return (
    <div className="min-h-screen bg-fame-navy flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-fame-sand p-10 rounded-xl w-full max-w-sm flex flex-col gap-4">
        <h1 className="font-serif text-2xl text-fame-blue-dark">Set your password</h1>
        {error && <p className="text-fame-red text-sm">{error}</p>}
        <input type="password" placeholder="New password (min 8 chars)" value={password}
          onChange={e => setPassword(e.target.value)} required className="border border-fame-ecru rounded px-3 py-2 text-sm" />
        <input type="password" placeholder="Confirm password" value={confirm}
          onChange={e => setConfirm(e.target.value)} required className="border border-fame-ecru rounded px-3 py-2 text-sm" />
        <button type="submit" className="bg-fame-blue text-white rounded py-2 text-sm font-medium hover:bg-fame-blue-dark">
          Activate account
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Extend middleware to protect member-only routes**

Replace `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { createServerClient as createSupabaseMiddlewareClient } from '@supabase/ssr'

const intlMiddleware = createMiddleware(routing)

const MEMBER_ONLY_PATHS = ['/data', '/prompts']
const ADMIN_ONLY_PATHS = ['/admin']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Strip locale prefix to check path
  const pathWithoutLocale = pathname.replace(/^\/(en|fr)/, '')
  const isApiRoute = pathname.startsWith('/api/')

  // Run intl middleware first (handles locale redirect / cookie)
  const intlResponse = intlMiddleware(request)

  // For API routes and static assets, skip auth checks
  if (isApiRoute) return intlResponse ?? NextResponse.next()

  // Check member-only pages
  const needsMember = MEMBER_ONLY_PATHS.some(p => pathWithoutLocale.includes(p))
  const needsAdmin = ADMIN_ONLY_PATHS.some(p => pathWithoutLocale.includes(p))

  if (needsMember || needsAdmin) {
    // Build response to set cookies from supabase-ssr
    const response = intlResponse ?? NextResponse.next()
    const supabase = createSupabaseMiddlewareClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cs) => cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const locale = pathname.split('/')[1] ?? 'en'
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url))
    }
  }

  return intlResponse ?? NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
```

- [ ] **Step 8: Build check**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm run build 2>&1 | tail -15
```

Expected: clean build, all routes listed.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/app/[locale]/auth/ src/middleware.ts messages/
git commit -m "feat: auth flow — sign-in, sign-out, member activation, protected routes"
```

---

## Task 5: Shared UI Components

**Files:**
- Create: `src/components/ui/Avatar.tsx`
- Create: `src/components/ui/StatusBadge.tsx`
- Create: `src/components/ui/SegmentedBar.tsx`
- Create: `src/components/ui/Modal.tsx`
- Create: `src/components/ui/Toast.tsx`
- Create: `src/components/ui/ConfirmDialog.tsx`
- Create: `src/components/ui/EditModeToggle.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: reusable primitives used by every page component

- [ ] **Step 1: Write `src/components/ui/Avatar.tsx`**

```typescript
type Props = { name: string; photoUrl?: string | null; size?: number }

const COLORS = ['#2f4486','#1e9b7e','#5768ac','#e8b149','#ff6f61','#c0473b']

function colorForName(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

export function Avatar({ name, photoUrl, size = 32 }: Props) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (photoUrl) {
    return <img src={photoUrl} alt={name} width={size} height={size}
      className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-mono font-bold select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: colorForName(name) }}
      title={name}
    >
      {initials}
    </span>
  )
}
```

- [ ] **Step 2: Write `src/components/ui/StatusBadge.tsx`**

```typescript
import type { SubjectStatus, TaskStatus } from '@/types'

const SUBJECT_COLORS: Record<SubjectStatus, string> = {
  'active':  'bg-fame-teal text-white',
  'done':    'bg-fame-blue text-white',
  'on-hold': 'bg-fame-gold text-white',
}

const TASK_COLORS: Record<TaskStatus, string> = {
  'to-do':      'bg-fame-ecru text-fame-blue-dark',
  'in-progress': 'bg-fame-slate text-white',
  'done':        'bg-fame-teal text-white',
}

export function SubjectStatusBadge({ status, label }: { status: SubjectStatus; label: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-widest ${SUBJECT_COLORS[status]}`}>
      {label}
    </span>
  )
}

export function TaskStatusBadge({ status, label }: { status: TaskStatus; label: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-widest ${TASK_COLORS[status]}`}>
      {label}
    </span>
  )
}
```

- [ ] **Step 3: Write `src/components/ui/SegmentedBar.tsx`**

```typescript
type Props = {
  total: number
  done: number
  height?: number
  colorDone?: string
  colorEmpty?: string
}

export function SegmentedBar({
  total,
  done,
  height = 4,
  colorDone = '#1e9b7e',
  colorEmpty = '#eceadf',
}: Props) {
  if (total === 0) return (
    <div style={{ height, background: colorEmpty, borderRadius: 2, width: '100%' }} />
  )
  const segments = Array.from({ length: total }, (_, i) => i < done)
  return (
    <div style={{ display: 'flex', gap: 2, height, width: '100%' }}>
      {segments.map((filled, i) => (
        <div key={i} style={{
          flex: 1,
          height,
          borderRadius: 2,
          background: filled ? colorDone : colorEmpty,
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/ui/Modal.tsx`**

```typescript
'use client'
import { useEffect } from 'react'

type Props = { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }

export function Modal({ open, onClose, children, title }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-fame-sand rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        style={{ animation: 'modalIn 0.15s ease' }}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-fame-ecru">
            <h2 className="font-serif text-lg text-fame-blue-dark">{title}</h2>
            <button onClick={onClose} className="text-fame-text-muted hover:text-fame-blue-dark text-xl leading-none">×</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/components/ui/Toast.tsx`**

```typescript
'use client'
import { createContext, useContext, useState, useCallback } from 'react'

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' }
type ToastCtx = { addToast: (message: string, type?: Toast['type']) => void }

const ToastContext = createContext<ToastCtx>({ addToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const COLOR: Record<Toast['type'], string> = {
    success: '#1e9b7e',
    error: '#c0473b',
    info: '#2f4486',
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            style={{ background: COLOR[t.type], animation: 'toastIn 0.2s ease' }}
            className="text-white text-sm font-mono px-5 py-3 rounded-lg shadow-xl pointer-events-auto"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
```

- [ ] **Step 6: Write `src/components/ui/ConfirmDialog.tsx`**

```typescript
import { Modal } from './Modal'
import { useTranslations } from 'next-intl'

type Props = {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({ open, message, onConfirm, onCancel, danger = true }: Props) {
  const t = useTranslations('common')
  return (
    <Modal open={open} onClose={onCancel}>
      <p className="text-fame-blue-dark mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 rounded text-sm border border-fame-ecru hover:bg-fame-ecru">
          {t('cancel')}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded text-sm text-white font-medium ${danger ? 'bg-fame-red hover:bg-fame-red/90' : 'bg-fame-blue hover:bg-fame-blue-dark'}`}
        >
          {t('confirm')}
        </button>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 7: Write `src/components/ui/EditModeToggle.tsx`**

```typescript
'use client'
import { useTranslations } from 'next-intl'

type Props = { active: boolean; onToggle: () => void }

export function EditModeToggle({ active, onToggle }: Props) {
  const t = useTranslations('lab')
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
        active
          ? 'bg-fame-blue text-white border-fame-blue'
          : 'bg-transparent text-fame-blue border-fame-blue hover:bg-fame-blue/10'
      }`}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
      </svg>
      {active ? t('editModeActive') : t('editMode')}
    </button>
  )
}
```

- [ ] **Step 8: Wrap locale layout with ToastProvider**

Modify `src/app/[locale]/layout.tsx`:

```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { ToastProvider } from '@/components/ui/Toast'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!routing.locales.includes(locale as 'en' | 'fr')) notFound()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Build check**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 10: Commit**

```bash
git add src/components/ui/ src/app/[locale]/layout.tsx
git commit -m "feat: shared UI primitives — Avatar, StatusBadge, SegmentedBar, Modal, Toast, ConfirmDialog, EditModeToggle"
```

---

## Task 6: TopBar + Navigation

**Files:**
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/NavMenu.tsx`
- Create: `src/components/layout/LanguageSwitcher.tsx`
- Create: `src/components/layout/AuthButton.tsx`
- Create: `src/app/[locale]/[lab]/layout.tsx`

**Interfaces:**
- Consumes: `getSession()` from `src/lib/auth.ts`, `useTranslations()` for nav keys, `Member` type
- Produces: `TopBar` component used in the lab layout — wraps all lab pages

- [ ] **Step 1: Write `src/components/layout/LanguageSwitcher.tsx`**

```typescript
'use client'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'

export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  function switchTo(newLocale: string) {
    // Replace /en/ or /fr/ prefix
    const newPath = pathname.replace(/^\/(en|fr)/, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <div className="flex items-center gap-1 font-mono text-xs">
      {(['en', 'fr'] as const).map(l => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={`px-2 py-0.5 rounded uppercase tracking-widest transition-colors ${
            locale === l
              ? 'bg-fame-blue text-white'
              : 'text-fame-text-muted hover:text-fame-text-light'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/layout/AuthButton.tsx`**

```typescript
'use client'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { Member } from '@/types'
import { Avatar } from '@/components/ui/Avatar'

type Props = { member: Member | null; locale: string }

export function AuthButton({ member, locale }: Props) {
  const t = useTranslations('auth')
  const router = useRouter()

  async function signOut() {
    await fetch('/api/auth/sign-out', { method: 'POST' })
    router.push(`/${locale}`)
    router.refresh()
  }

  if (!member) {
    return (
      <button
        onClick={() => router.push(`/${locale}/auth/login`)}
        className="text-xs font-mono text-fame-text-muted hover:text-fame-text-light px-2 py-1 rounded border border-fame-slate/30 hover:border-fame-slate transition-colors"
      >
        {t('signIn')}
      </button>
    )
  }

  return (
    <button
      onClick={signOut}
      className="flex items-center gap-2 text-xs font-mono text-fame-text-muted hover:text-fame-text-light"
      title={t('signOut')}
    >
      <Avatar name={`${member.prenom} ${member.nom}`} photoUrl={member.photo_url} size={28} />
      <span className="hidden md:inline">{member.prenom}</span>
    </button>
  )
}
```

- [ ] **Step 3: Write `src/components/layout/NavMenu.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import type { Member } from '@/types'

const NAV_LINKS = [
  { key: 'subjects', href: '' },
  { key: 'tasks', href: '/tasks' },
  { key: 'publications', href: '/publications' },
  { key: 'team', href: '/team' },
  { key: 'propose', href: '/propose' },
] as const

const MEMBER_LINKS = [
  { key: 'data', href: '/data' },
  { key: 'prompts', href: '/prompts' },
] as const

type Props = { locale: string; lab: string; member: Member | null }

export function NavMenu({ locale, lab, member }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('nav')
  const base = `/${locale}/${lab}`

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-fame-text-muted hover:text-fame-text-light font-mono text-xs uppercase tracking-widest"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
        </svg>
        {t('menu')}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 bg-fame-navy/95 backdrop-blur rounded-lg shadow-2xl border border-white/10 py-2 min-w-[160px]">
            {NAV_LINKS.map(({ key, href }) => (
              <Link
                key={key}
                href={`${base}${href}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-fame-text-muted hover:text-fame-text-light hover:bg-white/5 font-mono"
              >
                {t(key)}
              </Link>
            ))}
            {member && (
              <>
                <hr className="border-white/10 my-1" />
                {MEMBER_LINKS.map(({ key, href }) => (
                  <Link
                    key={key}
                    href={`${base}${href}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-fame-text-muted hover:text-fame-text-light hover:bg-white/5 font-mono"
                  >
                    {t(key)}
                  </Link>
                ))}
              </>
            )}
            {member?.is_admin && (
              <>
                <hr className="border-white/10 my-1" />
                <Link
                  href={`/${locale}/admin/proposals`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-fame-gold hover:text-fame-gold/80 hover:bg-white/5 font-mono"
                >
                  {t('admin') ?? 'Admin'}
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/layout/TopBar.tsx`**

```typescript
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavMenu } from './NavMenu'
import { AuthButton } from './AuthButton'

type Props = { locale: string; lab: string }

export async function TopBar({ locale, lab }: Props) {
  const session = await getSession()
  const member = session?.member ?? null

  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-12 flex items-center justify-between px-6"
      style={{ background: 'rgba(21,32,63,0.88)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <Link href={`/${locale}`} className="font-serif font-bold text-fame-text-light text-lg tracking-wide hover:text-white transition-colors">
        FAME
        <span className="text-fame-text-muted font-mono text-xs ml-2 normal-case tracking-normal">
          {lab === 'paris' ? 'Paris' : 'Montréal'}
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <NavMenu locale={locale} lab={lab} member={member} />
        <AuthButton member={member} locale={locale} />
      </div>
    </header>
  )
}
```

Add `"admin"` key to nav section in both `messages/en.json` and `messages/fr.json`:
```json
"nav": { "admin": "Admin" }
```

- [ ] **Step 5: Write `src/app/[locale]/[lab]/layout.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'

const LABS = ['paris', 'montreal'] as const

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string; lab: string }>
}

export default async function LabLayout({ children, params }: Props) {
  const { locale, lab } = await params
  if (!LABS.includes(lab as typeof LABS[number])) notFound()

  return (
    <>
      <TopBar locale={locale} lab={lab} />
      <main className="pt-12 min-h-screen bg-fame-sand-bg">
        {children}
      </main>
    </>
  )
}
```

- [ ] **Step 6: Build check**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm run build 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/ src/app/[locale]/[lab]/layout.tsx messages/
git commit -m "feat: TopBar, NavMenu, LanguageSwitcher, AuthButton — persistent site navigation"
```

---

## Task 7: Home Page — Globe

**Files:**
- Create: `src/components/globe/StarField.tsx`
- Create: `src/components/globe/LabPin.tsx`
- Create: `src/components/globe/Globe.tsx`
- Modify: `src/app/[locale]/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone client components)
- Produces: full home page — clic on Paris/Montréal pin → toast + redirect to `/${locale}/${lab}`

- [ ] **Step 1: Install D3 + TopoJSON**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm install d3 topojson-client && npm install --save-dev @types/d3 @types/topojson-client
```

Expected: `added N packages`

- [ ] **Step 2: Download world TopoJSON**

```bash
mkdir -p "/home/lucad/Documents/Projets Programmation/FAME Website/public" && curl -L "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json" -o "/home/lucad/Documents/Projets Programmation/FAME Website/public/world-110m.json"
```

- [ ] **Step 3: Write `src/components/globe/StarField.tsx`**

```typescript
'use client'
import { useEffect, useRef } from 'react'

export function StarField({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    const stars = Array.from({ length: 280 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random() * 0.7 + 0.2,
    }))

    let frame: number
    let t = 0
    function draw() {
      ctx.clearRect(0, 0, width, height)
      t += 0.008
      stars.forEach(s => {
        const opacity = s.a * (0.6 + 0.4 * Math.sin(t + s.x))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(220,230,255,${opacity})`
        ctx.fill()
      })
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [width, height])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
}
```

- [ ] **Step 4: Write `src/components/globe/LabPin.tsx`**

```typescript
'use client'

type Props = {
  x: number
  y: number
  label: string
  onClick: () => void
}

export function LabPin({ x, y, label, onClick }: Props) {
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* outer pulse ring */}
      <circle r={16} fill="none" stroke="#e8b149" strokeWidth={1.5} opacity={0.4}>
        <animate attributeName="r" values="12;22;12" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* dot */}
      <circle r={5} fill="#e8b149" stroke="#fff" strokeWidth={1.5} />
      {/* label */}
      <text
        y={-14}
        textAnchor="middle"
        fontSize={11}
        fill="#eef3ff"
        fontFamily="'IBM Plex Mono', monospace"
        fontWeight="bold"
        letterSpacing="0.1em"
      >
        {label}
      </text>
    </g>
  )
}
```

- [ ] **Step 5: Write `src/components/globe/Globe.tsx`**

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import { StarField } from './StarField'
import { LabPin } from './LabPin'
import { useToast } from '@/components/ui/Toast'

const LABS = [
  { key: 'paris', label: 'Paris', coords: [2.35, 48.85] as [number, number] },
  { key: 'montreal', label: 'Montréal', coords: [-73.56, 45.5] as [number, number] },
]

const W = 800
const H = 600

export function Globe() {
  const svgRef = useRef<SVGSVGElement>(null)
  const router = useRouter()
  const locale = useLocale()
  const { addToast } = useToast()
  const [pins, setPins] = useState<{ key: string; x: number; y: number; label: string }[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const projection = d3.geoOrthographic()
      .scale(260)
      .center([0, 0])
      .rotate([-10, -30])
      .translate([W / 2, H / 2])

    const path = d3.geoPath().projection(projection)
    const svg = d3.select(svgRef.current)

    fetch('/world-110m.json')
      .then(r => r.json())
      .then((world: Topology) => {
        const countries = feature(world, world.objects.countries as any)
        const g = svg.select('g.globe-g')

        // Sphere (ocean)
        g.append('path')
          .datum({ type: 'Sphere' } as any)
          .attr('d', path as any)
          .attr('fill', '#1d2b56')
          .attr('stroke', '#2f4486')
          .attr('stroke-width', 0.5)

        // Countries
        g.append('path')
          .datum(countries)
          .attr('d', path as any)
          .attr('fill', '#2f4486')
          .attr('stroke', '#5768ac')
          .attr('stroke-width', 0.4)

        // Compute pin positions
        const computed = LABS.map(lab => {
          const [x, y] = projection(lab.coords) ?? [0, 0]
          return { key: lab.key, x, y, label: lab.label }
        })
        setPins(computed)

        // Drag rotation
        let lastX = 0
        let lastY = 0
        let rot = projection.rotate()
        svg.call(
          d3.drag<SVGSVGElement, unknown>()
            .on('start', (event) => { lastX = event.x; lastY = event.y; rot = projection.rotate() })
            .on('drag', (event) => {
              const dx = event.x - lastX
              const dy = event.y - lastY
              const newRot: [number, number, number] = [rot[0] + dx * 0.4, rot[1] - dy * 0.4, 0]
              projection.rotate(newRot)
              g.selectAll('path').attr('d', path as any)
              const recomputed = LABS.map(lab => {
                const [x, y] = projection(lab.coords) ?? [0, 0]
                return { key: lab.key, x, y, label: lab.label }
              })
              setPins(recomputed)
            }) as any
        )

        setReady(true)
      })
  }, [])

  function handlePinClick(key: string, label: string) {
    addToast(`Entering ${label} lab…`, 'success')
    setTimeout(() => router.push(`/${locale}/${key}`), 800)
  }

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      <StarField width={W} height={H} />
      <svg ref={svgRef} width={W} height={H} style={{ position: 'absolute', inset: 0, cursor: 'grab' }}>
        <g className="globe-g" />
        {ready && pins.map(p => (
          <LabPin key={p.key} x={p.x} y={p.y} label={p.label}
            onClick={() => handlePinClick(p.key, p.label)} />
        ))}
      </svg>
    </div>
  )
}
```

- [ ] **Step 6: Replace `src/app/[locale]/page.tsx` with full home**

```typescript
import { Globe } from '@/components/globe/Globe'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { getTranslations } from 'next-intl/server'

type Props = { params: Promise<{ locale: string }> }

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('home')

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#15203f' }}>
      {/* top-right lang switcher */}
      <div className="absolute top-4 right-6 z-10">
        <LanguageSwitcher />
      </div>

      {/* FAME wordmark */}
      <div className="absolute top-6 left-8 z-10">
        <span className="font-serif font-bold text-2xl text-fame-text-light tracking-wide">FAME</span>
      </div>

      <Globe />

      <p className="absolute bottom-10 text-center font-mono text-xs text-fame-text-muted tracking-widest uppercase">
        {t('cta')}
      </p>
    </main>
  )
}
```

- [ ] **Step 7: Start dev server and verify globe renders**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm run dev
```

Open `http://localhost:3000/en` — you should see a dark blue globe with Paris and Montréal pins pulsing. Drag the globe to rotate. Click a pin to get a toast and redirect.

- [ ] **Step 8: Commit**

```bash
git add src/components/globe/ src/app/[locale]/page.tsx public/world-110m.json package.json package-lock.json
git commit -m "feat: interactive D3 globe home page — Paris and Montréal pins with drag rotation"
```

---

*Continue in Part 2 → `2026-06-22-fame-website-p2-features.md`*
