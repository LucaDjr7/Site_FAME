-- supabase/migrations/006_assistant_rag.sql
-- Assistant RAG — socle données (additif, réversible).
-- Confidentialité des sujets + extension vecteurs + index RAG + tables d'exploitation chat.
-- Run in Supabase SQL editor or via supabase CLI.

-- 1. Flag de confidentialité (public par défaut — comportement actuel préservé).
alter table subjects add column confidentiel boolean not null default false;

-- 2. Extension vecteurs (Supabase la fournit ; idempotent).
create extension if not exists vector;

-- 3. Index vectoriel : un chunk = un extrait vectorisé d'une source.
--    visibility/labo/confidentiel/is_transversal/lang = colonnes de FILTRAGE query-time.
create table rag_chunks (
  id              uuid primary key default gen_random_uuid(),
  source_type     text not null check (source_type in ('subject','task','publication','prompt','member','kb')),
  source_id       text not null,
  labo            text check (labo in ('paris','montreal')),
  is_transversal  boolean not null default false,
  confidentiel    boolean not null default false,
  visibility      text not null check (visibility in ('public','member')),
  lang            text not null default 'en',
  content         text not null,
  embedding       vector(1536),
  token_count     integer not null default 0,
  embedding_stale boolean not null default false,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index rag_chunks_source_idx on rag_chunks (source_type, source_id);
create index rag_chunks_embedding_idx on rag_chunks using hnsw (embedding vector_cosine_ops);
alter table rag_chunks enable row level security; -- service-role only (aucune policy)

-- 4. Rate-limit persistant (fenêtre fixe bucketée : key + window_start).
create table chat_rate_limit (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);
alter table chat_rate_limit enable row level security;

-- 5. Comptabilité mensuelle (base du kill-switch budget).
create table chat_usage (
  month        text primary key,            -- 'YYYY-MM'
  tokens_in    bigint not null default 0,
  tokens_out   bigint not null default 0,
  est_cost_usd numeric not null default 0,
  updated_at   timestamptz not null default now()
);
alter table chat_usage enable row level security;

-- 6. Journalisation ciblée (conservation C — pas de transcription intégrale).
create table chat_unanswered (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  lang       text not null default 'en',
  ip_hash    text,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table chat_unanswered enable row level security;

create table chat_flagged (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  reason     text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);
alter table chat_flagged enable row level security;

-- 7. Réglages applicatifs (kill-switch manuel, doublé par env ASSISTANT_DISABLED).
create table app_settings (
  key   text primary key,
  value jsonb not null
);
alter table app_settings enable row level security;
insert into app_settings (key, value) values ('assistant_enabled', 'true'::jsonb)
  on conflict (key) do nothing;
