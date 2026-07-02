# Audit Complet Pré-Production 2026-07-02 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire le rapport d'audit `docs/AUDIT_2026-07-02.md` (verdict go/no-go prod) couvrant tout le repo, pondéré sur le code post-28/06, la deploy-readiness et les différés antérieurs — sans modifier ni code ni BDD.

**Architecture :** 7 sous-agents d'audit **lecture seule** (découpage D1–D7 identique à l'audit 2026-06-24), lancés en parallèle, + 3 volets dynamiques menés par l'orchestrateur (vérités locales, état réel BDD en lecture seule, sonde HTTP en GET anonymes). L'orchestrateur contre-lit les 🔴/🟠 dans le code avant consolidation. Seuls le rapport, les rapports bruts et STATUS.md sont écrits.

**Tech Stack :** Next.js 16.2.9 (App Router, React 19), Supabase (`@supabase/ssr` + service-role, pgvector), next-intl, Tailwind v4, Resend, Dropbox SDK, OpenAI (assistant RAG), Vitest (431 tests). TypeScript strict.

## Global Constraints

- **Lecture seule absolue** : les sous-agents n'utilisent QUE des outils de lecture (Read, Glob, Grep, Bash en lecture). Interdiction d'Edit/Write/commit de code. Aucune écriture BDD, aucun POST sur l'app (sonde = GET anonymes uniquement).
- **Livrable = rapport seul.** Aucun correctif dans ce cycle (remédiation = demande séparée).
- **Modèles** : Task 1 (Sécurité) = `claude-opus-4-8`. Tasks 2–7 = `claude-sonnet-4-6`. Volets dynamiques + consolidation = orchestrateur.
- **Sévérité (commune)** : 🔴 Critical (faille sécu / perte données / casse prod) · 🟠 High (bug fonctionnel, contrôle d'accès défaillant) · 🟡 Medium (dette réelle, edge case) · ⚪ Low (cosmétique/nit).
- **Format de finding imposé** (chaque agent le respecte) :
  ```
  [sévérité] Titre court
  - Fichier : chemin:ligne
  - Impact : conséquence concrète
  - Reproduction : comment l'observer / le déclencher
  - Fix suggéré : piste (NON appliquée)
  ```
- **Lab slug** minuscule : `paris` | `montreal`. Locales : `en` (défaut) | `fr`.
- **Invariants clés** : `createServiceClient()` construit SANS cookies de requête ; tout write via `/api/` en service-role ; `members.id === auth.users.id` ; règle confidentialité effective d'un document = `subject.confidentiel OU file.confidentiel`.
- **Décisions produit à NE PAS re-signaler comme failles** (chaque agent les reçoit) :
  1. **Emails membres = PUBLICS** (page Équipe + assistant) — voulu, ne pas re-masquer.
  2. **Publications partagées entre labos** — voulu (faux positif I1 de l'audit 06-28).
  3. **Pas d'isolation cross-lab pour les membres** : tous les membres agissent légitimement sur les 2 labos ; « transversal » = visibilité seule.
  4. **Différés assumés de l'audit 06-28** (re-signaler UNIQUEMENT si aggravés) : M2/M3 compteurs atomiques non faits ; CSP stricte différée (HSTS posé) ; M7/M10/M11/M15/M17/M19 (décisions produit/cosmétique) ; B3/M18 = config Vercel à la charge de l'utilisateur.
- **Référentiels conventions** : `CLAUDE.md`, `AGENTS.md` (racine). Maquettes via MCP Claude Design uniquement, jamais dans le repo.

## Repères de code (communs aux agents)

- Auth : `src/lib/auth.ts` (`getSession`, `requireMember`, `requireAdmin`, `authErrorResponse`).
- Clients Supabase : `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`. Middleware : `src/middleware.ts`.
- **37 routes API** sous `src/app/api/**/route.ts` (delta post-28/06 : `subjects/[id]/files/{route,sign,[fileId]}`, `subjects/[id]/relations`, `tasks/assist`, `admin/logs/[id]`, `assistant/*`, `report`).
- Types partagés : `src/types/index.ts`. Schéma : `supabase/migrations/001…014` (14 fichiers).
- RAG : `src/lib/rag/**` (dont `index-file.ts`, `index-source.ts`), extraction `src/lib/subjects/extract-text.ts`, upload `src/lib/subjects/file-upload.ts`.
- Relations/héritage : `src/lib/subjects/` (`resolveInheritance`), graphe `src/app/[locale]/graph/`, `src/components/graph/**` (d3-force).
- i18n : `messages/en.json`, `messages/fr.json` (+ `i18n jsonb` en BDD pour subjects/tasks). Tests : co-localisés `*.test.ts` (Vitest, env `node` par défaut).
- **Delta à pondérer (PRs #39–50, ~8 500 lignes)** : upload fichiers 3-temps signé, documents dans le RAG, relations/héritage/graphe, visibilité par document (cadenas), i18n + génération des tâches, admin logs regroupés + DELETE, scroll interne grille, bouton retour graphe.
- Audits précédents : `docs/AUDIT_2026-06-24.md`, `docs/AUDIT_2026-06-28.md` (lire la synthèse + le tableau de remédiation avant d'auditer).

---

## Task 0 : Préparation + vérités locales (orchestrateur)

**Files:**
- Create: `docs/audit-raw/2026-07-02/.gitkeep`
- Create: `docs/audit-raw/2026-07-02/verites-locales.md`

**Interfaces:**
- Produces: dossier `docs/audit-raw/2026-07-02/` où chaque Task dépose son rapport brut ; baseline build/tests/audit pour D7 et le rapport final ; build `.next` réutilisé par la sonde HTTP (Task 9).

- [ ] **Step 1 : Créer le dossier de collecte et vérifier l'état git**

```bash
mkdir -p "docs/audit-raw/2026-07-02" && touch "docs/audit-raw/2026-07-02/.gitkeep"
git status --porcelain
```
Expected: arbre propre (hormis fichiers non suivis du dossier de collecte).

- [ ] **Step 2 : Vérités locales — typecheck, lint, tests, build, npm audit**

```bash
npx tsc --noEmit ; echo "tsc=$?"
npm run lint ; echo "lint=$?"
npm test -- --run 2>&1 | tail -5
npm run build 2>&1 | tail -15
npm audit --json > docs/audit-raw/2026-07-02/npm-audit.json 2>/dev/null ; npm audit 2>&1 | tail -10
```
Expected: tsc/lint à 0, 431 tests verts, build OK (baseline annoncée par STATUS.md — confirmer ou signaler l'écart). Le JSON `npm audit` sert d'entrée à Task 7.

- [ ] **Step 3 : Consigner la baseline**

Écrire `docs/audit-raw/2026-07-02/verites-locales.md` : commit audité (`git rev-parse --short HEAD`), résultats exacts de chaque commande (code retour, nb de tests, warnings de build, compte de vulnérabilités par sévérité).

---

## Task 1 : Audit Sécurité & Auth (Opus, lecture seule)

**Files:**
- Create: `docs/audit-raw/2026-07-02/D1-securite.md`

**Interfaces:**
- Consumes: tout `src/`, `supabase/migrations/`, `src/middleware.ts`, synthèses des audits précédents.
- Produces: `D1-securite.md`, consommé par Task 10.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Sécurité**

Lancer un agent `general-purpose`, `model: "claude-opus-4-8"`, prompt EXACT :

> Tu es un auditeur sécurité en LECTURE SEULE sur un projet Next.js 16 + Supabase (FAME Website), 3ᵉ audit avant mise en production. Tu NE modifies AUCUN fichier, tu n'utilises que Read/Glob/Grep/Bash-lecture. Tu produis un rapport de findings.
>
> Lis d'abord : `docs/AUDIT_2026-06-28.md` (synthèse + tableau de remédiation) et `docs/STATUS.md`. Le code mergé depuis (PRs #39–50, ~8 500 lignes : upload de fichiers 3-temps signé, documents dans le RAG, relations/héritage/graphe, visibilité par document, i18n des tâches, admin logs) n'a JAMAIS été audité globalement — c'est ta priorité, sans négliger une régression sur le reste.
>
> Contexte sécurité critique :
> - Tous les writes passent par des routes `/api/` en client **service-role** (`createServiceClient()` de `src/lib/supabase/server.ts`). RLS activée partout ; le service-role la contourne côté API, c'est intentionnel. PIÈGE CONNU : `createServiceClient()` ne doit JAMAIS porter les cookies de la requête.
> - Helpers auth : `src/lib/auth.ts` (`getSession` nullable, `requireMember` → 401, `requireAdmin` → 403).
> - Secrets server-only : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `ASSISTANT_IP_SALT`, `REPORT_EMAIL`. Seuls `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` peuvent être `NEXT_PUBLIC_`.
> - **Règle confidentialité** : un sujet `confidentiel=true` n'est JAMAIS visible d'un visiteur non connecté (ni pages, ni API, ni RAG, ni relations/graphe). Un document (`subject_files`) est confidentiel si `subject.confidentiel OU file.confidentiel`. Les membres voient tout.
> - Décisions produit à NE PAS signaler comme failles : (1) emails membres PUBLICS (voulu) ; (2) publications partagées entre labos (voulu) ; (3) pas d'isolation cross-lab pour les membres (tous agissent sur les 2 labos ; « transversal » = visibilité seule) ; (4) différés assumés de l'audit 06-28 (M2/M3 compteurs atomiques, CSP stricte, M7/M10/M11/M15/M17/M19, B3/M18 config) — re-signale UNIQUEMENT si aggravés.
> - Pas d'auto-inscription ; l'admin invite (tokens d'activation).
>
> Audite et liste tout problème dans ces axes :
> 1. **Chaîne `confidentiel` de bout en bout** (priorité absolue — zone du bloquant B1 de juin et d'un CRITICAL corrigé en PR #48) : grille Lab (`src/app/[locale]/[lab]/page.tsx`), page Paper (`paper/[id]/page.tsx` : sujet, tâches, commentaires, fichiers, `generateMetadata`), `GET /api/subjects` + `/api/subjects/[id]` + `/api/subjects/[id]/tasks`, download `GET /api/subjects/[id]/files/[fileId]` (gate sujet OU fichier revérifié → 404 visiteur), RAG (`match_rag_chunks` filtre tier, `match_subject_files`, `list_entities`/outils assistant), **héritage/relations** : une fiche fille PUBLIQUE peut-elle exposer du contenu hérité d'une mère CONFIDENTIELLE (via `resolveInheritance`, la page graphe `/[locale]/graph`, `RelationsPanel`, les API relations) ? Le retier (`retierFile`, `syncSubjectFileVisibility`) peut-il laisser un chunk confidentiel en tier `public` ?
> 2. **Fuite de secrets côté client** : grep tout usage des secrets server-only ; vérifie qu'aucun composant `"use client"` ni import client n'y touche ; libs `dropbox`/`resend`/`openai` importées uniquement server-side.
> 3. **Construction de `createServiceClient()`** : toujours sans cookies, Authorization = service-role.
> 4. **Contrôle d'accès route par route** : pour CHACUNE des 37 routes sous `src/app/api/**/route.ts`, indique qui peut l'appeler (public / membre / admin) et si la garde est réellement appliquée sur CHAQUE méthode. Attention particulière au delta : `files/sign` + `files` (register) + `files/[fileId]` (GET/PATCH/DELETE), `relations`, `tasks/assist` (coût LLM → garde ?), `admin/logs/[id]` (DELETE, validation du paramètre `type`), `assistant/{chat,reindex,toggle}`, `report`.
> 5. **Validation des entrées** : payloads validés (types, longueurs, énumérations) ; upload : liste blanche MIME/taille (`validateUpload`, `src/lib/subjects/file-upload.ts`), path traversal sur noms de fichiers/chemins Storage (un fix `..` a déjà eu lieu — cherche les variantes), `fileId`/`subjectId` non validés ; injection dans les requêtes Supabase (`.or()` dynamiques, interpolation).
> 6. **RLS & migrations `011`–`014`** : policies cohérentes et restrictives ? `subject_relations`, colonnes `inherits`/`i18n`, `rag_chunks` (le tier est-il opposable côté SQL ?), bucket Storage privé.
> 7. **Middleware** : protection `/data`, `/prompts`, `/admin` correcte ; bypass possible ; court-circuit `/api/` sûr.
> 8. **Tokens & sessions** : activation (entropie, expiration, réutilisation), cookies httpOnly, sign-out.
> 9. **Rate-limiting & abus** : les routes publiques (`report`, `assistant/chat`, propositions, commentaires) gardent-elles leur rate-limit DB-backed après les refontes ? `tasks/assist` et la génération ✨ consomment le budget OpenAI — garde membre + budget ?
>
> Sévérité : 🔴 Critical (faille exploitable / fuite données / casse prod) · 🟠 High (contrôle d'accès défaillant) · 🟡 Medium · ⚪ Low.
> Format CHAQUE finding : `[sévérité] Titre` puis `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par (a) un tableau route × méthode × garde × verdict couvrant les 37 routes, (b) un tableau récapitulatif par sévérité. Renvoie TOUT le rapport en markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Écrire le markdown final de l'agent dans `docs/audit-raw/2026-07-02/D1-securite.md`.

- [ ] **Step 3 : Sanity-check de couverture**

Run: `find src/app/api -name route.ts | wc -l`
Expected: 37 — vérifier que le tableau route × méthode du rapport D1 couvre les 37 (sinon relancer l'agent sur les manquantes).

---

## Task 2 : Audit API & Données (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/2026-07-02/D2-api.md`

**Interfaces:**
- Consumes: `src/app/api/**`, `src/types/index.ts`, `supabase/migrations/**`, `src/lib/{rag,subjects,tasks}/**`.
- Produces: `D2-api.md`, consommé par Task 10.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit API**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur en LECTURE SEULE des routes API d'un projet Next.js 16 (App Router) + Supabase. Tu ne modifies AUCUN fichier (Read/Glob/Grep/Bash-lecture uniquement) et produis un rapport de findings. 3ᵉ audit : lis d'abord la synthèse de `docs/AUDIT_2026-06-28.md` — concentre-toi sur le code mergé depuis (upload fichiers, RAG documents, relations, i18n tâches, admin logs) sans négliger les régressions.
>
> Contexte Next.js 16 : `params`/`searchParams` sont des `Promise<{...}>` → toujours `await`. Conventions : write via `/api/` en service-role ; lab slug minuscule `paris|montreal` validé par handler → 404 ; 401 non connecté / 403 pas admin / 404 introuvable ; `PGRST116` → 404. Invariants : `members.id === auth.users.id` ; conversion proposition idempotente ; progression tâche dérivée des sous-tâches ; règle doc confidentiel = `subject.confidentiel OU file.confidentiel`.
> Décisions à ne pas signaler : emails membres publics ; publications partagées entre labos ; membres agissant sur les 2 labos ; différés 06-28 (M2/M3 compteurs, CSP…) sauf aggravation.
>
> Pour CHACUNE des 37 routes sous `src/app/api/**/route.ts`, audite :
> 1. **`await params`** partout où `params` est utilisé.
> 2. **Validation lab/id** et 404 si invalide.
> 3. **Gestion d'erreurs** : chaque appel Supabase vérifie `error` ? Codes HTTP corrects ? Pas de `data!` non vérifié ?
> 4. **Cohérence données ↔ schéma** : croise le code avec `supabase/migrations/001…014` et `src/types/index.ts`. Attention au delta : `subject_files` (+ colonne `confidentiel` de `014`), `subject_relations` + `subjects.inherits` (`013`), `tasks.i18n`/`subtasks.i18n` (`012`), `rag_chunks` + RPC `match_subject_files` (`011`). Colonne référencée absente ? Enum invalide ? Défauts incohérents ?
> 5. **Upload 3-temps signé** (`files/sign` → upload direct Storage → `files` register) : que se passe-t-il si le register n'arrive jamais (fichier orphelin dans Storage) ? Si le même chemin est signé deux fois ? La compensation en cas d'échec du register nettoie-t-elle ? Le DELETE purge-t-il Storage + chunks RAG ?
> 6. **Conditions de course / idempotence** : claim concurrent, reorder concurrent, double conversion, toggle confidentiel pendant réindexation (`retierFile` vs `indexSubjectFile`), suppression sujet pendant upload, `after()` (indexation background) qui échoue silencieusement.
> 7. **Relations** : anti-cycle réellement étanche (A→B→C→A) ? Doublons ? Suppression d'une mère → `inherits` orphelin purgé ? DELETE d'un sujet nettoie relations + fichiers + chunks ?
> 8. **Routes LLM** (`tasks/assist`, `subjects/[id]/assist`, traduction auto) : timeout géré, budget respecté, échec LLM → la sauvegarde réussit quand même (fallback documenté) ?
>
> Sévérité : 🔴/🟠/🟡/⚪ (Critical=perte/corruption données ou casse prod ; High=bug fonctionnel ; Medium=edge case ; Low=nit). Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau « route × méthode × verdict » (37 routes). Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/2026-07-02/D2-api.md`.

---

## Task 3 : Audit Frontend / React (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/2026-07-02/D3-frontend.md`

**Interfaces:**
- Consumes: `src/components/**`, `src/app/[locale]/**`.
- Produces: `D3-frontend.md`, consommé par Task 10.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Frontend**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur React/Next.js 16 en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings. 3ᵉ audit : pondère sur les composants ajoutés/refondus depuis fin juin — page graphe (`src/app/[locale]/graph/`, `src/components/graph/**`, d3-force), `FilesPanel` (upload/download/cadenas confidentiel), `RelationsPanel`, `VitrineEditor`, `SubjectGrid` (scroll interne), assistant (`src/components/assistant/**`), admin (`AssistantDashboard`, `LogsDashboard`).
>
> Contexte : App Router, React 19. Server Components par défaut ; `"use client"` explicite. `params`/`searchParams` = `Promise` à `await`. Mutations = fetch vers `/api/`, JAMAIS de Supabase direct en client pour écrire.
>
> Audite tout `src/components/**` et `src/app/[locale]/**` sur :
> 1. **Frontières client/serveur** : composant client important du code server-only ? `"use client"` manquant ? Données sensibles sérialisées d'un RSC vers un composant client (props contenant des champs confidentiels non affichés) ?
> 2. **Mutations** : appel Supabase direct en client pour écrire (anti-pattern).
> 3. **Hooks & cleanup** : d3-force (simulation arrêtée au démontage ?), globe D3, listeners (resize/pointer/drag/scroll), `requestAnimationFrame`, timers de toast/polling ; dépendances de hooks (stale closures, boucles de re-render).
> 4. **Hydratation** : `Date`, `Math.random`, `window`/`localStorage` au premier rendu ; `router.back()` du bouton retour graphe (comportement sans historique).
> 5. **Listes & `key`** : `.map()` avec key stable (graphe : nœuds/arêtes ; kanban ; fichiers).
> 6. **Upload côté client** : gestion d'échec à chacun des 3 temps (sign/upload/register), fichier trop gros, double clic, état de progression cohérent.
> 7. **Patterns Next 16** : `<a>` interne vs `next/link`, `<img>` vs `next/image`, `params` non awaité.
> 8. **Gestion d'erreur UI** : fetch sans vérif `res.ok`, états chargement/erreur/vide manquants, double-soumission.
>
> Sévérité : 🔴/🟠/🟡/⚪. Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau récapitulatif par sévérité. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/2026-07-02/D3-frontend.md`.

---

## Task 4 : Audit Qualité & Dette (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/2026-07-02/D4-qualite.md`

**Interfaces:**
- Consumes: tout `src/`, `CLAUDE.md`, `AGENTS.md`, `tsconfig.json`, `eslint.config.mjs`.
- Produces: `D4-qualite.md`, consommé par Task 10.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Qualité**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur qualité de code en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings. 3ᵉ audit : pondère sur le code post-28/06 (`src/lib/{rag,subjects,tasks}/**`, graphe, FilesPanel/RelationsPanel, admin) ; le reste a déjà été audité deux fois — n'y signale que du nouveau ou de l'aggravé.
>
> Référentiels : `CLAUDE.md` et `AGENTS.md` à la racine (lis-les en premier). Points clés : zéro chaîne hardcodée dans l'UI, tokens `fame-*` via Tailwind, structure de fichiers d'AGENTS.md, composants partagés `src/components/ui/` à réutiliser.
>
> Audite `src/` sur :
> 1. **TypeScript** : `any`, casts `as` non sûrs, `!` hasardeux, `@ts-ignore`/`@ts-expect-error`, types dupliqués vs `src/types/index.ts` (le projet est en `strict`).
> 2. **Code mort** : exports/composants/props non utilisés, imports inutiles, fichiers orphelins (ex. anciens composants remplacés — `SubjectCard` vs `SubjectVitrine`, pages supprimées comme `/admin/logs`).
> 3. **Duplication** : logique copiée (fetch+toast, validation, formatage, prompts LLM entre `src/lib/subjects/field-prompts.ts` et `src/lib/tasks/field-prompts.ts`, chunking entre sources RAG) à factoriser.
> 4. **Conventions** : écarts vs CLAUDE.md/AGENTS.md (routing, nommage lab/locale, placement, write via `/api/`).
> 5. **Config** : `eslint.config.mjs` (règles désactivées), `tsconfig` (options à recommander).
> 6. **Lisibilité** : fonctions/fichiers trop longs ou multi-responsabilités, nommage trompeur.
> 7. **Tests** : zones du delta sans test (extraction texte, retier, resolveInheritance, graphe) ; tests fragiles (mocks désynchronisés du vrai schéma).
>
> Lance aussi : `git grep -n "console.log" -- src` , `git grep -n "TODO\|FIXME\|XXX" -- src` , `git grep -n ": any\b" -- src` pour étayer. NE corrige rien.
>
> Sévérité : 🔴 (rare ici) / 🟠 (bug latent réel) / 🟡 (dette à traiter) / ⚪ (nit). Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau récapitulatif. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/2026-07-02/D4-qualite.md`.

---

## Task 5 : Audit i18n (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/2026-07-02/D5-i18n.md`

**Interfaces:**
- Consumes: `messages/en.json`, `messages/fr.json`, tout `src/`.
- Produces: `D5-i18n.md`, consommé par Task 10.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit i18n**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur i18n en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings. 3ᵉ audit : la parité en/fr est protégée par un test (`src/messages-parity.test.ts`) — vérifie qu'il couvre bien tout, puis pondère sur les namespaces ajoutés depuis fin juin (fichiers/upload, relations/graphe, adminLogs, assistant, tâches).
>
> Contexte : next-intl, locales `en` (défaut) et `fr`. Règle absolue : ZÉRO chaîne visible hardcodée — tout passe par `useTranslations()`/`getTranslations()`. Clés dans `messages/en.json` ET `messages/fr.json`. Le contenu BDD (subjects/tasks) est bilingue via colonne `i18n jsonb` + fallback colonnes plates — c'est un autre mécanisme, audite ses affichages (helper `localizedSubject`, `src/lib/tasks/localized.ts`) : un champ peut-il s'afficher dans la mauvaise langue sans fallback ?
>
> Audite :
> 1. **Parité des clés** : diff récursif des deux JSON (script node/jq). Toute clé asymétrique = finding.
> 2. **Clés mortes** : définies mais jamais référencées dans `src/`.
> 3. **Clés manquantes** : `t('x.y')` sans entrée → erreur runtime. Attention aux clés construites dynamiquement (`t(\`status.\${s}\`)`) : liste les valeurs possibles et vérifie chacune.
> 4. **Chaînes hardcodées** : texte user-facing en dur (JSX, `aria-label`, `title`, placeholders, toasts, `confirm()`, messages d'erreur renvoyés par les routes API et affichés tels quels).
> 5. **FR douteux** : valeurs FR = EN (trad oubliée).
> 6. **Interpolation** : placeholders `{name}` cohérents entre EN et FR.
> 7. **Contenu localisé BDD** : pages/servers utilisant `localizedSubject`/équivalent tâches partout où du contenu sujet/tâche s'affiche (grille, paper, graphe, kanban, assistant/citations) ; endroit qui lirait encore les colonnes plates directement ?
>
> Sévérité : 🟠 (clé manquante → crash, chaîne user-facing hardcodée) / 🟡 (parité cassée, FR=EN, mauvaise langue affichée) / ⚪ (clé morte). Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Annexe : liste exhaustive des clés désynchronisées/mortes. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/2026-07-02/D5-i18n.md`.

---

## Task 6 : Audit Perf · a11y · UX · SEO (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/2026-07-02/D6-perf-a11y.md`

**Interfaces:**
- Consumes: `src/components/**`, `src/app/**`, `src/app/globals.css`, `tailwind.config.ts`.
- Produces: `D6-perf-a11y.md`, consommé par Task 10.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Perf/a11y/UX/SEO**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur accessibilité / performance / UX / SEO en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings. 3ᵉ audit : pondère sur les surfaces ajoutées/refondues depuis fin juin — page graphe (d3-force : nœuds cliquables, zoom/pan), FilesPanel (upload, cadenas 🔒 toggle, badge dans l'ancre de download — UX déjà notée douteuse), RelationsPanel, scroll interne de la grille (`SubjectGrid`), assistant (SSE, composer), modales VitrineEditor/TaskModal.
>
> Contexte : décision projet = desktop-first en v1 (problèmes mobile = Low sauf casse totale). Tokens `fame-*` et animations prédéfinies dans `tailwind.config.ts`/`globals.css`.
>
> Audite :
> 1. **Accessibilité** : `alt` manquants, boutons-icônes sans `aria-label` (cadenas, ✨, crayon, suppression), champs sans label, modales (focus trap, `role="dialog"`, Escape), `div onClick` non focusable (cartes de la grille ? nœuds du graphe ?), contrastes douteux, `prefers-reduced-motion` (globe, graphe, animations).
> 2. **SEO / meta** : `metadata` par page (title/description), `generateMetadata` des pages dynamiques (paper : fuite du titre confidentiel déjà corrigée — vérifier), `lang` selon locale, Open Graph, `robots.txt`/`sitemap.xml` (le graphe et les nouvelles pages y sont-ils cohérents ?), hiérarchie de headings.
> 3. **Performance de rendu** : simulation d3-force (tick → setState par frame ? combien de nœuds tenables ?), grille (auto-fit du texte des cartes, re-render au scroll ?), listes sans virtualisation (si volume réaliste), `<img>` vs `next/image`, polices bloquantes, bundle (imports lourds côté client : d3, unpdf/fflate ne doivent être que server-side).
> 4. **UX** : états chargement/erreur/vide (upload, génération ✨, graphe vide), double-soumission, feedback après action (toggle cadenas, suppression), focus après fermeture de modale, réserve connue du scroll interne (zoom rogné en bord de scrollport — déjà documentée, ne re-signale que si pire).
>
> Sévérité : 🟠 (a11y bloquant clavier/lecteur d'écran, SEO critique) / 🟡 (a11y partiel, perf réelle) / ⚪ (cosmétique, mobile v2). Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau récapitulatif. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/2026-07-02/D6-perf-a11y.md`.

---

## Task 7 : Audit Config & Deploy-readiness (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/2026-07-02/D7-config-deploy.md`

**Interfaces:**
- Consumes: configs racine, `package.json`, `.gitignore`, `src/middleware.ts`, `docs/audit-raw/2026-07-02/npm-audit.json` (Task 0), `docs/superpowers/plans/2026-06-29-fame-deploiement.md`.
- Produces: `D7-config-deploy.md`, consommé par Task 10.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Config/Deploy**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur configuration & préparation au déploiement en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings. Cible : déploiement **Vercel + Supabase prod** imminent — c'est l'audit final avant mise en ligne. Lis d'abord `docs/superpowers/plans/2026-06-29-fame-deploiement.md` et la section Déploiement de `docs/STATUS.md`.
>
> Env vars attendues en prod : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` + `EMAIL_FROM`, `OPENAI_API_KEY`, `ASSISTANT_IP_SALT`, `REPORT_EMAIL`. Server-only : tout sauf les trois `NEXT_PUBLIC_*`.
>
> Audite :
> 1. **Env vars** : grep exhaustif `process.env.*` ; pour chacune : server-only vs `NEXT_PUBLIC_`, comportement si absente (fallback propre vs crash obscur vs **échec silencieux** — ex. `REPORT_EMAIL` absent → form « envoyé » sans mail). `.env.example` à jour ? `.env.local` gitignoré et absent de l'historique ?
> 2. **Limites Vercel** (nouveau vs audits précédents) : durée max des fonctions serverless vs routes longues (`assistant/chat` SSE, `tasks/assist`, indexation RAG, extraction pdf/docx via `unpdf`/`fflate`) ; `after()` (indexation background) — garanti d'aboutir sur Vercel ou tué à la fin de la réponse ? ; payload limite ~4,5 Mo (l'upload la contourne par URL signée — vérifier qu'aucun autre chemin n'envoie de gros payloads) ; cold starts vs connexions.
> 3. **Dépendances** : lis `docs/audit-raw/2026-07-02/npm-audit.json` et résume (sévérité, package, correctif). Versions majeures en retard risquées.
> 4. **`next.config.ts`** : `ignoreBuildErrors`/`ignoreDuringBuilds`, images, headers de sécurité (HSTS posé en juin — toujours là ? CSP différée — statu quo acceptable ?).
> 5. **Middleware** : matcher couvre les nouvelles pages (`/graph`, `/admin/assistant`) correctement ; `/data`/`/prompts`/`/admin` protégés ; court-circuit `/api/` sûr.
> 6. **Build & scripts** : scripts `package.json` cohérents ; `seed:admin` (guards env) ; `index:rag` (à rejouer en prod — documenté ?) ; artefacts gitignorés.
> 7. **Migrations `001`–`014`** : ordonnées, rejouables, cohérentes entre elles (une colonne créée puis re-créée ? un DROP dangereux ?). STATUS.md dit `001`–`014` appliquées en dev — la checklist prod doit TOUTES les rejouer : signale tout piège d'ordre ou de dépendance (extensions pgvector, buckets Storage créés hors migration ?).
> 8. **Checklist go-live** : produis une checklist ordonnée et actionnable (env vars → migrations → bucket → seed admin → index:rag → domaine Resend → vérifs post-deploy).
>
> Sévérité : 🔴 (secret commité/exposé, vuln critique, build cassé, migration qui casse) / 🟠 (env mal gérée → crash ou échec silencieux en prod, vuln high, limite Vercel dépassée) / 🟡 (config laxiste) / ⚪. Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par (a) tableau des env vars, (b) tableau des vulnérabilités npm, (c) la checklist go-live. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/2026-07-02/D7-config-deploy.md`.

---

## Task 8 : État réel BDD — lecture seule (orchestrateur)

**Files:**
- Create: `docs/audit-raw/2026-07-02/etat-bdd.md`
- Create (temporaire, hors repo): `<scratchpad>/db-audit.mjs`

**Interfaces:**
- Consumes: `.env.local` (URL + clés Supabase de dev).
- Produces: `etat-bdd.md` + les ids d'un éventuel sujet/document confidentiel (consommés par la sonde HTTP, Task 9) ; consommé par Task 10.

- [ ] **Step 1 : Écrire le script de vérification lecture seule dans le scratchpad de session**

Créer `<scratchpad>/db-audit.mjs` (JAMAIS dans le repo) :

```js
// Vérification LECTURE SEULE de l'état réel de la BDD Supabase (dev).
// Aucune écriture : uniquement des SELECT/HEAD, un appel RPC de lecture, listBuckets.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const service = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY)
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const out = { tables: {}, columns: {}, rpc: {}, storage: {}, rls_probe: {}, rag: {}, confidential: {} }

// 1. Présence des tables clés (une par migration significative) — HEAD count
for (const t of ['subjects','tasks','subtasks','members','comments','publications','prompts',
  'proposals','rag_chunks','chat_sessions','chat_unanswered','chat_flagged',
  'subject_files','subject_relations']) {
  const { count, error } = await service.from(t).select('*', { count: 'exact', head: true })
  out.tables[t] = error ? `ERREUR: ${error.message}` : `OK (${count} lignes)`
}

// 2. Colonnes des migrations 008-014 — select limité 1
for (const [t, cols] of [
  ['subjects', 'question,accroche,periode,i18n,inherits,confidentiel,is_transversal'],
  ['tasks', 'i18n'], ['subtasks', 'i18n'],
  ['subject_files', 'confidentiel,storage_path,mime_type,size_bytes'],
  ['subject_relations', 'kind,parent_id,child_id'],
]) {
  const { error } = await service.from(t).select(cols).limit(1)
  out.columns[`${t}(${cols})`] = error ? `ERREUR: ${error.message}` : 'OK'
}

// 3. RPC de lecture (vecteur nul, k=1 : aucun write)
const zero = JSON.stringify(Array(1536).fill(0))
for (const [fn, args] of [
  ['match_rag_chunks', { query_embedding: zero, match_count: 1, min_similarity: 0, tier: 'public' }],
  ['match_subject_files', { query_embedding: zero, match_count: 1, p_subject_id: '00000000-0000-0000-0000-000000000000' }],
]) {
  const { error } = await service.rpc(fn, args)
  out.rpc[fn] = error ? `ERREUR: ${error.message}` : 'OK'
}

// 4. Bucket Storage privé
const { data: buckets, error: bErr } = await service.storage.listBuckets()
out.storage = bErr ? `ERREUR: ${bErr.message}`
  : Object.fromEntries((buckets ?? []).map(b => [b.name, b.public ? 'PUBLIC (!)' : 'privé']))

// 5. Sonde RLS : le client ANON (sans session) doit être bloqué/limité par les policies
for (const t of ['members','prompts','chat_sessions','subject_files','rag_chunks']) {
  const { data, error } = await anon.from(t).select('*').limit(1)
  out.rls_probe[t] = error ? `bloqué (${error.code})` : `${(data ?? []).length} ligne(s) lisible(s) en anonyme`
}

// 6. État de l'index RAG (comptes par source_type et tier)
for (const st of ['subject','task','member','publication','kb','subject_file']) {
  const { count } = await service.from('rag_chunks').select('*', { count: 'exact', head: true }).eq('source_type', st)
  out.rag[`source_type=${st}`] = count ?? 0
}
for (const tier of ['public','member']) {
  const { count } = await service.from('rag_chunks').select('*', { count: 'exact', head: true }).eq('visibility_tier', tier)
  out.rag[`tier=${tier}`] = count ?? 0
}

// 7. Ids confidentiels pour la sonde HTTP (Task 9) — lecture seule
const { data: cs } = await service.from('subjects').select('id,labo,confidentiel').eq('confidentiel', true).limit(1)
out.confidential.subject = cs?.[0] ?? null
const { data: cf } = await service.from('subject_files').select('id,subject_id,confidentiel').eq('confidentiel', true).limit(1)
out.confidential.file = cf?.[0] ?? null
const { data: ps } = await service.from('subjects').select('id,labo').eq('confidentiel', false).limit(1)
out.confidential.publicSubject = ps?.[0] ?? null

console.log(JSON.stringify(out, null, 2))
```

Note : si le nom réel d'une colonne diffère (ex. `visibility_tier`), lire `supabase/migrations/006_assistant_rag.sql`/`011` pour ajuster le script AVANT de le lancer — le script doit refléter le schéma réel, pas l'inverse.

- [ ] **Step 2 : Exécuter et capturer**

Run: `node <scratchpad>/db-audit.mjs > docs/audit-raw/2026-07-02/etat-bdd.json`
Expected: JSON complet. Si `.env.local` incomplet ou BDD injoignable → noter « non vérifié » et passer (jamais bloquant).

- [ ] **Step 3 : Interpréter dans `etat-bdd.md`**

Rédiger `docs/audit-raw/2026-07-02/etat-bdd.md` : tableau migration → preuve observée (table/colonne/RPC OK ou ERREUR) pour `001`–`014` ; bucket privé oui/non ; résultat de la sonde RLS anonyme (toute table intégralement lisible en anonyme alors qu'elle ne devrait pas = finding 🔴/🟠 à remonter en consolidation — attention : certaines tables sont publiques par design, croiser avec les policies des migrations avant de conclure) ; comptes RAG ; présence ou non de données confidentielles pour la Task 9.

---

## Task 9 : Sonde HTTP — GET anonymes sur build de prod local (orchestrateur)

**Files:**
- Create: `docs/audit-raw/2026-07-02/sonde-http.md`

**Interfaces:**
- Consumes: build `.next` (Task 0), ids confidentiels/public de `etat-bdd.json` (Task 8).
- Produces: `sonde-http.md`, consommé par Task 10.

- [ ] **Step 1 : Démarrer le serveur de prod local sur un port dédié**

Run (en arrière-plan) : `npx next start -p 3100`
Attendre `curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/en` → `200` (réessayer ~20 s). Si le port 3100 est pris, prendre 3101. Si le serveur ne démarre pas → volet marqué « non exécuté », passer à Task 10.

- [ ] **Step 2 : Sonder les barrières et pages (GET anonymes uniquement, AUCUN POST)**

```bash
B=http://localhost:3100
for p in / /en /fr /en/paris /en/montreal /en/paris/tasks /en/paris/publications \
         /en/paris/team /en/paris/propose /en/graph /en/assistant /en/privacy \
         /robots.txt /sitemap.xml /en/lyon /en/auth/login ; do
  printf '%-28s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$B$p")"
done
# Pages membres → redirect attendu (302/307), pas 200 :
for p in /en/paris/data /en/paris/prompts /en/admin/proposals /en/admin/assistant ; do
  printf '%-28s %s -> %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$B$p")" \
    "$(curl -s -o /dev/null -w '%{redirect_url}' "$B$p")"
done
# Headers de sécurité :
curl -sI "$B/en" | grep -i 'strict-transport\|x-frame\|x-content-type\|referrer-policy\|content-security'
# API publiques : vérifier qu'aucun sujet confidentiel ne sort
curl -s "$B/api/subjects?lab=paris" | head -c 2000
```

Puis, avec les ids de Task 8 :
- Sujet confidentiel `<cid>` (labo `<clab>`) : `curl -s -o /dev/null -w '%{http_code}' "$B/en/<clab>/paper/<cid>"` → attendu **404** ; `"$B/api/subjects/<cid>"` → **404/403** ; vérifier aussi son absence du JSON de `/api/subjects?lab=<clab>`.
- Document confidentiel `<fid>` (sujet `<sid>`) : `curl -s -o /dev/null -w '%{http_code}' "$B/api/subjects/<sid>/files/<fid>"` → attendu **404**.
- Sujet public `<pid>` : `"$B/en/<plab>/paper/<pid>"` → attendu **200** (contrôle que les 404 ci-dessus ne sont pas un faux « tout est 404 »).
- Si `etat-bdd.json` ne fournit aucun id confidentiel : noter « gate confidentiel non testable en réel (aucune donnée confidentielle en BDD de dev) — couvert par les tests unitaires seulement ».

- [ ] **Step 3 : Arrêter le serveur et consigner**

Tuer le process `next start`. Rédiger `docs/audit-raw/2026-07-02/sonde-http.md` : tableau URL → code attendu → code observé → verdict ; headers présents/absents ; extrait du JSON `/api/subjects` (champs exposés — signaler tout champ interne inutile) ; limites (ce qui n'a pas pu être testé et pourquoi).

---

## Task 10 : Contre-lecture + consolidation en rapport maître (orchestrateur)

**Files:**
- Create: `docs/AUDIT_2026-07-02.md`
- Modify: `docs/STATUS.md` (section « Où on en est »)
- Read: `docs/audit-raw/2026-07-02/*.md`

**Interfaces:**
- Consumes: les 7 rapports bruts D1–D7 + `verites-locales.md` + `etat-bdd.md` + `sonde-http.md`.
- Produces: le rapport d'audit final, commité.

- [ ] **Step 1 : Lire les 10 artefacts bruts**

Run: `ls docs/audit-raw/2026-07-02/`
Expected: `D1-securite.md` … `D7-config-deploy.md`, `verites-locales.md`, `etat-bdd.md` (+ json), `sonde-http.md`. Les lire intégralement.

- [ ] **Step 2 : Contre-lire chaque 🔴 et 🟠 dans le code**

Pour CHAQUE finding 🔴/🟠 : ouvrir le fichier:ligne cité, vérifier que le problème existe réellement (pas un faux positif type I1 de juin : croiser avec les décisions produit, les tests existants et les différés assumés). Issue : **confirmé** (reste au rapport, éventuellement resévérisé) ou **écarté** (déplacé en annexe « écartés à la contre-lecture » avec la raison). Les 🟡/⚪ sont dédupliqués mais pas contre-lus un à un.

- [ ] **Step 3 : Rédiger le rapport maître**

Créer `docs/AUDIT_2026-07-02.md` :
1. **En-tête** : date, branche `main`, commit audité, périmètre (7 domaines + 3 volets dynamiques), méthode, rappel « rapport seul, aucun fix appliqué ».
2. **Synthèse exécutive** : tableau `Domaine × 🔴 × 🟠 × 🟡 × ⚪` + total ; liste numérotée des bloquants prod ; **verdict go/no-go argumenté** (avec conditions du go le cas échéant).
3. **Findings par domaine** (D1→D7), dédupliqués (deux agents sur le même fichier:ligne → fusion, angles notés), format imposé conservé, 🔴/🟠 marqués « contre-lu ✓ ».
4. **Résultats dynamiques** : vérités locales (build/tests/audit), état réel BDD (tableau migration → preuve, sonde RLS, comptes RAG), sonde HTTP (tableau URL → attendu → observé).
5. **Checklist go-live actualisée** (reprendre celle de D7, enrichie des constats).
6. **Annexe A — différés antérieurs** : chaque différé des audits 06-24/06-28 → statut (toujours acceptable / devenu bloquant / résolu entre-temps).
7. **Annexe B — écartés à la contre-lecture** : findings 🔴/🟠 rejetés + raison.

- [ ] **Step 4 : Vérifier la cohérence du rapport**

Relire : compteurs de synthèse = somme des findings ; aucun finding sans sévérité/fichier ; verdict découle des bloquants ; aucun différé assumé re-signalé sans aggravation. Corriger inline.

- [ ] **Step 5 : Mettre à jour STATUS.md**

Ajouter en tête de « Où on en est » : `**Audit pré-prod 2026-07-02** (lecture seule, 7 domaines + BDD + sonde HTTP) → docs/AUDIT_2026-07-02.md. Bloquants : <n> 🔴, <n> 🟠. Verdict : <go/no-go>. Remédiation = cycle séparé.`

- [ ] **Step 6 : Commit du rapport (aucun code modifié)**

```bash
git add docs/AUDIT_2026-07-02.md docs/audit-raw/2026-07-02 docs/STATUS.md
git commit -m "docs: rapport d'audit pré-prod 2026-07-02 (7 domaines + BDD + sonde HTTP)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 7 : Restituer la synthèse à l'utilisateur**

Message final : compteurs par sévérité, bloquants, verdict go/no-go, résultats des volets dynamiques (notamment gates confidentiel), et proposer — sans l'exécuter — un cycle de remédiation séparé.

---

## Notes d'exécution

- **Ordre** : Task 0 d'abord (baseline + build pour la sonde). Puis Tasks 1–8 **en parallèle** (7 agents + état BDD par l'orchestrateur). Task 9 après 0 et 8 (build + ids confidentiels). Task 10 en dernier.
- **Lecture seule** : si un sous-agent propose ou tente une modification, l'ignorer — seul son rapport compte.
- **Rapport incomplet** (couverture partielle, ex. tableau des 37 routes troué) : relancer l'agent concerné sur les manquants avant consolidation.
- **Volets dynamiques dégradés** : BDD injoignable / `.env.local` incomplet / serveur qui ne démarre pas → volet marqué « non vérifié » dans le rapport, jamais contourné en écriture.
- **MCP Claude Design** : indisponible pour les sous-agents ; la fidélité maquette n'est PAS dans le périmètre de cet audit (couverte par les revues des PRs UI).
