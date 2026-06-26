# Assistant RAG — Roadmap des plans

Spec source : `docs/superpowers/specs/2026-06-25-assistant-rag-design.md`.
Branche unique : `feat/assistant-rag` (déjà créée). **Une seule PR finale** (on ne refait pas l'erreur des branches stacked des vagues 2-4).

Le périmètre est découpé en **5 plans séquentiels**, chacun livrant un incrément testable :

| Plan | Fichier | Livre |
|---|---|---|
| **P1 — Socle données & indexation** | `2026-06-25-assistant-p1-data-indexing.md` | Migration `006`, provider embeddings OpenAI, chunking, KB, indexeur, embed-on-write, backfill, **membres publics** |
| **P2 — Retrieval, garde-fous & endpoint chat** | `2026-06-25-assistant-p2-retrieval-chat.md` | retrieve (filtre permissions + seuil), modération, masquage PII, anti-injection, rate-limit persistant, budget, provider génération streaming, `POST /api/assistant/chat` (sans outils) |
| **P3 — Tool-calling** | `2026-06-25-assistant-p3-tools.md` | `get_subject_progress`, `find_tasks`, `get_subject_files` (re-check permissions), boucle d'outils dans l'endpoint |
| **P4 — UI** | `2026-06-25-assistant-p4-ui.md` | namespace i18n `assistant`, bulle flottante, panneau, page plein écran, entrée globe, citations, mode dégradé, streaming client |
| **P5 — Admin, RGPD & câblage budget** | `2026-06-25-assistant-p5-admin-rgpd.md` | `/admin/assistant`, `POST /api/assistant/reindex`, kill-switch, `/privacy`, `.env.example`, jeu de prompts rouges |

**Ordre d'exécution (décision 2026-06-25)** : **P1 → P2 → P3 → P5**, puis **pause avant P4**. P4 (UI) est **bloqué** tant qu'une maquette dédiée « FAME Assistant » n'existe pas dans le projet Claude Design — l'utilisateur a tranché « créer une maquette d'abord » (cf. encart en tête de P4). P5 (admin/RGPD) ne dépend pas de cette maquette (dérivé admin, pas de maquette requise) et passe donc avant P4.

**Modèles SDD** : sécu/bridage/indexation/CI → Opus 4.8 ; UI/admin → Sonnet 4.6 ; revue finale whole-branch → Opus 4.8.

**Prérequis runtime (fournis par l'utilisateur le moment venu)** : `OPENAI_API_KEY` (compte facturable) ; extension `pgvector` activée sur Supabase ; migration `006` appliquée comme `004`/`005`.

**Écart assumé vs spec** : pas de dépendance npm `openai` — on appelle l'API OpenAI via `fetch` (plus simple à mocker en test, zéro dépendance ajoutée). Le provider reste swappable.
