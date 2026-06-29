-- 012_task_i18n.sql — traduction bilingue des tâches (parité avec subjects.i18n, migration 009).
-- Additif : colonnes JSONB par défaut '{}'. Les colonnes plates restent source/fallback.

alter table tasks    add column if not exists i18n jsonb not null default '{}'::jsonb;
alter table subtasks add column if not exists i18n jsonb not null default '{}'::jsonb;
