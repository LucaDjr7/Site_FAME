-- Durcissement sécurité (audit 2026-07-08).
-- Aucun changement de comportement applicatif : les RPC sont déjà SECURITY INVOKER + RLS
-- default-deny, et n'étaient consommées que côté serveur (service-role ou membre authentifié).

-- 1. Fixer search_path des fonctions (évite le linter `function_search_path_mutable` et tout
--    détournement de résolution de noms). Les fonctions restent SECURITY INVOKER.
alter function public.match_rag_chunks(vector(1536), int, boolean)
  set search_path = public, extensions;
alter function public.match_subject_files(vector(1536), text, int)
  set search_path = public, extensions;
alter function public.update_updated_at()
  set search_path = public;

-- 2. Révoquer l'exécution directe des RPC de recherche vectorielle pour les rôles publics.
--    Elles ne sont appelées que via le service-role (routes API) : anon/authenticated n'ont
--    aucune raison de les invoquer via PostgREST (surface d'abus/coût, scan HNSW non authentifié).
revoke execute on function public.match_rag_chunks(vector(1536), int, boolean) from anon, authenticated;
revoke execute on function public.match_subject_files(vector(1536), text, int) from anon, authenticated;
