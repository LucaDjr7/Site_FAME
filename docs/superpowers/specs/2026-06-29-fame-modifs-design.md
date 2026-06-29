# Design — Lot de modifications FAME (2026-06-29)

Statut : **validé** (brainstorming) — prêt pour les plans d'implémentation.

Ce lot regroupe 8 modifications demandées, réparties en deux chantiers indépendants
(backend/LLM et UI/layout) + un point transverse sur le rendu des réponses de l'assistant.

Découpage proposé : **2 plans / 2 PR** — Plan 1 = Chantier A (backend/LLM), Plan 2 = Chantier B (UI).

---

## Chantier A — Backend / LLM

### A1. Génération + traduction LLM sur les tâches (parité avec les sujets)

**Objectif** : répliquer pour les tâches les features déjà livrées sur les sujets — bouton
✨ de génération par champ + auto-traduction bilingue (EN↔FR) à la sauvegarde.

**Périmètre des champs** : `titre`, `description`, et les `label` de sous-tâches.

**Données**
- Migration `012_task_i18n.sql` (additive) :
  - `tasks.i18n jsonb NOT NULL DEFAULT '{}'` — forme `{en:{titre,description}, fr:{…}}`
  - `subtasks.i18n jsonb NOT NULL DEFAULT '{}'` — forme `{en:{label}, fr:{label}}`
- Type `Task` et `Subtask` étendus avec `i18n`. Les colonnes plates restent source/fallback
  (même contrat que les sujets).

**Modules (calqués sur `src/lib/subjects/`)**
- `src/lib/tasks/field-prompts.ts` — `TaskAssistField = 'titre' | 'description' | 'subtask'`,
  `buildTaskFieldPrompt(field, draft, locale, context?)`. System prompt : ne pas traduire les
  acronymes/termes techniques (réutiliser la consigne des sujets). Max ~220 tokens.
- `src/lib/tasks/generate-field.ts` — `generateTaskField(field, draft, locale, deps?, context?)`,
  via `getChatProvider()` (`src/lib/llm/index.ts`), `recordUsage`, respect du budget.
- `src/lib/tasks/translate.ts` — `translateTaskFields(src, to, deps?)` + `buildTaskI18n(src, sourceLocale, deps)`.
  Appel LLM **groupé** couvrant titre + description + tableau des labels de sous-tâches.
  Fallback gracieux : si assistant coupé / budget dépassé / JSON invalide → la sauvegarde
  réussit, `i18n` reste vide/partiel, l'affichage replie sur les colonnes plates.
- `src/lib/tasks/localized.ts` — `localizedTask(task, locale)` (sert la bonne locale, fallback colonnes plates).

**API**
- `POST /api/tasks/assist` — contrat identique à `/api/subjects/assist` :
  `{ field, draft, locale, taskId? }` → `{ text }`. Kill-switch `ASSISTANT_DISABLED` + `isOverBudget()` → 503.
  Pour `field='subtask'`, le `draft` inclut le titre de la tâche comme contexte.
- Auto-traduction branchée dans :
  - `POST /api/tasks` (création) — titre + description + `subtask_labels[]` arrivent ensemble → **un seul** `buildTaskI18n`.
  - `PATCH /api/tasks/[id]` — recalcule l'i18n des champs modifiés.
  - `POST` / `PATCH /api/tasks/[id]/subtasks` — traduit le `label` créé/modifié.

**UI**
- `AddTaskModal` : `AssistButton` (✨ + « voir le prompt ») sur titre, description, et chaque label de sous-tâche.
- `TaskModal` : idem pour l'édition des champs rédactionnels.
- Affichage via `localizedTask` dans `TaskCard`, `TaskModal`, le kanban.

**RAG** : `chunkTask` indexe les deux langues (cohérent avec A2 ; voir le bug de tag de langue ci-dessous).

