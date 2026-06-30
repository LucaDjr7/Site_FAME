-- 013_subject_relations.sql — relations entre fiches (mère→fille + associations) et héritage par champ.
create table if not exists subject_relations (
  id         uuid primary key default gen_random_uuid(),
  source_id  uuid not null references subjects(id) on delete cascade,
  target_id  uuid not null references subjects(id) on delete cascade,
  kind       text not null check (kind in ('parent','assoc')),
  label      text not null default '',
  label_i18n jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (source_id <> target_id)
);
-- 'parent' : source_id = MÈRE, target_id = FILLE. 'assoc' : non orienté, invariant applicatif source_id < target_id.
create unique index if not exists ux_subject_relations_pair on subject_relations (source_id, target_id, kind);
create index if not exists ix_subject_relations_source on subject_relations (source_id);
create index if not exists ix_subject_relations_target on subject_relations (target_id);
alter table subjects add column if not exists inherits jsonb not null default '{}'::jsonb;
