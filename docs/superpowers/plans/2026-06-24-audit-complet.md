# Audit Complet FAME Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire un rapport d'audit priorisé unique recensant toutes les failles et erreurs de code du projet avant déploiement, sans modifier le code.

**Architecture :** 7 sous-agents d'audit **lecture seule**, un par domaine, lancés en parallèle. Chacun renvoie un rapport de findings classés par sévérité au format imposé. L'orchestrateur (Opus) consolide les 7 rapports en un document maître `docs/AUDIT_2026-06-24.md`. Aucun agent ne modifie le code ; le seul fichier écrit est le rapport.

**Tech Stack :** Next.js 16.2.9 (App Router, React 19), Supabase (`@supabase/ssr` + service-role), next-intl, Tailwind v4, Resend, Dropbox SDK. TypeScript strict déjà activé.

## Global Constraints

- **Lecture seule absolue** : les sous-agents d'audit n'utilisent QUE des outils de lecture (Read, Glob, Grep, Bash en lecture). Interdiction d'Edit/Write/commit de code. Ils ne corrigent rien — ils décrivent.
- **Modèles** : Task 1 (Sécurité) = `claude-opus-4-8`. Tasks 2–7 = `claude-sonnet-4-6`. Task 8 (consolidation) = orchestrateur Opus.
- **Severité (commune)** : 🔴 Critical (faille sécu / perte données / casse prod) · 🟠 High (bug fonctionnel, contrôle d'accès défaillant) · 🟡 Medium (dette réelle, edge case) · ⚪ Low (cosmétique/nit).
- **Format de finding imposé** (chaque agent le respecte) :
  ```
  [sévérité] Titre court
  - Fichier : chemin:ligne
  - Impact : conséquence concrète
  - Reproduction : comment l'observer / le déclencher
  - Fix suggéré : piste (NON appliquée)
  ```
- **Lab slug** toujours minuscule : `paris` | `montreal`. Locales : `en` (défaut) | `fr`.
- **Invariant clé connu** : `createServiceClient()` (`src/lib/supabase/server.ts`) doit être construit SANS les cookies de requête (sinon RLS s'applique au user connecté). Tout write passe par `/api/` en service-role. Mot de passe vit dans `auth.users`, `members.password_hash` est NULL volontairement. `members.id === auth.users.id`.
- **Référentiels conventions** : `CLAUDE.md`, `AGENTS.md` (racine) font foi. Maquettes via MCP Claude Design uniquement (projet `5bd688a8-2928-4c09-8d94-63f35b89ec74`), jamais dans le repo.

## Repères de code (communs aux agents)

- Auth : `src/lib/auth.ts` (`getSession`, `requireMember`, `requireAdmin`, `authErrorResponse`).
- Clients Supabase : `src/lib/supabase/server.ts` (`createServerClient`, `createServiceClient`), `src/lib/supabase/client.ts`.
- Middleware : `src/middleware.ts`. Routing i18n : `src/i18n/routing.ts`, `src/i18n/request.ts`.
- 25 routes API sous `src/app/api/**/route.ts`. Types partagés : `src/types/index.ts`.
- Schéma : `supabase/migrations/001_initial_schema.sql` + `002` + `003`.
- i18n : `messages/en.json`, `messages/fr.json`.
- Configs : `next.config.ts`, `tsconfig.json` (strict), `eslint.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`.

---

## Task 0 : Préparer le dossier de collecte des rapports

**Files:**
- Create: `docs/audit-raw/.gitkeep` (dossier de travail pour les 7 rapports bruts avant consolidation)

**Interfaces:**
- Produces: dossier `docs/audit-raw/` où chaque Task N>=1 dépose `D<N>-<domaine>.md`.

- [ ] **Step 1 : Créer le dossier de collecte**

```bash
mkdir -p "docs/audit-raw" && touch "docs/audit-raw/.gitkeep"
```

- [ ] **Step 2 : Vérifier l'arbre et l'état git propre**

Run: `git status --porcelain && find src -name '*.ts' -o -name '*.tsx' | wc -l`
Expected: arbre propre (hormis le `.gitkeep` non suivi), ~100 fichiers.

- [ ] **Step 3 : Capturer les faits de base partagés par les agents**

Run: `npx tsc --noEmit ; npm run lint ; npm audit --omit=dev --json > docs/audit-raw/npm-audit.json 2>/dev/null ; echo done`
Expected: établir la baseline (tsc/lint sont annoncés « clean » par STATUS.md — confirmer). Le JSON `npm audit` sert d'entrée à Task 7.

---

## Task 1 : Audit Sécurité & Auth (Opus, lecture seule)

**Files:**
- Create: `docs/audit-raw/D1-securite.md`

**Interfaces:**
- Consumes: tout `src/`, `supabase/migrations/`, `src/middleware.ts`.
- Produces: `D1-securite.md` (findings format imposé), consommé par Task 8.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Sécurité**

Lancer un agent `general-purpose`, `model: "claude-opus-4-8"`, prompt EXACT :

> Tu es un auditeur sécurité en LECTURE SEULE sur un projet Next.js 16 + Supabase (FAME Website). Tu NE modifies AUCUN fichier, tu n'utilises que Read/Glob/Grep/Bash-lecture. Tu produis un rapport de findings.
>
> Contexte sécurité critique :
> - Tous les writes passent par des routes `/api/` utilisant le client **service-role** (`createServiceClient()` de `src/lib/supabase/server.ts`). RLS est activée sur toutes les tables ; le service-role la contourne côté API, c'est intentionnel.
> - PIÈGE CONNU : `createServiceClient()` ne doit JAMAIS porter les cookies de la requête. S'il est construit via `@supabase/ssr` avec les cookies, supabase-js met l'Authorization au JWT du user et exécute sous RLS en rôle `authenticated` au lieu de `service_role`. Vérifie qu'il est bâti via `@supabase/supabase-js` sans cookies.
> - Helpers auth : `src/lib/auth.ts` (`getSession` nullable, `requireMember` → 401, `requireAdmin` → 403, `authErrorResponse`).
> - Secrets server-only : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY`. Seuls `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` peuvent être `NEXT_PUBLIC_`.
> - Deux labos indépendants : `paris` et `montreal`. Une fuite de données d'un labo vers l'autre est une faille.
> - Pas d'auto-inscription ; l'admin invite. Tokens d'activation dans le flux `auth/activate`.
>
> Audite et liste tout problème dans ces axes :
> 1. **Fuite de secrets côté client** : grep tout usage de `SERVICE_ROLE`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` ; vérifie qu'aucun composant client (`"use client"`) ni bundle ne les importe ; que la lib `dropbox`/`resend` n'est importée que dans des routes/`src/lib` server-only.
> 2. **Construction de `createServiceClient()`** : confirme l'absence de cookies, Authorization = clé service-role.
> 3. **Contrôle d'accès route par route** : pour CHACUNE des 25 routes sous `src/app/api/**/route.ts`, indique qui devrait pouvoir l'appeler (public / membre / admin) et si `requireMember`/`requireAdmin` est réellement appliqué sur CHAQUE méthode (GET/POST/PATCH/DELETE). Signale toute route mutative sans garde, ou GET exposant des données sensibles.
> 4. **Isolation des labos** : vérifie que les routes et pages filtrent bien par `lab` et qu'un membre/visiteur d'un labo ne peut pas lire/écrire les données de l'autre (paramètre `lab` validé, requêtes filtrées, IDs non devinables si exposés).
> 5. **Validation des entrées** : payloads POST/PATCH validés (types, longueurs, énumérations statut/rôle) ? Risque d'injection (requêtes Supabase construites avec entrée brute, `.or()`/filtres dynamiques) ? Upload/URL Dropbox.
> 6. **RLS & migrations** : lis `supabase/migrations/001_initial_schema.sql`, `002`, `003`. Les policies RLS sont-elles cohérentes et restrictives ? Une table sans RLS ? Une policy trop permissive ?
> 7. **Middleware** (`src/middleware.ts`) : la protection `/data`, `/prompts`, `/admin` est-elle correcte ? Bypass possible ? Le court-circuit `/api/` est-il sûr ?
> 8. **Tokens & sessions** : activation token devinable/réutilisable ? Cookies httpOnly ? Sign-out invalide bien la session ?
>
> Sévérité : 🔴 Critical (faille exploitable / fuite données / casse prod) · 🟠 High (contrôle d'accès défaillant) · 🟡 Medium · ⚪ Low.
> Format CHAQUE finding : `[sévérité] Titre` puis lignes `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau récapitulatif (compte par sévérité). Renvoie TOUT le rapport en markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Écrire le markdown final de l'agent dans `docs/audit-raw/D1-securite.md` (l'orchestrateur copie le message de l'agent tel quel).

- [ ] **Step 3 : Sanity-check de couverture**

Run: `find src/app/api -name route.ts | wc -l`
Expected: 25 — vérifier que le rapport D1 couvre bien les 25 routes (sinon relancer l'agent sur les manquantes).

---

## Task 2 : Audit API & Données (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/D2-api.md`

**Interfaces:**
- Consumes: `src/app/api/**`, `src/types/index.ts`, `supabase/migrations/**`.
- Produces: `D2-api.md`, consommé par Task 8.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit API**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur en LECTURE SEULE des routes API d'un projet Next.js 16 (App Router) + Supabase. Tu ne modifies AUCUN fichier (Read/Glob/Grep/Bash-lecture uniquement) et produis un rapport de findings.
>
> Contexte Next.js 16 : `params` et `searchParams` des handlers/pages sont des `Promise<{...}>` → ils DOIVENT être `await`és. Oublier `await params` est un bug.
> Conventions : tout write passe par `/api/` en service-role. Lab slug minuscule `paris|montreal`, validé dans CHAQUE handler → 404 si invalide. Codes : 401 non connecté, 403 pas admin, 404 introuvable. Convention projet : une erreur Supabase `PGRST116` (0 ligne) doit être mappée en 404.
> Invariants : `members.id === auth.users.id` ; `proposals.subject_id` rend la conversion idempotente ; progression d'une tâche dérivée des sous-tâches (pas de champ stocké).
>
> Pour CHACUNE des 25 routes sous `src/app/api/**/route.ts` (et sous-routes `[id]/subtasks`, `[id]/claim`, `[id]/convert`, `[id]/order`, `dropbox/tree`, `dropbox/links`), audite :
> 1. **`await params`** présent partout où `params` est utilisé.
> 2. **Validation du lab** (où pertinent) et retour 404 si invalide.
> 3. **Gestion d'erreurs** : chaque appel Supabase vérifie `error` ? Codes HTTP corrects et cohérents ? `PGRST116` → 404 ? Pas de 500 silencieux ni de `data!` non vérifié ?
> 4. **Cohérence des données** : payload écrit correspond aux colonnes réelles (croise avec `supabase/migrations/001_initial_schema.sql` + `002` + `003`) et aux types de `src/types/index.ts` ? Champs obligatoires manquants, énumérations invalides ?
> 5. **Conditions de course / idempotence** : `tasks/[id]/claim` (deux membres en parallèle), `subjects/[id]/order` (reorder concurrent), `proposals/[id]/convert` (double conversion). Y a-t-il une garantie (transaction, contrainte unique, upsert) ou un risque de doublon/écrasement ?
> 6. **Méthodes** : DELETE nettoie-t-il bien les dépendances (ex. suppression membre → auth user + ligne members, pas de cascade DB) ? PATCH partiels sûrs ?
> 7. **Schéma ↔ migrations** : incohérences entre `001/002/003` et l'usage dans le code (colonne référencée mais absente, index manquant sur une FK chaude).
>
> Sévérité : 🔴/🟠/🟡/⚪ (Critical=perte/corruption données ou casse prod ; High=bug fonctionnel/mauvais code HTTP exploité ; Medium=edge case ; Low=nit). Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau « route × méthode × verdict ». Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final de l'agent dans `docs/audit-raw/D2-api.md`.

---

## Task 3 : Audit Frontend / React (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/D3-frontend.md`

**Interfaces:**
- Consumes: `src/components/**`, `src/app/[locale]/**`.
- Produces: `D3-frontend.md`, consommé par Task 8.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Frontend**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur React/Next.js 16 en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings.
>
> Contexte : App Router, React 19. Server Components par défaut ; `"use client"` explicite pour l'interactivité. `params`/`searchParams` des pages sont des `Promise` à `await`. Pages read-heavy = RSC avec client serveur ; mutations = fetch vers `/api/`. JAMAIS d'appel Supabase direct depuis un composant client pour une mutation.
>
> Audite tout `src/components/**` et `src/app/[locale]/**` sur :
> 1. **Frontières client/serveur** : un composant `"use client"` importe-t-il du code server-only (secret, `createServiceClient`, lib `dropbox`/`resend`) ? Un RSC utilise-t-il des hooks/handlers interdits ? `"use client"` manquant là où il y a `useState`/`useEffect`/`onClick` ?
> 2. **Mutations** : un composant client appelle-t-il Supabase directement pour écrire au lieu de passer par `/api/` ? (anti-pattern à signaler)
> 3. **Hooks & cleanup** : `useEffect` avec listeners (resize, pointer, drag) ou animations (globe D3 `src/components/globe/Globe.tsx`, requestAnimationFrame) nettoient-ils bien au démontage ? Dépendances de hooks correctes (stale closures, boucles de re-render) ?
> 4. **Hydratation** : usage de `Date`, `Math.random`, `window`/`localStorage` au premier rendu pouvant diverger serveur/client ?
> 5. **Listes & `key`** : `.map()` avec `key` stable (pas l'index quand l'ordre change) ?
> 6. **Code/props morts** : props déclarées non utilisées, état jamais lu, handlers morts.
> 7. **Patterns Next 16** : `<a>` interne au lieu de `next/link` ; `<img>` au lieu de `next/image` ; `params` non awaité dans une page/layout.
> 8. **Gestion d'erreur UI** : fetch sans gestion d'échec, états de chargement manquants, `await fetch` sans vérif `res.ok`.
>
> Sévérité : 🔴/🟠/🟡/⚪. Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau récapitulatif par sévérité. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/D3-frontend.md`.

---

## Task 4 : Audit Qualité & Dette (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/D4-qualite.md`

**Interfaces:**
- Consumes: tout `src/`, `CLAUDE.md`, `AGENTS.md`, `tsconfig.json`, `eslint.config.mjs`.
- Produces: `D4-qualite.md`, consommé par Task 8.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Qualité**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur qualité de code en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings.
>
> Référentiels de conventions du projet : `CLAUDE.md` et `AGENTS.md` à la racine (lis-les en premier). Points clés : zéro chaîne hardcodée dans l'UI (i18n obligatoire), tokens couleur `fame-*` via Tailwind (pas de hex inline sauf maquette immersive assumée), structure de fichiers définie dans AGENTS.md, composants partagés dans `src/components/ui/` à réutiliser avant d'en créer.
>
> Audite tout `src/` sur :
> 1. **TypeScript** : `any` explicites ou implicites, casts non sûrs (`as`), `!` non-null hasardeux, `@ts-ignore`/`@ts-expect-error`, types dupliqués au lieu de réutiliser `src/types/index.ts`. (tsconfig est `strict`.)
> 2. **Code mort** : fonctions/exports/composants/variables non utilisés, imports inutiles, fichiers orphelins, props mortes.
> 3. **Duplication** : logique copiée-collée (fetch+toast, validation, formatage de dates) qui devrait être factorisée ; composants UI réinventés au lieu d'utiliser `src/components/ui/` (`Avatar`, `StatusBadge`, `Modal`, `Toast`, `ConfirmDialog`, etc.).
> 4. **Respect des conventions** : écarts vs CLAUDE.md/AGENTS.md (routing, nommage lab/locale, placement fichiers, écriture via `/api/`).
> 5. **Config** : `eslint.config.mjs` désactive-t-il des règles importantes ? Règles trop laxistes masquant des bugs ? `tsconfig` options manquantes (`noUncheckedIndexedAccess`, etc.) à recommander.
> 6. **Lisibilité** : fonctions trop longues, fichiers ayant trop de responsabilités, nommage trompeur.
>
> Lance aussi : `git grep -n "console.log"` , `git grep -n "TODO\|FIXME\|XXX"` , `git grep -n ": any\b"` pour étayer. NE corrige rien.
>
> Sévérité : 🔴 (rare ici) / 🟠 (bug latent réel) / 🟡 (dette à traiter) / ⚪ (nit). Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau récapitulatif. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/D4-qualite.md`.

---

## Task 5 : Audit i18n (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/D5-i18n.md`

**Interfaces:**
- Consumes: `messages/en.json`, `messages/fr.json`, tout `src/` (usages `useTranslations`/`getTranslations`).
- Produces: `D5-i18n.md`, consommé par Task 8.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit i18n**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur i18n en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings.
>
> Contexte : next-intl, locales `en` (défaut) et `fr`. Règle absolue du projet : ZÉRO chaîne visible hardcodée dans l'UI — tout passe par `useTranslations()` (client) ou `getTranslations()` (server). Les clés doivent exister dans `messages/en.json` ET `messages/fr.json` (parité stricte). La traduction FR doit être réelle, pas un copié de l'EN.
>
> Audite :
> 1. **Parité des clés** : compare `messages/en.json` et `messages/fr.json` clé par clé (récursif). Liste TOUTE clé présente dans l'un mais absente de l'autre. Utilise un script Bash/jq ou node pour diff les ensembles de chemins de clés.
> 2. **Clés mortes** : clés définies dans les JSON mais jamais référencées dans `src/` (grep du nom de namespace + clé).
> 3. **Clés manquantes** : appels `t('x.y')` dans le code sans entrée correspondante dans les JSON → erreur runtime.
> 4. **Chaînes hardcodées** : texte visible en dur dans le JSX (`<button>Save</button>`, titres, labels, placeholders, `aria-label`, `title`, messages de toast) au lieu d'une clé i18n. Concentre-toi sur le texte destiné à l'utilisateur.
> 5. **FR douteux** : valeurs FR identiques à l'EN laissant penser à une trad oubliée (signale comme Low/Medium).
> 6. **Interpolation** : placeholders `{name}` cohérents entre EN et FR.
>
> Sévérité : 🟠 (clé manquante → crash, ou chaîne user-facing hardcodée) / 🟡 (parité cassée, FR = EN) / ⚪ (clé morte). Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Fournis en annexe la liste exhaustive des clés désynchronisées. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/D5-i18n.md`.

---

## Task 6 : Audit Perf · a11y · UX · SEO (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/D6-perf-a11y.md`

**Interfaces:**
- Consumes: `src/components/**`, `src/app/**`, `src/app/globals.css`, `tailwind.config.ts`.
- Produces: `D6-perf-a11y.md`, consommé par Task 8.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Perf/a11y/UX/SEO**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur accessibilité / performance / UX / SEO en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings.
>
> Contexte : décision projet = desktop-first en v1 (le responsive complet est v2 — ne traite donc les problèmes mobile que comme Low, sauf casse totale). Tokens couleur `fame-*` et polices définis dans `tailwind.config.ts`/`globals.css`. Animations CSS prédéfinies (`fameFade`, `famePulse`, etc.).
>
> Audite :
> 1. **Accessibilité** : images sans `alt`, boutons/icônes sans texte ni `aria-label`, champs de formulaire sans `<label>`/`htmlFor`, modales sans gestion focus/`role="dialog"`/Escape, contrastes douteux (texte clair sur fond clair), ordre de tabulation, `aria-expanded` sur les menus, éléments cliquables non focusables (`div onClick` sans rôle/clavier).
> 2. **SEO / meta** : `metadata` Next.js présent par page (title/description) ? `lang` correct sur `<html>` selon la locale ? Open Graph ? `robots`/sitemap ? Titres `<h1>` uniques et hiérarchie de headings.
> 3. **Performance de rendu** : composants lourds non mémoïsés re-rendant inutilement, `useEffect` qui recalcule à chaque render, listes longues sans virtualisation (signaler seulement si volume réaliste), images non optimisées (`<img>` vs `next/image`), polices/CDN bloquants, animation D3/canvas coûteuse (globe) tournant hors écran.
> 4. **UX** : états de chargement/erreur/vide manquants, double-soumission de formulaire possible, feedback (toast) absent après action, focus perdu après modale.
> 5. **Fidélité maquette** : si tu as accès au MCP Claude Design (outil `DesignSync`, projet `5bd688a8-2928-4c09-8d94-63f35b89ec74`), compare 2-3 pages clés ; sinon, NE bloque pas — note « fidélité maquette non vérifiée (MCP indisponible en sous-agent) » et concentre-toi sur a11y/SEO/perf.
>
> Sévérité : 🟠 (a11y bloquant un utilisateur clavier/lecteur d'écran, SEO absent critique) / 🟡 (a11y partiel, perf) / ⚪ (cosmétique, mobile v2). Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par un tableau récapitulatif. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/D6-perf-a11y.md`.

---

## Task 7 : Audit Config & Deploy-readiness (Sonnet, lecture seule)

**Files:**
- Create: `docs/audit-raw/D7-config-deploy.md`

**Interfaces:**
- Consumes: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `package.json`, `.gitignore`, `src/middleware.ts`, `docs/audit-raw/npm-audit.json` (de Task 0).
- Produces: `D7-config-deploy.md`, consommé par Task 8.

- [ ] **Step 1 : Dispatcher le sous-agent d'audit Config/Deploy**

Agent `general-purpose`, `model: "claude-sonnet-4-6"`, prompt EXACT :

> Tu es un auditeur configuration & préparation au déploiement en LECTURE SEULE (Read/Glob/Grep/Bash-lecture). Tu ne modifies rien et produis un rapport de findings. Cible : déploiement Vercel + Supabase prod.
>
> Variables d'env attendues en prod : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (liens d'activation), `DROPBOX_ACCESS_TOKEN` (sinon page Data → 503 dégradé), `RESEND_API_KEY` + `EMAIL_FROM` (sinon emails skip avec warn). Server-only : service-role, Dropbox, Resend.
>
> Audite :
> 1. **Env vars** : grep tous les `process.env.*` du repo ; dresse la liste exhaustive ; pour chacune, indique server-only vs `NEXT_PUBLIC_`, et signale toute variable sensible accidentellement préfixée `NEXT_PUBLIC_`. Vérifie la gestion des absences (fallback/erreur claire vs crash obscur). Y a-t-il un `.env.example` à jour ? `.env.local` est-il bien gitignoré (`.gitignore`) et absent de l'historique git ?
> 2. **Dépendances** : lis `docs/audit-raw/npm-audit.json` (déjà généré) et résume les vulnérabilités (sévérité, package, correctif). Repère les versions épinglées risquées et les majeures en retard (compare `package.json` aux dernières connues si possible).
> 3. **`next.config.ts`** : options risquées (`ignoreBuildErrors`, `ignoreDuringBuilds` ESLint, images `unoptimized`/domaines non restreints), headers de sécurité (CSP, HSTS) absents.
> 4. **`tsconfig.json` / `eslint.config.mjs`** : strictness, règles désactivées (croise avec D4 mais focalise config build).
> 5. **Middleware** : matcher correct, pas de route protégée laissée hors couverture, le court-circuit `/api/` sûr.
> 6. **Build & scripts** : `package.json` scripts cohérents ; `seed:admin` sûr (guards env) ; pas de script destructeur ; artefacts (`.next`, `node_modules`) gitignorés.
> 7. **Migrations** : `supabase/migrations/001/002/003` rejouables/ordonnées ; STATUS.md dit prod à jour — signale toute migration locale non appliquée.
>
> Sévérité : 🔴 (secret commité/exposé, vuln critique, build cassé) / 🟠 (env mal gérée → crash prod, vuln high) / 🟡 (config laxiste) / ⚪. Format CHAQUE finding : `[sévérité] Titre` + `- Fichier : chemin:ligne` / `- Impact :` / `- Reproduction :` / `- Fix suggéré :`. Termine par (a) tableau des env vars et (b) tableau des vulnérabilités npm. Renvoie tout le rapport markdown comme message final.

- [ ] **Step 2 : Enregistrer le rapport brut**

Copier le markdown final dans `docs/audit-raw/D7-config-deploy.md`.

---

## Task 8 : Consolidation en rapport maître (Orchestrateur Opus)

**Files:**
- Create: `docs/AUDIT_2026-06-24.md`
- Read: `docs/audit-raw/D1..D7-*.md`

**Interfaces:**
- Consumes: les 7 rapports bruts de `docs/audit-raw/`.
- Produces: le rapport d'audit final, commité.

- [ ] **Step 1 : Lire les 7 rapports bruts**

Run: `ls docs/audit-raw/*.md`
Expected: `D1-securite.md` … `D7-config-deploy.md` (7 fichiers). Les lire intégralement.

- [ ] **Step 2 : Rédiger le rapport maître**

Créer `docs/AUDIT_2026-06-24.md` avec cette structure exacte :
1. **En-tête** : date, branche `feat/p4-pre-prod`, commit audité (`git rev-parse --short HEAD`), périmètre (7 domaines), méthode (sous-agents lecture seule).
2. **Synthèse exécutive** : tableau global `Domaine × #Critical × #High × #Medium × #Low` + total. Liste numérotée des **bloquants déploiement** (tous les 🔴 et 🟠 sécurité/données). **Verdict go/no-go** argumenté.
3. **Findings par domaine** (D1→D7) : recopier les findings de chaque rapport brut, dédupliqués (si deux agents pointent le même fichier:ligne, fusionner et noter les deux angles). Conserver le format imposé.
4. **Plan de remédiation suggéré** : ordre de traitement recommandé (Critical → High → reste), regroupé par fichier quand plusieurs findings le touchent. RAPPEL : suggestions uniquement, aucun fix appliqué.
5. **Annexe outillage** (recommandé, non appliqué) : `tsc` strict déjà ON ; recommander `noUncheckedIndexedAccess`, ajout d'un harnais de test (Vitest + tests des helpers auth et des routes critiques), CI GitHub Actions (`tsc`+`lint`+`build`+`npm audit`), résultats `npm audit`.

- [ ] **Step 3 : Vérifier la cohérence du rapport**

Relire : chaque domaine a une section ; les compteurs de la synthèse = somme des findings listés ; aucun finding sans sévérité ni fichier ; le verdict go/no-go découle des bloquants. Corriger inline.

- [ ] **Step 4 : Mettre à jour STATUS.md**

Ajouter une ligne au Journal de Décisions de `docs/STATUS.md` : `2026-06-24 | Audit complet pré-prod (7 domaines, lecture seule) → docs/AUDIT_2026-06-24.md. Bloquants : <n> Critical, <n> High. Verdict : <go/no-go>.`

- [ ] **Step 5 : Commit du rapport (pas de code modifié)**

```bash
git add docs/AUDIT_2026-06-24.md docs/audit-raw docs/STATUS.md
git commit -m "docs: rapport d'audit complet pré-prod (7 domaines, lecture seule)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6 : Restituer la synthèse à l'utilisateur**

Présenter en message : compteurs par sévérité, liste des bloquants, verdict go/no-go, et proposer (sans l'exécuter) un plan de correction séparé si l'utilisateur le souhaite.

---

## Notes d'exécution

- **Parallélisme** : Tasks 1–7 sont indépendantes et peuvent être dispatchées en parallèle (un seul message, plusieurs dispatch d'agents). Task 0 d'abord (prépare le dossier + `npm audit`), Task 8 en dernier (dépend des 7).
- **Lecture seule** : si un sous-agent propose ou tente une modification de code, l'ignorer — seul son rapport compte. Aucun code n'est touché par cet audit.
- **Si un rapport est incomplet** (couverture partielle), relancer l'agent concerné avec la liste précise des éléments manquants avant la consolidation.
- **MCP Claude Design** : indisponible pour les sous-agents Sonnet ; la fidélité maquette (D6) est donc « best effort » et non bloquante. Si l'utilisateur veut un audit maquette strict, l'orchestrateur Opus le fera séparément via le MCP.