**Limitation connue** : comme pour les sujets, la conversion proposition→sujet n'auto-traduit pas ;
ici sans objet (les tâches sont créées via l'éditeur, qui a une langue source fiable).

---

### A2. L'assistant répond dans la langue de la question

**Symptôme** : une question en anglais reçoit une réponse bilingue.

**Causes**
1. La langue détectée n'est **jamais transmise** au system prompt
   (`buildSystemPrompt(tier, chunks)` n'a pas de paramètre langue).
2. `src/lib/rag/index-source.ts` tague **tous** les chunks de sujets `lang:'en'` en dur,
   même les chunks FR (la KB, elle, utilise correctement `doc.lang`).
3. `match_rag_chunks` ne filtre pas par langue → une question EN peut récupérer des chunks FR+EN.

**Fix**
- **Principal** : `buildSystemPrompt(tier, chunks, lang)` ajoute une directive forte :
  « You MUST respond ENTIRELY in {English|French}. Never mix languages. » La langue est détectée
  depuis la dernière question utilisateur (détection plus robuste que le regex `/[à-ÿ]/i` actuel —
  p.ex. heuristique de mots-outils EN/FR) et passée par `src/app/api/assistant/chat/route.ts`.
- **Correction** : `index-source.ts` tague chaque chunk de sujet avec sa **vraie** langue
  (les sets EN/FR sont déjà séparés dans `chunkSubject`). Réindexation requise (`npm run index:rag`).
- **Décision** : on **ne filtre pas** le retrieval par langue (préserver le rappel) — la directive
  de prompt impose la langue de sortie quelle que soit la langue des sources.

---

### A3. Section admin dédiée pour les logs IA

**Existant** : table `chat_unanswered` (déclenchée si `chunks.length === 0`, colonne `resolved` déjà
présente) + `chat_flagged` (modération). `/[locale]/admin/assistant` n'affiche qu'une liste à puces
des 50 dernières questions sans réponse.

**Cible** : nouvelle page dédiée.
- `src/app/[locale]/admin/logs/page.tsx` — hérite du layout admin (`requireAdmin`), charge via `createServiceClient`.
- `src/components/admin/LogsDashboard.tsx` :
  - Tableau **chat_unanswered** : date, langue, question, action « marquer résolu » (toggle `resolved`),
    filtrage résolu/non-résolu.
  - Tableau **chat_flagged** : date, raison, question.
- `PATCH /api/admin/logs/[id]` (admin) — bascule `resolved` sur `chat_unanswered`.
- Namespace i18n `adminLogs` (EN + FR, parité stricte).
- Lien depuis `/admin/assistant` vers la nouvelle page ; la liste minimale actuelle est retirée
  de `AssistantDashboard` (migrée vers `/admin/logs`).
- **Déclencheur inchangé** : on log toujours seulement le retrieval vide (pas la basse confiance).

---

### A4. Rendu Markdown des réponses de l'assistant

**Symptôme** : les réponses contiennent du Markdown brut (`**gras**`) affiché littéralement
(`ChatMessageList` rend `{m.content}` avec `white-space: pre-wrap`, aucune lib Markdown).

**Décision** : **rendre** le Markdown (le gras devient gras).

**Fix**
- Petit composant de rendu **sans grosse dépendance** (ou micro-lib légère), construisant des
  nœuds React (pas de `dangerouslySetInnerHTML`). Gère : **gras**, *italique*, `code` inline,
  listes (`-`/`1.`), sauts de ligne/paragraphes, liens `[txt](url)`.
- **Tolérant au streaming** : un marqueur non fermé (`**` sans fin) s'affiche en littéral jusqu'à
  fermeture, sans casser le rendu.
- Appliqué **uniquement aux messages de l'assistant** ; les messages utilisateur restent en texte brut.
- Les liens externes : `target="_blank" rel="noopener noreferrer"`.

---

## Chantier B — UI / Layout

### B1. Bouton retour sur la page RGPD

- `src/app/[locale]/privacy/page.tsx` : lien localisé en haut → accueil `/[locale]`
  (clé i18n `privacy.back`, ex. « ← Retour au site » / « ← Back to site »). Style discret cohérent.

### B2. Page sujet — combler le vide (ajustement de l'existant, pas de refonte)

Fichiers : `src/components/paper/{PaperView,PaperSheet,TasksPanel,CommentsPanel,FilesPanel}.tsx`.
- Élargir la fiche centrale : `clamp(420px, calc(100vw - 700px), 740px)` → `max` ≈ **880px**
  (ajuster la soustraction pour garder les gouttières des panneaux).
- **Masquer le placeholder figure** (hauteur fixe 150px) quand aucune figure n'est définie.
- **Masquer** les sections context/method/results vides (pas de bloc/espace si contenu vide).
- Panneaux latéraux qui **s'adaptent au contenu** : retirer les `maxHeight` rigides
  (`TasksPanel` 300px, `CommentsPanel` 210px) au profit de hauteurs souples dans la colonne
  droite déjà scrollable (`bottom:124`). Garder le layout en positions absolues actuel.

### B3. Cartes vitrine — responsive selon l'appareil + mots-clés non tronqués

- **`SubjectGrid`** : remplacer `gridTemplateColumns: 'repeat(5, minmax(0,1fr))'` (figé, sans
  breakpoint) par une grille **adaptative** — `repeat(auto-fill, minmax(~190px, 1fr))`
  (→ 5/4/3/2/1 colonnes selon la largeur réelle de l'écran). Règle la dégradation sur petit écran.
- **Mots-clés** dans `SubjectVitrine` (lignes ~84-88) : retirer `maxHeight:24` + `overflow:hidden` ;
  passer le bloc keywords sous `FitText` (ou wrap multi-lignes auto-fit) → plus de troncature
  silencieuse. Réutilise le composant `FitText` existant (recherche binaire + ResizeObserver).

---

## Garde-fous à respecter (rappel)

- i18n EN/FR à **parité stricte** (test `src/messages-parity.test.ts`), zéro chaîne UI hardcodée.
- `createServiceClient()` **sans cookies**.
- Ne jamais retirer `@config` de `globals.css`.
- Emails membres publics (ne pas remasquer) ; `confidentiel` reste protégé.
- Secrets server-only.
- Migration suivante = **`012`** (`011_subject_files_rag.sql` déjà réservé/à appliquer).

## Tests

- TDD : prompts/translate/generate des tâches, route assist (kill-switch/budget), `localizedTask`.
- Assistant : détection de langue + injection dans le prompt ; tag de langue correct à l'indexation.
- Admin logs : route PATCH `resolved`, rendu du dashboard.
- Markdown renderer : gras/italique/listes/liens + cas streaming (marqueur non fermé).
- UI : non-régression `tsc`/`lint`/`build` + parité i18n.
