# FAME Website — État d'avancement

_Mettre à jour ce fichier après chaque tâche complétée._

Dernière mise à jour : 2026-06-25

---

## Phase active

> 🟢 **REPRISE — état au 2026-06-24 (fin de session).** `main` = commit `29d5f62`, propre, à jour avec le remote (43 tests verts, `tsc`/`lint`/`build` à 0).
> - **Vague 0 (PR #5) ET Vague 1 (PR #6) sont MERGÉES dans `main`.** Migration `004_transversal.sql` **appliquée en BDD** par l'utilisateur.
> - **2 fixes UI livrés cette session** (`ed5d951`, commit direct sur `main`) : (1) bouton « confirmer » du `ConfirmDialog` invisible (blanc/blanc) → fond rouge rétabli ; (2) croix de suppression des tâches rognées → padding ajouté. Détails dans le Journal de Décisions.
> - **✅ Bug systémique Tailwind CORRIGÉ** (`29d5f62`, commit direct sur `main`) : ajout de `@config "../../tailwind.config.ts"` dans `globals.css` → en Tailwind v4 le config JS n'est plus chargé sans cette directive, donc toutes les classes `bg-fame-*` / `text-fame-*` / `border-fame-*` ne généraient aucun CSS (12 tokens couleur morts). Désormais générées (vérifié dans le CSS compilé). Re-vérif des 9 fichiers consommateurs faite (`auth/login`, `auth/activate`, `ui/StatusBadge`, `ui/EditModeToggle`, `ui/ConfirmDialog`, layouts `[lab]`/`admin`, `privacy`, `layout/LanguageSwitcher`) : réactivation **sûre partout** — ils stylent en `className` seul, aucun inline écrasé ; corrige des éléments jusque-là invisibles (boutons login/activate, écran succès activation, badges de proposition tracker+admin, état actif du sélecteur de langue). `StatusBadge` côté sujets/tâches + `EditModeToggle` = code mort (non monté) → sans effet visible. `ConfirmDialog` repassé sur les tokens sémantiques (contournement `bg-[#hex]` de `ed5d951` retiré). **⚠️ Ne PAS supprimer la ligne `@config`** sous peine de re-casser tous les `fame-*`. Voir mémoire `tailwind-fame-tokens-dead`.
> - **Prochaines pistes ouvertes** (non démarrées) : domaines **D4–D7 de l'audit** (dette technique, i18n résiduel, a11y/SEO, config) → Vagues 2–4 à cadrer (brainstorming → spec → plan) ; **déploiement (Task 20)**.

> ✅ **Vague 4 — dette technique (D4) + i18n (D5) (2026-06-25) TERMINÉE** sur `vague4` (branchée sur tip `vague3` `18faba6`, subagent-driven, 8 tâches). Implementers/reviewers UI **Sonnet 4.6**, revue finale whole-branch **Opus 4.8** (à venir). **Audit pré-prod intégralement soldé** (reste : déploiement, séparé).
> - **Centralisations (D4)** : `VALID_LABS`/`LAB_LABELS`/`FAME_PAGE_BG` (constants), `dateBucket`+`DateBucket` (utils), helper `apiFetch` (4 call-sites), composants partagés `DiffDots`/`form-styles`/`ROLE_KEY`/`TARGET_META`.
> - **Typage honnête (D4)** : `flattenTasks` au lieu de `any` (paper), cast `as Lab` **après** validation dans 5 routes (400 byte-identiques), callbacks typés `Subject`/`Publication`, Globe typé GeoJSON/`d3.GeoSphere`, `getContext('2d')` gardé, prop morte `isSelf` retirée. 0 nouveau `any`/`!`/`@ts-ignore` ; eslint-disable 6→2.
> - **i18n (D5)** : test de **parité EN/FR permanent** (`src/messages-parity.test.ts`), kickers/labels extraits en clés (`t('kicker',{lab:LAB_LABELS[lab]})`), FR `Prépublication`/`Document de travail`, **19 clés mortes purgées** (re-grep par namespace ; `common.cancel/confirm/close` conservées car vivantes).
> - **Migrations CSS** : `fontFamily` inline → `font-serif`/`font-mono` (par lots) ; couleurs hex chartées → tokens `fame-*` (par lots). **Exemptions documentées** (justifiées, zéro régression) : tables de lookup JS dynamiques (Toast/Avatar/SegmentedBar/DiffDots/STATUS_COLOR), gradients multi-stop, hex chartés dans les `.ts` (hors glob `**.tsx`), rgba, hex hors-charte (`#6b7596` ; `#18244c`=fame-navy-light & `#1f2e5c`=fame-blue-mid absents de la table du brief), bouton edit MemberGrid (texte `#b88c30` ≠ bordure `#e8b149`).
> - **115 tests verts, `tsc`/`lint` à 0, build OK, `@config` intact.** ⚠️ Trois régressions visuelles **attrapées avant merge** : (1) fix-wave CONV-01 trick currentColor changeant le texte actif MemberGrid #b88c30→#e8b149 → corrigée `4a7c5ab` ; (2) **revue finale Opus** — `PromptLibrary` intro `font-mono` au lieu de `font-serif` ; (3) `NavMenu` MEMBER_LINKS (data/prompts) ayant perdu `color:#2a3457` → (2)+(3) corrigées `86a860b`. Revue finale Opus 4.8 : **« Changes needed »** → 1 Important + 1 Minor corrigés, reste (DiffDots gap 0.5px, dette pré-existante) différable. **PR `vague4 → vague3` (stacked).**
>
> ✅ **Vague 3 — durcissement sécurité / config / CI (2026-06-25) TERMINÉE** sur `vague3` (branchée sur tip `vague2` `86d455d`, subagent-driven, 9 tâches, 9 commits `e6998be..6b0befb`). Implementers/reviewers **Opus 4.8** (sécu/CI). Soldage D1 (hors cross-lab won't-fix) + tout D7 + CFG-02.
> - **Sec-4** bornes de longueur : `POST /api/comments` (texte ≤ 4000, nom visiteur ≤ 80) ; `POST /api/proposals` (titre ≤ 300, description ≤ 5000, email validé). **§3** `GET /api/proposals?ids=` (public) : `select` restreint excluant `proposant_email` + `commentaire_admin` (fuite de données fermée ; branche admin `select('*')` intacte).
> - **CONV-04/§5** complexité mdp activation (≥ 8 + majuscule + chiffre → 400) ; garde array `order` (déjà en place, test ajouté).
> - **Sec-6** rate-limit mémoire sliding-window (`src/lib/rate-limit.ts`) branché sur sign-in (10/min), comments (20/min), proposals (10/min) → **429**. ⚠️ **Limiteur par instance** (Map mémoire) : suffisant pour la cible Vercel actuelle ; passer à un store partagé (Redis/Upstash) si multi-instance. ⚠️ **`clientIp` lit `x-forwarded-for`** : fiable uniquement derrière le proxy Vercel (qui réécrit l'en-tête) ; sur un déploiement self-hosted derrière un proxy mal configuré, l'en-tête est falsifiable → ré-évaluer la dérivation d'IP (en-tête de confiance plateforme) ou passer à un throttling scopé au compte pour sign-in.
> - **§6** migration `005_drop_password_hash.sql` (colonne morte ; auth via Supabase Auth). **✅ APPLIQUÉE EN BDD** par l'utilisateur (2026-06-25).
> - **D7** 4 headers de sécurité (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) sur `/:path*` ; `.env.example` (clés sans valeurs, prefixes `NEXT_PUBLIC_` corrects) ; `requireAdmin()` sur le layout admin (defense in depth au-delà du middleware) ; guards env explicites dans `server.ts` (plus de `process.env.X!` ; **`createServiceClient()` reste sans cookies**) ; `seed-admin` email via `SEED_ADMIN_EMAIL`.
> - **CI** `.github/workflows/ci.yml` (typecheck + lint + test + `npm audit`) + script `typecheck`. **CFG-02** `noUncheckedIndexedAccess` activé + 10 sites d'accès indexé gardés (vraies gardes, aucun `!`).
> - **108 tests verts, `tsc`/`lint` à 0, build OK.** Revue finale Opus 4.8 à venir. **PR `vague3 → vague2` (stacked).**
>
> ✅ **Vague 2 — a11y / SEO / perf / UX (2026-06-25) TERMINÉE** sur `vague2` (branchée sur `main` `5e634bb`, subagent-driven, 8 tâches, 12 commits `d9edef9..bd81018`). Implementers/reviewers UI **Sonnet 4.6**, revue finale whole-branch **Opus 4.8**.
> - **S2** `sitemap.ts` + `robots.ts` (toutes les pages publiques, dont `/tasks`). **S1/S3/S4/S5** `generateMetadata` localisée par page + `hreflang` + OpenGraph (paper valide le slug labo avant requête).
> - **A1/A6/U6** Modal accessible (role=dialog, focus-trap, restitution du focus, × i18n, `onClose` via ref stable). **A7** Toast `role=status`/`aria-live`. **A2/A11/U7/U8** labels `htmlFor`/`id` + aria sur formulaires & filtres. **A3/A4/A5/A8/A9/A12/F-HC-03** interactifs opérables au clavier + ARIA + label globe i18n.
> - **P1-P7/A10** perf : rAF en pause sur onglet caché, `prefers-reduced-motion`, `preconnect`, `next/image`, `useMemo`, keyframes déplacées dans `globals.css`.
> - **U1-U5** anti double-submit, `loading.tsx` (skeletons `[lab]/` + `paper/[id]/`), toast succès commentaire visiteur, textarea commentaire admin, PaperNav neutralisé en sujet unique.
> - **92 tests verts, `tsc`/`lint` à 0, build OK.** Parité i18n stricte vérifiée (383 clés en/fr identiques). `@config` intact. Revue finale Opus : **« Ready to merge »** (0 Critical/Important ; restes Minor cosmétiques loggés au ledger `.superpowers/sdd/progress.md`). **PR `vague2 → main` à ouvrir.** Suivront Vague 3 (durcissement sécu/CI, Opus) puis Vague 4 (dette/i18n, Sonnet), branches chaînées.

**Phase de finition pré-prod (A+B+C) TERMINÉE** sur `feat/p4-pre-prod` → **PR #4** sur `main`. Audit fidélité graphique des 9 pages + TopBar (A0–A9), restyle admin immersif (B1) + nav admin vérifiée (B2), lot polish/dette technique (C1–C6). `tsc --noEmit` + `lint` (**0 warning**) + `npm run build` clean. Reste **D — Déploiement** (Task 20, plan superpowers dédié à venir).

> 🔍 **Audit complet (2026-06-24)** sur branche `audit` (base main post-PR#4) — 7 sous-agents lecture seule. Rapport : [`docs/AUDIT_2026-06-24.md`](./AUDIT_2026-06-24.md) (bruts dans `docs/audit-raw/`). **Verdict initial : NO-GO** — 3 bugs 🔴 (convert→sujet orphelin, `order` silencieux, race `claim`) + 4 🟠 bloquants (`GET /api/members` public, écritures cross-lab, injection HTML emails, `NEXT_PUBLIC_APP_URL` non gardé). Fond sain (service-role correct, 0 secret fuité, parité i18n parfaite).

> ✅ **Vague 0 — remédiation (2026-06-24) TERMINÉE** sur `audit` (subagent-driven, TDD Vitest — 1er harnais de tests du projet). 6 bloquants corrigés : **B1** convert compense le sujet orphelin si l'update échoue ; **B2** `order` valide l'entrée + remonte les erreurs (500) ; **B3** `claim` atomique via PK `task_assignees` (23505 = déjà réclamé) + erreurs remontées ; **B4** `GET /api/members` exige une session (trombinoscope public désormais vide pour anonyme — tradeoff accepté) ; **B6** échappement HTML des champs user dans les emails Resend ; **B7** garde explicite sur `NEXT_PUBLIC_APP_URL`. **B5 (écritures cross-lab) : isolation RETIRÉE par décision produit** — Dropbox partagé entre labos, tous les membres connectés agissent sur les 2 labos de la même manière ; la notion de « sujet transversal » (éditable par les 2 labos, le reste cloisonné) est reportée en **Vague 1** (nécessite une migration). 6 fichiers de tests / 22 tests verts, `tsc`/`lint` à 0. Revue finale Opus passée. **PR #5 `audit → main` MERGÉE.**

> ✅ **Vague 1 — robustesse (D2/D3) + sujets transversaux (2026-06-24) TERMINÉE** sur `vague1` (branchée sur le tip de `audit`, subagent-driven, 13 tâches). **Phase 1 (robustesse, sans migration)** : F6/F7 PATCH subjects/tasks → 404 sur ligne introuvable (PGRST116) ; F8 DELETE `dropbox/links` → 404 sur 0 suppression ; F5 `activate` propage l'échec d'activation membre (500) et log le cleanup invitation ; F21/F06 garde `res.ok` avant suppression optimiste / parsing ; F05/F07 toast d'erreur sur commentaires & propositions admin ; F01 Globe initialise sa taille côté client (fin du risque d'hydratation) ; tests de garde F10 (keyframes globe dans globals.css) + F04 (`'use client'` FilterSidebar). _(F22/F02 vérifiés déjà corrects — pas de fix.)_ **Phase 2 (feature « transversal » = VISIBILITÉ SEULE, aucun `assertLabAccess` réintroduit)** : migration `004_transversal.sql` (colonne `is_transversal boolean NOT NULL DEFAULT false` sur `subjects` + `prompts`, **pas** sur publications) ; écriture du flag (POST/PATCH subjects, PATCH prompts, coercition `!!` aux 3 sites) ; listing élargi — sujets/prompts `.or('labo.eq.${lab},is_transversal.eq.true')`, publications **toujours partagées** (filtre labo retiré), tâches en cascade via `.in('sujet_id', visibleSubjectIds)` (héritage du sujet, `sujet_id` NOT NULL → pas d'orphelin) ; i18n (4 clés label/badge, lab + prompts, en+fr) ; UI checkbox (modale sujet + édition prompt) + badge « Transversal » (SubjectCard + PromptCard). **43 tests verts, `tsc`/`lint` à 0.** Revue finale Opus : **« Ready to merge »** (0 Critical/Important ; restes Minor/INFO cosmétiques différés). **PR #6 `vague1 → main` MERGÉE** (après PR #5).
>
> ✅ **Migration 004 appliquée** : `supabase/migrations/004_transversal.sql` exécutée en BDD par l'utilisateur (colonne `is_transversal` présente au runtime).

_(Historique : Phase 3 — Secondary code terminé → PR #3 mergée dans `main`. `tsc`/`lint`/`build` clean tout du long.)_

> ⚠️ **Deploy gates avant mise en ligne** — état :
> - ✅ **Migrations Supabase appliquées** : `001` + `002_subject_difficulte_and_indexes.sql` + `003_proposal_subject_link.sql` + `004_transversal.sql` (Vague 1) + `005_drop_password_hash.sql` (Vague 3).
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
| 2026-06-24 | **PR #5 (vague 0) + PR #6 (vague 1) MERGÉES dans `main`.** Migration `004_transversal.sql` **appliquée en BDD**. PR #6 a dû être retargetée `audit → main` via l'API REST (`gh pr edit` bute sur un champ GraphQL Projects-classic déprécié). `main` vérifié sain post-merge (43 tests, `tsc` clean). |
| 2026-06-24 | **2 fixes UI** (`ed5d951`, commit direct `main`). (1) `ConfirmDialog` : le bouton « confirmer » était blanc sur blanc — `bg-fame-red` est une classe Tailwind **morte** → fond transparent. Corrigé en valeur arbitraire `bg-[#c0473b]`/`bg-[#2f4486]` (génère réellement le CSS, vérifié dans le build). (2) `KanbanColumn` : croix de suppression des tâches rognées — `overflowY:auto` force `overflow-x:auto`, qui clippe les croix en `top/right:-7` ; `paddingBottom:8` → `padding:8` autour de la zone scrollable. |
| 2026-06-24 | **🐛 Bug systémique Tailwind v4 découvert.** `tailwind.config.ts` n'est jamais chargé : il manque la directive `@config` dans `globals.css` (et pas de bloc `@theme`). → **toutes les classes `bg-fame-*`/`text-fame-*`/`border-fame-*` ne génèrent aucun CSS** (vérifié : `#c0473b` absent du CSS compilé avant fix). 9 fichiers concernés. L'app « passe » car le reste est en styles inline hex. |
| 2026-06-24 | **✅ Bug Tailwind CORRIGÉ** (`29d5f62`, commit direct `main`). Ajout de `@config "../../tailwind.config.ts"` dans `globals.css` (après `@import "tailwindcss"`) → les 12 tokens `fame-*` génèrent enfin du CSS (vérifié : `#c0473b` ×5, `#2f4486` ×15, etc. dans `.next/static/chunks/*.css`). **Re-vérif visuelle des 9 consommateurs** : tous stylent en `className` seul (aucun `style` inline en compétition), donc la réactivation ne fait qu'**ajouter** la couleur de marque voulue, sans rien écraser. Wins : boutons login/activate + écran succès activation (étaient blanc/transparent → invisibles), badges `ProposalStatusBadge` (tracker sur carte `#fff`, admin) et état actif `LanguageSwitcher` (pill bleu sur navy, distinction aussi portée par la couleur de texte) rendent désormais. `SubjectStatusBadge`/`TaskStatusBadge`/`EditModeToggle` = **code mort** (non montés) → aucun effet. `ConfirmDialog` reverté du contournement `bg-[#hex]` (`ed5d951`) vers les tokens `bg-fame-red`/`bg-fame-blue`. Build/tsc/lint/43 tests OK. ⚠️ Ne jamais retirer la ligne `@config`. |
| 2026-06-24 | **Correctif auth majeur** (`cc133c5`) : `createServiceClient()` était bâti via `@supabase/ssr` **avec les cookies de la requête** → pour un utilisateur connecté, supabase-js mettait l'`Authorization` au JWT du user (cookie), écrasant la clé service-role → PostgREST exécutait les requêtes en rôle `authenticated` **sous RLS**, pas en `service_role`. Conséquence : le lookup `members` de `getSession()` renvoyait 0 ligne (PGRST116) pour tout utilisateur connecté → TopBar affichait « Sign in », `requireMember()`/`requireAdmin()` échouaient → la connexion semblait « déconnecter » sur toute page utilisant `getSession`. Corrigé en construisant le client service-role **sans cookies** via `@supabase/supabase-js` (Authorization = clé service-role, RLS contournée comme prévu). Vérifié : `/en/paris` connecté affiche le membre, `/en/admin/proposals` → 200. |
