-- supabase/migrations/017_research_hub.sql
-- Hub de veille recherche IA×finance — fetch automatisé, pas de policy RLS
-- (convention du projet : RLS activée, autorisation gérée côté application).
-- Run in Supabase SQL editor or via supabase CLI.

-- 1. Papiers collectés (une ligne = un papier dédupliqué par fingerprint).
create table research_papers (
  id               uuid primary key default gen_random_uuid(),
  fingerprint      text not null unique,
  title            text not null,
  authors          text[] not null default '{}',
  abstract         text,
  url              text not null,
  source           text not null check (source in ('arxiv','openalex','repec','semantic_scholar','manual')),
  venue            text,
  themes           text[] not null default '{}',
  fame_score       int,
  embedding        vector(1536),
  published_at     date,
  status           text not null,
  manual_override  boolean not null default false,
  fetched_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint research_papers_status_check check (status in ('published','rejected','hidden'))
);
create index research_papers_status_idx on research_papers (status, published_at desc);
alter table research_papers enable row level security; -- service-role only (aucune policy)

-- 2. Journal des runs de fetch (une ligne par source et par run).
create table research_fetch_log (
  id         uuid primary key default gen_random_uuid(),
  run_at     timestamptz not null default now(),
  source     text not null,
  added      int not null default 0,
  skipped    int not null default 0,
  errors     int not null default 0,
  message    text
);
alter table research_fetch_log enable row level security;

-- 3. Favoris par membre.
create table research_bookmarks (
  user_id    uuid not null references members(id) on delete cascade,
  paper_id   uuid not null references research_papers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);
alter table research_bookmarks enable row level security;

-- 4. Notes privées par membre sur un papier.
create table research_notes (
  user_id    uuid not null references members(id) on delete cascade,
  paper_id   uuid not null references research_papers(id) on delete cascade,
  content    text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);
alter table research_notes enable row level security;
