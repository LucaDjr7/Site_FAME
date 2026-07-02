# État réel BDD Supabase (dev) — 2026-07-02, lecture seule

Script : requêtes HEAD/SELECT + 2 RPC de lecture + listBuckets, via service-role et anon de `.env.local`. Données brutes : `etat-bdd.json`.

## Migrations → preuves observées

| Migration | Preuve | Verdict |
|---|---|---|
| 001–005 (schéma initial, transversal, drop password_hash) | tables `subjects/tasks/subtasks/members/comments/publications/prompts/proposals/dropbox_links` toutes présentes ; `is_transversal`, `confidentiel` OK | ✅ |
| 006 (assistant RAG) | `rag_chunks` (349 lignes), `chat_rate_limit` (32), `chat_usage` (2), `chat_unanswered` (1), `chat_flagged` (0), `app_settings` (1) | ✅ |
| 007/011 (RPC) | `match_rag_chunks(query_embedding, match_count, include_member)` → OK ; `match_subject_files(query_embedding, p_subject_id, match_count)` → OK ; `rag_chunks.metadata` OK | ✅ |
| 008 (vitrine) | `subjects.question/accroche/periode` OK | ✅ |
| 009 (subject i18n) | `subjects.i18n` OK | ✅ |
| 010 (subject_files + bucket) | table `subject_files` (6 lignes) ; bucket `subject-files` = **privé** | ✅ |
| 012 (task i18n) | `tasks.i18n`, `subtasks.i18n` OK | ✅ |
| 013 (relations) | `subject_relations` (12 lignes), colonnes `kind/source_id/target_id/label_i18n`, `subjects.inherits` OK | ✅ |
| 014 (confidentiel par doc) | `subject_files.confidentiel` OK | ✅ |

**Toutes les migrations `001`–`014` sont réellement matérialisées en BDD de dev.**

## Sonde RLS (client anonyme, sans session)

`subjects`, `members`, `prompts`, `chat_unanswered`, `subject_files`, `subject_relations`, `rag_chunks`, `proposals`, `dropbox_links` → **0 ligne lisible en anonyme** (default-deny effectif ; l'accès public passe par les RSC/API service-role, conforme à l'architecture). Aucune table exposée. (NB : la sonde initiale mentionnait `chat_sessions` — cette table n'existe pas, erreur de nom dans le script, pas un problème BDD.)

## Index RAG

349 chunks : `kb`=136, `subject_file`=131, `subject`=78, `task`=3, `member`=1, `publication`=0, `prompt`=0. Visibilité : `public`=339, `member`=10. → l'indexation embed-on-write fonctionne (docs de sujets bien indexés), tier `member` non vide (contenus confidentiels correctement tiérés).

## Ids pour la sonde HTTP (Task 9)

- Sujet **confidentiel** : `b9cfac5d-5909-46ef-877d-5a6dc0ec2097` (paris) → attendu 404 visiteur.
- Document **confidentiel** : `ec9a89e9-1fbb-40c6-b6b9-bc5cc1adfadd` sur sujet `db5f41e4-…` (lui-même **confidentiel**) → attendu 404 visiteur (gate combiné).
- Sujet **public** : `fb313865-4e9b-4bd8-8447-cca99d0a3037` (paris) → attendu 200 (contrôle).
- Document **public** : `96b7ed98-…` sur sujet public `cb03ca98-…` (contrôle download).
- **Limite** : aucune combinaison « doc confidentiel sur sujet PUBLIC » en BDD de dev → le gate purement par-fichier ne peut pas être sondé en HTTP réel ; il reste couvert par les tests unitaires (PR #49) et la revue.
