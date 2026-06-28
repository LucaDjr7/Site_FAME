-- Contenu bilingue des fiches. Additif : les colonnes plates restent la source/fallback.
-- i18n = { "en": {champs}, "fr": {champs} } ; vide '{}' pour les fiches existantes (fallback).
ALTER TABLE subjects ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}'::jsonb;
