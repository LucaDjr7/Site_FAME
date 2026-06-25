-- supabase/migrations/005_drop_password_hash.sql
-- §6 (Vague 3) — suppression d'une colonne morte.
-- `members.password_hash` (introduite en 001) n'est jamais lue ni écrite par l'app :
-- l'authentification est entièrement gérée par Supabase Auth, et le type `Member`
-- (src/types/index.ts) l'omet volontairement. Colonne résiduelle → on la retire
-- pour éviter qu'un secret y soit stocké par erreur.
-- Run in Supabase SQL editor or via supabase CLI.

ALTER TABLE members DROP COLUMN IF EXISTS password_hash;
