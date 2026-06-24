# FAME Website — État d'avancement

_Mettre à jour ce fichier après chaque tâche complétée._

Dernière mise à jour : 2026-06-24

---

## Phase active

**Phase de finition pré-prod (A+B+C) TERMINÉE** sur `feat/p4-pre-prod` → **PR #4** sur `main`. Audit fidélité graphique des 9 pages + TopBar (A0–A9), restyle admin immersif (B1) + nav admin vérifiée (B2), lot polish/dette technique (C1–C6). `tsc --noEmit` + `lint` (**0 warning**) + `npm run build` clean. Reste **D — Déploiement** (Task 20, plan superpowers dédié à venir).

> 🔍 **Audit complet (2026-06-24)** sur branche `audit` (base main post-PR#4) — 7 sous-agents lecture seule. Rapport : [`docs/AUDIT_2026-06-24.md`](./AUDIT_2026-06-24.md) (bruts dans `docs/audit-raw/`). **Verdict initial : NO-GO** — 3 bugs 🔴 (convert→sujet orphelin, `order` silencieux, race `claim`) + 4 🟠 bloquants (`GET /api/members` public, écritures cross-lab, injection HTML emails, `NEXT_PUBLIC_APP_URL` non gardé). Fond sain (service-role correct, 0 secret fuité, parité i18n parfaite).

> ✅ **Vague 0 — remédiation (2026-06-24) TERMINÉE** sur `audit` (subagent-driven, TDD Vitest — 1er harnais de tests du projet). 6 bloquants corrigés : **B1** convert compense le sujet orphelin si l'update échoue ; **B2** `order` valide l'entrée + remonte les erreurs (500) ; **B3** `claim` atomique via PK `task_assignees` (23505 = déjà réclamé) + erreurs remontées ; **B4** `GET /api/members` exige une session (trombinoscope public désormais vide pour anonyme — tradeoff accepté) ; **B6** échappement HTML des champs user dans les emails Resend ; **B7** garde explicite sur `NEXT_PUBLIC_APP_URL`. **B5 (écritures cross-lab) : isolation RETIRÉE par décision produit** — Dropbox partagé entre labos, tous les membres connectés agissent sur les 2 labos de la même manière ; la notion de « sujet transversal » (éditable par les 2 labos, le reste cloisonné) est reportée en **Vague 1** (nécessite une migration). 6 fichiers de tests / 22 tests verts, `tsc`/`lint` à 0. Revue finale Opus passée. PR `audit → main` à ouvrir.

> ✅ **Vague 1 — robustesse (D2/D3) + sujets transversaux (2026-06-24) TERMINÉE** sur `vague1` (branchée sur le tip de `audit`, subagent-driven, 13 tâches). **Phase 1 (robustesse, sans migration)** : F6/F7 PATCH subjects/tasks → 404 sur ligne introuvable (PGRST116) ; F8 DELETE `dropbox/links` → 404 sur 0 suppression ; F5 `activate` propage l'échec d'activation membre (500) et log le cleanup invitation ; F21/F06 garde `res.ok` avant suppression optimiste / parsing ; F05/F07 toast d'erreur sur commentaires & propositions admin ; F01 Globe initialise sa taille côté client (fin du risque d'hydratation) ; tests de garde F10 (keyframes globe dans globals.css) + F04 (`'use client'` FilterSidebar). _(F22/F02 vérifiés déjà corrects — pas de fix.)_ **Phase 2 (feature « transversal » = VISIBILITÉ SEULE, aucun `assertLabAccess` réintroduit)** : migration `004_transversal.sql` (colonne `is_transversal boolean NOT NULL DEFAULT false` sur `subjects` + `prompts`, **pas** sur publications) ; écriture du flag (POST/PATCH subjects, PATCH prompts, coercition `!!` aux 3 sites) ; listing élargi — sujets/prompts `.or('labo.eq.${lab},is_transversal.eq.true')`, publications **toujours partagées** (filtre labo retiré), tâches en cascade via `.in('sujet_id', visibleSubjectIds)` (héritage du sujet, `sujet_id` NOT NULL → pas d'orphelin) ; i18n (4 clés label/badge, lab + prompts, en+fr) ; UI checkbox (modale sujet + édition prompt) + badge « Transversal » (SubjectCard + PromptCard). **43 tests verts, `tsc`/`lint` à 0.** Revue finale Opus : **« Ready to merge »** (0 Critical/Important ; restes Minor/INFO cosmétiques différés). PR `vague1 → main` à ouvrir **après** merge PR #5 (vague 0).
>
> ⚠️ **Migration 004 = étape manuelle** : appliquer `supabase/migrations/004_transversal.sql` sur Supabase **avant** de promouvoir `vague1` (le code de listing/écriture suppose la colonne `is_transversal` présente au runtime).

_(Historique : Phase 3 — Secondary code terminé → PR #3 mergée dans `main`. `tsc`/`lint`/`build` clean tout du long.)_

> ⚠️ **Deploy gates avant mise en ligne** — état :
> - ✅ **Migrations Supabase prod appliquées** : `001` + `002_subject_difficulte_and_indexes.sql` + `003_proposal_subject_link.sql`. _(Aucune nouvelle migration depuis.)_
> - ✅ **Finition graphique (A+B+C)** close — voir [`docs/REVUE_PRE_PROD.md`](./REVUE_PRE_PROD.md).
> - ⏳ **Variables d'env prod** (Vercel) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (URL prod, sert aux liens d'activation), `DROPBOX_ACCESS_TOKEN` (sinon page Data → 503 dégradé), `RESEND_API_KEY` + `EMAIL_FROM` (sinon emails skip avec warn). Domaine expéditeur à vérifier dans Resend.
> - ⏳ `npm run seed:admin` à exécuter une fois sur la prod (compte admin `luca.desjardin@dauphine.eu`).
> - ⏳ **Déploiement (D / Task 20)** — plan superpowers dédié à rédiger.

---

## Plans d'implémentation

| Partie | Fichier | Contenu |
|---|---|---|
| Part 1 — Foundation | `docs/superpowers/plans/2026-06-22-fame-website-p1-foundation.md` | Types, schema SQL, seed, auth, UI primitives, TopBar, Globe |
| Part 2 — Features | `docs/superpowers/plans/2026-06-22-fame-website-p2-features.md` | Lab, Paper, Tasks, Propose |
| Part 3 — Secondary | `docs/superpowers/plans/2026-06-22-fame-website-p3-secondary.md` | Data, Publications, Prompts, Team, Emails |

---

## Checklist — Phase 1 (Foundation)

### Étape 0 — Setup initial
- [x] Déplacer le scaffold de `_to_delete/` vers la racine du projet (`_to_delete/` supprimé)
- [x] Vérifier que `npm run dev` démarre sans erreur (`/en`, `/fr`, `/en/paris`, `/en/montreal` → 200 ; lab invalide → 404 ; `tsc --noEmit` clean)
- [x] Appliquer la migration SQL dans Supabase dashboard _(appliquée — 14 tables présentes)_

### Task 1 — TypeScript Types (Opus) ✅
- [x] Créer `src/types/index.ts` avec tous les types partagés
- [x] `npx tsc --noEmit` sans erreurs

### Task 2 — Schema BDD (Opus) ✅
- [x] Créer `supabase/migrations/001_initial_schema.sql` (14 tables, index, RLS, trigger)
- [x] **Manuel** : appliquer dans Supabase dashboard → SQL Editor ✅
- [x] **Manuel** : vérifier toutes les tables dans Table Editor ✅

### Task 3 — Admin Seed (Opus) ✅
- [x] Créer `src/scripts/seed-admin.ts` (durci : récupération auth user existant + guards env)
- [x] **Manuel** : définir `SEED_ADMIN_PASSWORD` dans `.env.local` ✅
- [x] **Manuel** : `npm run seed:admin` → compte admin `luca.desjardin@dauphine.eu` créé ✅ _(rappel : `members.password_hash` reste NULL — le mot de passe vit dans `auth.users`, pas dans `members`)_

### Task 4 — Auth Flow (Opus) ✅
- [x] `src/lib/auth.ts` — getSession, requireMember, requireAdmin, AuthError, authErrorResponse
- [x] `POST /api/auth/sign-in`
- [x] `POST /api/auth/sign-out`
- [x] `POST /api/auth/activate`
- [x] Page login `src/app/[locale]/auth/login/page.tsx`
- [x] Page activate `src/app/[locale]/auth/activate/[token]/page.tsx`
- [x] Middleware étendu (protection /data, /prompts ; /admin = gate auth seul, rôle admin appliqué côté RSC via `requireAdmin()`)

### Task 5 — UI Primitives (Sonnet) ✅
- [x] `Avatar`, `StatusBadge`, `SegmentedBar`, `Modal`, `Toast`, `ConfirmDialog`, `EditModeToggle`
- [x] `ToastProvider` dans `src/app/[locale]/layout.tsx`

### Task 6 — TopBar + Navigation (Sonnet) ✅
- [x] `LanguageSwitcher`, `AuthButton`, `NavMenu`, `TopBar`
- [x] `src/app/[locale]/[lab]/layout.tsx`
- [x] Fix review : nom de labo via i18n (`nav.labParis`/`nav.labMontreal`), a11y `aria-expanded` sur le menu

### Task 7 — Home Globe (Sonnet) ✅
- [x] `StarField`, `LabPin`, `Globe` — **globe canvas D3 fidèle à la maquette** (décision utilisateur : maquette > brief simplifié)
- [x] Auto-rotation + drag, thème clair, pins coral masqués à l'arrière, anneaux orbitaux, étoiles 4 branches
- [x] `src/app/[locale]/page.tsx` + `public/world-110m.json` (TopoJSON world-atlas, fallback CDN)
- [x] Fix review : `pointercancel`, sync wrapper au resize, nettoyage dead-code, `title` pin
- [x] **Manuel** : rendu visuel du globe vérifié sur `http://localhost:3000/en` ✅ (« parfait »)

---

## Checklist — Phase 2 (Features)

_Voir `docs/superpowers/plans/2026-06-22-fame-website-p2-features.md`_

> **Carry-forwards Part 1 — TOUS traités en Part 2 :**
> - ✅ Index différés `dropbox_links(task_id)`, `task_subjects(subject_id)` → migration 002.
> - ✅ Pages `/admin/*` appliquent `requireAdmin()` en RSC (`admin/proposals/page.tsx`).
> - ✅ Export `createServiceClient`/`createClient` de `server.ts` utilisé directement par les routes API.
> - ⏭️ `middleware` → `proxy` (dépréciation non bloquante) et invariant `members.id === auth.users.id` côté `members/invite` : reportés en Part 3 (route invite construite en Part 3 / Task 16).

- [x] Task 8 — API Subjects (CRUD + reorder) ✅
- [x] Task 9 — Page Lab (grille poster, sidebar filtres cross-filtrés, add modal, edit/delete membre, drag-reorder) ✅ _(ajoute `subjects.difficulte` → migration 002)_
- [x] Task 10 — API Tasks + Comments (CRUD, claim, sous-tâches, task_history) ✅
- [x] Task 11 — Page Paper (fiche détaillée immersive, panneau Tasks, Files, Comments, nav vignettes) ✅
- [x] Task 12 — Page Tasks (kanban par sujet, modal détail, add modal, sous-tâches, sidebar cross-filtre) ✅
- [x] Task 13 — API Proposals (submit public, lecture visiteur/membre, accept/reject + convert) ✅
- [x] Task 14 — Page Propose (maquette fidèle) + dashboard admin Proposals ✅ _(convert idempotent → migration 003)_

> **Revue finale Part 2 (Opus) : « Ready to merge ».** Invariants sécurité tous respectés (aucune clé service-role/Dropbox dans un bundle client ; tous les writes via routes `/api/` service-role ; `/admin/proposals` protégé en RSC ; clients Supabase awaités ; lab validé partout ; i18n en/fr à parité, FR réel). Finding NF-1 (convert pouvait créer des sujets dupliqués) **corrigé** via migration 003 + convert idempotent. Findings mineurs restants → reportés Part 3 (lot polish : PGRST116→404 uniforme, clés i18n mortes, `<a>`→`Link` sur barres d'outils immersives, prop morte `TasksPanel`).

---

## Checklist — Phase 3 (Secondary)

_Voir `docs/superpowers/plans/2026-06-22-fame-website-p3-secondary.md`_

- [x] Publications — page (groupes par année, sidebar filtres croisés, ajout/suppr membres) ✅ _(`34eeb12`)_
- [x] Team / Trombinoscope — grille par rôle, invitation admin, self-edit + suppression ✅ _(`a9b6341`)_
- [x] Prompts — bibliothèque, sidebar par type, édition inline, copie/ajout/suppr (membres) ✅ _(`20c873a`)_
- [x] Data (Dropbox) — explorateur arborescent, liens dossiers↔sujets/tâches, token server-only (503 dégradé) ✅ _(`f4462ae`)_
- [x] Emails transactionnels — invitation membre + retour proposition (Resend, dégradé si pas de clé) ✅ _(`f5d53ea`)_
- [x] RGPD — page politique de confidentialité (EN+FR, i18n) + lien footer ✅ _(`84e5c83`)_
- [ ] **Task 20 — Déploiement** (manuel : GitHub + Vercel + Supabase prod + env vars — voir Deploy gates)

> **Note numérotation** : Task 13 (Propose) avait déjà été livrée en Part 2 (`Task 14` P2), donc sautée ici. Invariant `members.id === auth.users.id` désormais respecté par `members/invite` (création auth user → `id` réutilisé pour la ligne `members`). La suppression membre supprime explicitement l'utilisateur auth ET la ligne `members` (pas de cascade DB entre `auth.users` et `members`).

---

## Journal de Décisions

| Date | Décision |
|---|---|
| 2026-06-22 | Sous-tâches : pas d'avatars par sous-tâche dans le modal |
| 2026-06-22 | Dropbox : table `dropbox_link` many-to-many (un dossier → plusieurs sujets) |
| 2026-06-22 | Mobile : desktop-first v1, responsive en v2 |
| 2026-06-22 | Langue : EN par défaut, FR via next-intl — les deux dès la v1 |
| 2026-06-22 | Labo Montréal : démarre vide au lancement |
| 2026-06-22 | Seed : BDD vide sauf compte admin `luca.desjardin@dauphine.eu` |
| 2026-06-23 | Modèles : Opus 4.8 pour Tasks 1–4, Sonnet 4.6 pour Tasks 5+ |
| 2026-06-23 | Maquettes : accès via MCP Claude Design uniquement (pas de `docs/mockups/`) — connexion à claude.ai/design réservée à Opus |
| 2026-06-23 | Étape 0 : scaffold déplacé vers la racine, `_to_delete/` supprimé, `recap_projet_FAME.md` archivé dans `docs/` |
| 2026-06-23 | Fix scaffold : import Google Fonts placé **avant** `@import "tailwindcss"` dans `globals.css` (Tailwind v4 inline son contenu → tout `@import` doit précéder) |
| 2026-06-23 | Accueil : **maquette fidèle** retenue (globe canvas D3 auto-rotatif, thème clair, pins coral, anneaux orbitaux) plutôt que la version SVG simplifiée du brief Task 7 |
| 2026-06-23 | Part 1 Foundation terminée (Tasks 1–7) — revue finale Opus « Ready to merge », aucun finding bloquant |
| 2026-06-23 | Correctif seed : `seed-admin.ts` chargeait `.env` au lieu de `.env.local` → `config({ path: ['.env.local','.env'] })` (`81977fc`) |
| 2026-06-23 | Correctif seed : Node 20 sans WebSocket natif → polyfill `ws` passé en `realtime.transport` du client Supabase ; `ws`/`@types/ws` en devDeps (`603b6ba`) |
| 2026-06-23 | **Correctif login** : le middleware next-intl redirigeait `/api/*` → `/en/api/*` (307) → tout fetch API échouait, la page login affichait « mot de passe invalide » pour toute erreur. Court-circuit `/api/` avant next-intl + `api` exclu du matcher (`dc19522`). Connexion vérifiée 200 + cookie de session |
| 2026-06-23 | Rappel architecture : mot de passe stocké dans `auth.users` (Supabase Auth), `members.password_hash` volontairement NULL/inutilisé |
| 2026-06-24 | Part 2 : fidélité maquette intégrale retenue pour les pages (Lab, Paper, Tasks, Propose) — layouts immersifs à styles inline reproduisant les `.dc.html`, + champ difficulté |
| 2026-06-24 | Tasks/Paper : progression d'une tâche **dérivée** des sous-tâches (pas de champ `prog` stocké, barre en lecture seule) ; colonnes kanban = un par sujet ; assignation = se positionner/se retirer soi-même uniquement |
| 2026-06-24 | Proposals : `GET ?ids=` public (tracker visiteur via UUID non devinable) ; `?lab=` membre ; PATCH/convert admin ; `POST` soumission publique |
| 2026-06-24 | Convert idempotent (NF-1) : ajout `proposals.subject_id` (migration 003) — reconvertir une proposition déjà convertie renvoie le sujet existant au lieu d'en créer un doublon |
| 2026-06-24 | Part 2 Features terminée (Tasks 8–14) — revue finale Opus « Ready to merge », NF-1 corrigé |
| 2026-06-24 | Part 3 démarrée sur `feat/p3-secondary` (branchée sur `main` à jour après merge PR #2) — exécution via sous-agents Sonnet, Opus lit les maquettes via MCP + injecte le markup + revue + commit |
| 2026-06-24 | Publications : maquette riche (statut/keywords/abstract) réconciliée avec le schéma réel (lien unique) → langage visuel de la maquette lié aux champs réels ; stat « Publiées » remplacée par « auteurs distincts » |
| 2026-06-24 | Team : GET `/api/members` **public** (trombinoscope public) ; PATCH self limité à `email/domaines/photo_url`, admin à tout ; DELETE admin supprime auth user **+** ligne members (pas de cascade DB) ; invite crée auth user + members(`id`=auth id) + invitation compatible route activate |
| 2026-06-24 | Data : page `/data` membres-only via gate RSC (`getSession`→redirect), **pas** l'ancien probe `/api/members` 401 (GET members désormais public) ; arbre Dropbox chargé paresseusement par niveau ; `DROPBOX_ACCESS_TOKEN` server-only (lib `dropbox` importée seulement côté route) ; 503 dégradé si pas de token |
| 2026-06-24 | Emails (Resend) : helpers `send-invitation` / `send-proposal-result` non bloquants (try/catch + log) ; si `RESEND_API_KEY` absent → warn + skip (dev propre) ; expéditeur via `EMAIL_FROM` (défaut `noreply@fame-lab.eu`) |
| 2026-06-24 | RGPD : page sous `[locale]/privacy` (hors TopBar), contenu i18n (namespace `privacy`, EN+FR), lien footer ajouté au layout `[lab]` (avec `Link`, résout un item du lot polish Part 2) |
| 2026-06-24 | Part 3 code terminé (Publications, Team, Prompts, Data, Emails, RGPD) — `tsc`/`lint`/`build` clean. Reste Task 20 déploiement manuel |
| 2026-06-24 | Part 3 poussée → **PR #3** sur `main`. Migrations prod `001/002/003` **appliquées** (deploy gate migrations levé). Reste : env vars Vercel + `seed:admin` prod + revue pré-prod |
| 2026-06-24 | **Finition pré-prod (A+B+C)** sur `feat/p4-pre-prod` → PR #4. C1 PGRST116→404 (5 routes), C2 `<a>`→`Link` (toolbars), C3 prop morte `members`, C4 `Avatar`→`next/image` (0 warning), C5 footer sans scroll parasite, C6 clés i18n mortes. A0–A9 : audit fidélité MCP page par page (TopBar barre bleue opaque ; Lab converti en clair ; corrections inline-hex sur Tasks/Propose/Publications/Team/Data/Prompts). B1 admin restylé en immersif (logique/API inchangées), B2 lien nav admin vérifié. Décisions : pas de maquette admin (dérivé immersif) ; gestion membres reste dans Team (pas d'entrée admin dédiée v1) ; `EMAIL_FROM` reporté au plan D (déploiement). |
| 2026-06-24 | **Vague 0 — remédiation des bloquants** sur `audit` (subagent-driven, TDD Vitest). B1/B2/B3/B4/B6/B7 corrigés (voir bloc Audit). Introduit Vitest comme 1er harnais de tests (6 fichiers, 22 tests). |
| 2026-06-24 | **B5 — cross-lab : décision de NE PAS isoler.** Le Dropbox est partagé entre les deux labos ; tout membre connecté agit sur les deux labos de la même manière. La séparation souhaitée (membre cloisonné à son labo, sauf **sujets transversaux** éditables par les deux) exige une 3ᵉ valeur/flag sur `subjects.labo` → migration → reportée en Vague 1. `assertLabAccess` retiré (revert `2e2ccf3`). Le bloquant B5 de l'audit est assumé comme abandonné en v1. |
| 2026-06-24 | **Vague 1 — robustesse + sujets transversaux** sur `vague1` (subagent-driven, 13 tâches, 43 tests). Phase 1 : correctifs 🟠 D2/D3 (404 PATCH/DELETE, propagation erreurs activate, gardes `res.ok`, toasts d'erreur, hydratation Globe, tests de garde). Phase 2 : feature « transversal » **= visibilité seule** (aucun `assertLabAccess` réintroduit, `Lab='paris'|'montreal'` intact) — migration 004 (`is_transversal` sur subjects/prompts, pas publications), listing `.or(labo OR transversal)`, publications toujours partagées, cascade tâches via `sujet_id`, badge + checkbox UI. Revue finale Opus « Ready to merge ». Migration 004 à appliquer manuellement avant promotion. |
| 2026-06-24 | **Correctif auth majeur** (`cc133c5`) : `createServiceClient()` était bâti via `@supabase/ssr` **avec les cookies de la requête** → pour un utilisateur connecté, supabase-js mettait l'`Authorization` au JWT du user (cookie), écrasant la clé service-role → PostgREST exécutait les requêtes en rôle `authenticated` **sous RLS**, pas en `service_role`. Conséquence : le lookup `members` de `getSession()` renvoyait 0 ligne (PGRST116) pour tout utilisateur connecté → TopBar affichait « Sign in », `requireMember()`/`requireAdmin()` échouaient → la connexion semblait « déconnecter » sur toute page utilisant `getSession`. Corrigé en construisant le client service-role **sans cookies** via `@supabase/supabase-js` (Authorization = clé service-role, RLS contournée comme prévu). Vérifié : `/en/paris` connecté affiche le membre, `/en/admin/proposals` → 200. |
