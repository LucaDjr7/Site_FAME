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
