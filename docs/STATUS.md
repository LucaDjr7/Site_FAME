# FAME Website — État d'avancement

_Mettre à jour après chaque tâche. Garder ce fichier **maigre** : l'historique terminé vit dans [`STATUS-archive.md`](./STATUS-archive.md), le détail ligne-à-ligne dans `git log`, les décisions durables dans les fichiers mémoire._

Dernière mise à jour : 2026-06-26

---

## Où on en est

- **`main` est saine et complète** : site v1 (Phases 1–3) + audit soldé (Vagues 0→4 : a11y/SEO, durcissement sécu/CI, dette/i18n). Tests verts, `tsc`/`lint`/`build` à 0. Détail → [`STATUS-archive.md`](./STATUS-archive.md).
- **Phase active : Assistant RAG** (chatbot LLM, cible **primaire = visiteur public**). Brainstorming fait, **spec validée**, **5 plans rédigés**. Branche unique `feat/assistant-rag`, **une seule PR finale** (pas de stacking).

---

## Phase 2 — Assistant RAG

**Spec** : `docs/superpowers/specs/2026-06-25-assistant-rag-design.md`
**Roadmap** : `docs/superpowers/plans/2026-06-25-assistant-rag-roadmap.md`

| Plan | Fichier | Livre | Statut |
|---|---|---|---|
| P1 | `…-assistant-p1-data-indexing.md` | Migration `006` (pgvector), embeddings, chunking, KB, indexeur, embed-on-write, backfill, **membres publics** | ✅ |
| P2 | `…-assistant-p2-retrieval-chat.md` | Retrieve (**filtre permissions en SQL**) + seuil, modération, anti-injection, masquage PII, rate-limit persistant, budget, kill-switch, endpoint SSE | ✅ |
| P3 | `…-assistant-p3-tools.md` | 3 outils lecture seule (re-check permissions) + boucle d'outils | ✅ |
| P5 | `…-assistant-p5-admin-rgpd.md` | `/admin/assistant`, toggle/reindex, `/privacy`, `.env.example`, red-team, +régression visibilité email admin | ✅ |
| P4 | `…-assistant-p4-ui.md` | UI Astra : bulle + mini-panneau (partout), teaser accueil, page plein écran `/[locale]/assistant`, citations, streaming client | ✅ |

**Ordre d'exécution** : **P1 → P2 → P3 → P5 → P4** ✅ TOUS faits (P4 débloqué par les maquettes « FAME Assistant » + « FAME ChatBubble », branding **Astra**).
**Exécution** : Subagent-Driven. Branche `feat/assistant-rag`, tip = `1f15dad`. **Revues finales Opus (backend + couche UI) + re-revues des fixes : verdict « Ready to merge: Yes » des deux côtés.** Suite **236/236**, lint 0/tsc/build verts. Ledger détaillé : `.superpowers/sdd/progress.md`.
**Reste** : `finishing-a-development-branch` → **PR unique backend+UI** `feat/assistant-rag` → main (décision utilisateur). Fast-follows possibles non bloquants notés au ledger.
**Prérequis runtime** (utilisateur, avant que l'assistant réponde — dev & prod) : `OPENAI_API_KEY` (facturable), `ASSISTANT_IP_SALT` (pepper hash IP), migrations `006`+`007` appliquées (pgvector activé par `006`), puis `npm run index:rag` (backfill embeddings).

**Décisions prises (2026-06-25)** :
1. **Champ `confidentiel` (P1)** ✅ : booléen sur `subjects`, défaut `false`. `confidentiel=true` → jamais visible au visiteur (ni bot ni outils) ; membres voient tout ; tâches/fichiers héritent. Conforme aux plans tels qu'écrits.
2. **Maquette assistant (P4)** ⏸ : **créer une maquette dédiée « FAME Assistant »** dans le projet Claude Design **avant** d'exécuter P4. P4 reste bloqué jusque-là. Auteur de la maquette à décider au moment venu (utilisateur, ou Opus via MCP `DesignSync` si scope write).

**Prérequis runtime (utilisateur, le moment venu)** : `OPENAI_API_KEY` (compte facturable) ; extension `pgvector` activée sur Supabase ; migration `006` appliquée.

---

## Garde-fous permanents (ne pas casser)

- ⚠️ **Ne jamais retirer `@config "../../tailwind.config.ts"`** de `globals.css` (sinon tous les `fame-*` redeviennent morts). Mémoire `tailwind-fame-tokens-dead`.
- ⚠️ **`createServiceClient()` sans cookies** (sinon RLS s'applique aux users connectés). Mémoire `service-role-no-cookies`.
- Secrets server-only (`SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY`, `OPENAI_API_KEY`) — jamais `NEXT_PUBLIC_`.
- i18n en/fr à parité stricte (test `src/messages-parity.test.ts`), zéro chaîne UI hardcodée.

---

## Déploiement (Task 20 — non démarré)

- ✅ Migrations appliquées en BDD : `001`–`005`. (`006` assistant à appliquer lors de la Phase 2.)
- ⏳ **Env vars prod (Vercel)** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` + `EMAIL_FROM` (+ clés assistant en Phase 2). Domaine expéditeur à vérifier dans Resend.
- ⏳ `npm run seed:admin` une fois sur la prod.
- ⏳ Plan superpowers déploiement dédié à rédiger.

---

## Plans des phases terminées (référence)

`docs/superpowers/plans/2026-06-22-fame-website-p{1,2,3}-*.md` (Foundation / Features / Secondary) · audit `docs/AUDIT_2026-06-24.md` · vagues `…-vague{2,3,4}-*.md`.
