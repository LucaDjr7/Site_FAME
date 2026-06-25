# FAME Website — Archive d'avancement

> Journal historique des phases **terminées**. Non lu en début de session — consultable à la demande.
> Source de vérité complète : `git log`. Décisions produit durables : fichiers mémoire + `AGENTS.md`/`CLAUDE.md`.
> État courant : voir [`STATUS.md`](./STATUS.md).

---

## Vue d'ensemble chronologique

1. **Phases 1–3 (Foundation / Features / Secondary)** — site complet livré (PR #1→#3 mergées). Globe, Lab, Paper, Tasks, Propose, Publications, Team, Prompts, Data, Emails, RGPD.
2. **Finition pré-prod (A+B+C)** — PR #4. Audit fidélité graphique 9 pages, restyle admin immersif, lot polish/dette.
3. **Audit complet (2026-06-24)** — 7 sous-agents lecture seule. Verdict initial NO-GO (3 🔴 + 4 🟠). Rapport `docs/AUDIT_2026-06-24.md` (bruts `docs/audit-raw/`).
4. **Vague 0 — remédiation** (PR #5, mergée) — 6 bloquants corrigés, intro de Vitest (1er harnais de tests).
5. **Vague 1 — robustesse + sujets transversaux** (PR #6, mergée) — migration `004`, feature « transversal » = visibilité seule.
6. **Vagues 2/3/4** — a11y/SEO, durcissement sécu/CI, dette/i18n. Branches stacked, soldées dans `main` (réparation via PR #10, voir plus bas).
7. **Bug Tailwind v4 `@config`** — découvert et corrigé (`29d5f62`).

---

## Détail des vagues

### Vague 0 — remédiation des bloquants (audit → PR #5)
**B1** convert compense le sujet orphelin si l'update échoue ; **B2** `order` valide l'entrée + remonte les erreurs (500) ; **B3** `claim` atomique via PK `task_assignees` (23505 = déjà réclamé) ; **B4** `GET /api/members` exigeait une session _(révisé en Phase 2 assistant : redevient public sans email)_ ; **B6** échappement HTML des champs user dans les emails Resend ; **B7** garde explicite sur `NEXT_PUBLIC_APP_URL`. **B5 (écritures cross-lab) : isolation RETIRÉE par décision produit** (voir mémoire `b5-cross-lab-pas-isolation`). 22 tests verts.

### Vague 1 — robustesse (D2/D3) + sujets transversaux (vague1 → PR #6)
Phase 1 (sans migration) : F6/F7 PATCH subjects/tasks → 404 (PGRST116) ; F8 DELETE dropbox/links → 404 ; F5 activate propage l'échec (500) ; F21/F06 garde `res.ok` ; F05/F07 toasts d'erreur ; F01 Globe init taille client ; tests de garde F10/F04. Phase 2 (feature « transversal » = **visibilité seule**, aucun `assertLabAccess`) : migration `004_transversal.sql` (`is_transversal` sur subjects+prompts, **pas** publications) ; listing `.or('labo.eq.${lab},is_transversal.eq.true')` ; publications toujours partagées ; tâches en cascade via `sujet_id` ; i18n + badge + checkbox. 43 tests verts. Revue Opus « Ready to merge ».

> **PR #5 + #6 MERGÉES dans `main`.** Migration `004` appliquée en BDD. PR #6 retargetée `audit → main` via API REST (`gh pr edit` bute sur un champ GraphQL Projects-classic déprécié).

### Vague 2 — a11y / SEO / perf / UX (vague2)
8 tâches, 12 commits `d9edef9..bd81018`. Implementers Sonnet, revue finale Opus « Ready to merge ».
- **S2** `sitemap.ts` + `robots.ts`. **S1/S3/S4/S5** `generateMetadata` localisée + `hreflang` + OpenGraph.
- **A1/A6/U6** Modal accessible (role=dialog, focus-trap, restitution focus). **A7** Toast `role=status`. **A2/A11** labels `htmlFor`/`id` + aria. Interactifs opérables clavier + ARIA + label globe i18n.
- **P1-P7/A10** perf : rAF pause sur onglet caché, `prefers-reduced-motion`, `preconnect`, `next/image`, `useMemo`, keyframes dans `globals.css`.
- **U1-U5** anti double-submit, `loading.tsx` (skeletons), toasts. 92 tests verts.

### Vague 3 — durcissement sécurité / config / CI (vague3)
9 tâches, commits `e6998be..6b0befb`. Implementers Opus.
- **Sec-4** bornes de longueur comments/proposals. **§3** `GET /api/proposals?ids=` : `select` restreint (exclut `proposant_email`/`commentaire_admin`).
- **CONV-04/§5** complexité mdp activation (≥8 + maj + chiffre). **Sec-6** rate-limit mémoire sliding-window (`src/lib/rate-limit.ts`) sur sign-in/comments/proposals → 429. ⚠️ Limiteur **par instance** (Map mémoire) → store partagé (Redis/Upstash) si multi-instance ; `clientIp` lit `x-forwarded-for` (fiable derrière proxy Vercel uniquement).
- **§6** migration `005_drop_password_hash.sql` (appliquée en BDD). **D7** 4 headers de sécurité ; `.env.example` ; `requireAdmin()` sur layout admin ; guards env explicites dans `server.ts` (**`createServiceClient()` reste sans cookies**).
- **CI** `.github/workflows/ci.yml` (typecheck + lint + test + `npm audit`). **CFG-02** `noUncheckedIndexedAccess` activé. 108 tests verts.

### Vague 4 — dette technique (D4) + i18n (D5) (vague4)
8 tâches. Implementers Sonnet, revue finale Opus.
- **D4** centralisations (`VALID_LABS`/`LAB_LABELS`/`FAME_PAGE_BG`, `dateBucket`, `apiFetch`, `DiffDots`/`form-styles`/`ROLE_KEY`/`TARGET_META`) ; typage honnête (suppression `any`/`!`, eslint-disable 6→2).
- **D5** test de parité EN/FR permanent (`src/messages-parity.test.ts`), kickers/labels extraits en clés, 19 clés mortes purgées.
- Migrations CSS : `fontFamily` inline → `font-serif`/`font-mono` ; hex chartés → tokens `fame-*` (exemptions documentées). 115 tests verts. 3 régressions visuelles attrapées avant merge (corrigées `4a7c5ab`, `86a860b`). Revue Opus « Changes needed » → 1 Important + 1 Minor corrigés.

> **Réparation des branches stacked (Phase 2 assistant, 2026-06-25)** : `origin/main` ne contenait que vague2 (PR #7) ; PR #8/#9 avaient mergé dans leurs bases intermédiaires, pas dans `main`, malgré le statut « MERGED ». Réparé via **PR #10 (vague4 → main)** mergée → `main` contient V2+V3+V4. Branches intermédiaires `vague2`/`vague3`/`vague4` supprimées (local + remote). **Leçon retenue** : la branche assistant est unique avec **une seule PR finale**.

---

## Bug systémique Tailwind v4 `@config` (résolu, `29d5f62`)

`tailwind.config.ts` n'était jamais chargé (directive `@config` manquante dans `globals.css`, pas de bloc `@theme`) → **toutes les classes `bg-fame-*`/`text-fame-*`/`border-fame-*` ne généraient aucun CSS** (12 tokens couleur morts). L'app « passait » car le reste est en styles inline hex. **Corrigé** par `@config "../../tailwind.config.ts"` (après `@import "tailwindcss"`). Re-vérif des 9 consommateurs : réactivation sûre (stylent en `className` seul). **⚠️ Ne JAMAIS retirer la ligne `@config`.** Voir mémoire `tailwind-fame-tokens-dead`.

Correctif auth lié (`cc133c5`) : `createServiceClient()` bâti via `@supabase/ssr` **avec cookies** mettait l'`Authorization` au JWT du user → PostgREST sous RLS → `getSession()` renvoyait 0 ligne. Corrigé : client service-role **sans cookies** via `@supabase/supabase-js`. Voir mémoire `service-role-no-cookies`.

---

## Checklists des phases terminées

### Phase 1 — Foundation (Tasks 1–7) ✅
Setup, types (`src/types/index.ts`), schema `001_initial_schema.sql` (14 tables, RLS, trigger), seed admin (`luca.desjardin@dauphine.eu` ; `members.password_hash` NULL — mdp dans `auth.users`), auth flow (sign-in/out/activate + pages + middleware), UI primitives (Avatar/StatusBadge/SegmentedBar/Modal/Toast/ConfirmDialog/EditModeToggle), TopBar+nav, Home Globe canvas D3 fidèle maquette.

### Phase 2 — Features (Tasks 8–14) ✅
API Subjects (CRUD+reorder), Page Lab (grille poster, sidebar filtres, drag-reorder ; ajoute `difficulte` → migration 002), API Tasks+Comments (claim, sous-tâches, history), Page Paper, Page Tasks (kanban), API Proposals, Page Propose + dashboard admin (convert idempotent → migration 003). Revue Opus « Ready to merge », NF-1 corrigé.

### Phase 3 — Secondary ✅
Publications (`34eeb12`), Team/Trombinoscope + invitation admin (`a9b6341`), Prompts (`20c873a`), Data/Dropbox explorateur + token server-only 503 dégradé (`f4462ae`), Emails Resend invitation + retour proposition (`f5d53ea`), RGPD `/privacy` EN+FR (`84e5c83`). Reste **Task 20 — Déploiement** (manuel, voir deploy gates dans STATUS.md). Invariant `members.id === auth.users.id` respecté par `members/invite`.

---

## Journal de Décisions (complet)

| Date | Décision |
|---|---|
| 2026-06-22 | Sous-tâches : pas d'avatars par sous-tâche dans le modal |
| 2026-06-22 | Dropbox : table `dropbox_link` many-to-many (un dossier → plusieurs sujets) |
| 2026-06-22 | Mobile : desktop-first v1, responsive en v2 |
| 2026-06-22 | Langue : EN par défaut, FR via next-intl — les deux dès la v1 |
| 2026-06-22 | Labo Montréal : démarre vide au lancement |
| 2026-06-22 | Seed : BDD vide sauf compte admin `luca.desjardin@dauphine.eu` |
| 2026-06-23 | Modèles : Opus 4.8 pour Tasks 1–4, Sonnet 4.6 pour Tasks 5+ |
| 2026-06-23 | Maquettes : accès via MCP Claude Design uniquement (pas de `docs/mockups/`) — connexion réservée à Opus |
| 2026-06-23 | Étape 0 : scaffold déplacé à la racine, `_to_delete/` supprimé |
| 2026-06-23 | Fix scaffold : import Google Fonts **avant** `@import "tailwindcss"` (Tailwind v4 inline son contenu) |
| 2026-06-23 | Accueil : maquette fidèle (globe canvas D3) retenue plutôt que SVG simplifié du brief |
| 2026-06-23 | Part 1 Foundation terminée — revue Opus « Ready to merge » |
| 2026-06-23 | Correctif seed : charger `.env.local` ; polyfill `ws` pour Supabase realtime (Node 20) |
| 2026-06-23 | **Correctif login** : middleware next-intl redirigeait `/api/*` → court-circuit `/api/` + exclu du matcher (`dc19522`) |
| 2026-06-23 | Architecture : mot de passe dans `auth.users`, `members.password_hash` volontairement NULL |
| 2026-06-24 | Part 2 : fidélité maquette intégrale (layouts immersifs reproduisant les `.dc.html`) |
| 2026-06-24 | Tasks/Paper : progression **dérivée** des sous-tâches ; kanban = 1 colonne/sujet ; assignation self-only |
| 2026-06-24 | Proposals : `GET ?ids=` public (tracker visiteur) ; `?lab=` membre ; PATCH/convert admin ; `POST` public |
| 2026-06-24 | Convert idempotent (NF-1) : `proposals.subject_id` (migration 003) |
| 2026-06-24 | Part 2 Features terminée — revue Opus « Ready to merge » |
| 2026-06-24 | Publications : maquette riche réconciliée avec schéma réel (lien unique) ; stat « auteurs distincts » |
| 2026-06-24 | Team : `GET /api/members` public ; PATCH self limité à `email/domaines/photo_url` ; DELETE admin supprime auth user + ligne members |
| 2026-06-24 | Data : `/data` membres-only via gate RSC ; arbre Dropbox lazy par niveau ; token server-only ; 503 dégradé |
| 2026-06-24 | Emails (Resend) : helpers non bloquants ; warn+skip si pas de clé ; expéditeur via `EMAIL_FROM` |
| 2026-06-24 | RGPD : page `[locale]/privacy` (hors TopBar), i18n namespace `privacy`, lien footer |
| 2026-06-24 | Part 3 code terminé ; poussée → PR #3 ; migrations `001/002/003` appliquées |
| 2026-06-24 | **Finition pré-prod (A+B+C)** → PR #4 (C1 PGRST116→404, C2 `<a>`→`Link`, C4 `next/image`, audit fidélité A0–A9, B1 admin immersif). Pas de maquette admin ; gestion membres reste dans Team |
| 2026-06-24 | **Vague 0** remédiation (TDD Vitest, 1er harnais) — B1/B2/B3/B4/B6/B7 |
| 2026-06-24 | **B5 cross-lab : NE PAS isoler** (Dropbox partagé, tous membres sur 2 labos ; transversal reporté V1). `assertLabAccess` retiré (`2e2ccf3`). Voir mémoire `b5-cross-lab-pas-isolation` |
| 2026-06-24 | **Vague 1** robustesse + transversal (= visibilité seule) — migration 004, revue Opus « Ready » |
| 2026-06-24 | **PR #5 + #6 MERGÉES.** Migration 004 appliquée. PR #6 retargetée via API REST |
| 2026-06-24 | **2 fixes UI** (`ed5d951`) — contournement `bg-[#hex]` (avant découverte du bug `@config`) |
| 2026-06-24 | **🐛 Bug Tailwind v4 `@config`** découvert puis **corrigé** (`29d5f62`). Voir section dédiée + mémoire `tailwind-fame-tokens-dead` |
| 2026-06-24 | **Correctif auth `createServiceClient` sans cookies** (`cc133c5`). Voir mémoire `service-role-no-cookies` |
| 2026-06-25 | **Vagues 2/3/4** terminées (a11y/SEO ; durcissement sécu/CI ; dette/i18n). Réparation branches stacked via PR #10 |
| 2026-06-25 | **Phase 2 — Assistant RAG** : brainstorming → spec validée → 5 plans rédigés (voir STATUS.md) |
