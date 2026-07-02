# D2 — API & Données (Sonnet, lecture seule)

Corrections 06-28 (B1, B2-tâches, I2, I3/I4, I5, M5, M13, path-traversal) **toutes vérifiées toujours actives**.

## 🟠 High
- **DELETE sujet : fichiers Storage jamais purgés** (`src/app/api/subjects/[id]/route.ts:88-92`). Le FK `on delete cascade` supprime les lignes `subject_files` AVANT le `after()`, qui n'appelle que `deleteSubjectFileChunks` (chunks RAG) — jamais `storage.remove`, et les `storage_path` ont déjà disparu. Objets orphelins permanents dans le bucket. **Confirmé par lecture directe.** Fix : lire les `storage_path` avant le delete, planifier `storage.remove`.
- **`POST /api/assistant/reindex` (reindexAll) n'indexe jamais `subject_files`** (`src/lib/rag/index-source.ts:198`). Boucle sur `subjects/publications/prompts/members/tasks` + KB seulement. « Réindexer tout » laisse les 131 chunks de documents intacts/non rafraîchis. **Confirmé.** Fix : ajouter une boucle `subject_files → indexSubjectFile`.

## 🟡 Medium
- **Anti-cycle relations : TOCTOU** (`relations/route.ts:38-48`) — deux POST concurrents peuvent créer un cycle (pas de verrou/transaction). Casse l'hypothèse DAG de `resolveInheritance`.
- **Toggle `confidentiel` pendant l'indexation initiale** — `indexSubjectFile` lit la visibilité une fois au début puis insère après l'embedding ; un toggle dans la fenêtre peut laisser un chunk en tier périmé jusqu'au prochain retier.
- **Register : `mime_type`/`size_bytes` déclarés non vérifiés** contre l'objet réel → extraction RAG silencieusement vide en cas de mismatch.

## ⚪ Low
- `PATCH/POST /api/tasks/[id]/subtasks` → 500 au lieu de 404 sur id invalide.
- `DELETE …/relations/[relId]` ignore le paramètre `id` (incohérent avec `files/[fileId]`).
