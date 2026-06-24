# FAME Website — État d'avancement

_Mettre à jour ce fichier après chaque tâche complétée._

Dernière mise à jour : 2026-06-24

---

## Phase active

**Phase 2 — Features TERMINÉE** (Tasks 8–14 ✅, revue finale Opus « Ready to merge », finding NF-1 corrigé). Branche `feat/p2-features` = 15 commits au-dessus de `main`, build/tsc clean. → Prochaine phase : **Part 3 Secondary (Data, Publications, Prompts, Team, Emails, RGPD)**.

> ⚠️ **Deploy gates avant mise en ligne de la Part 2** — appliquer manuellement dans le Supabase dashboard :
> - `supabase/migrations/002_subject_difficulte_and_indexes.sql` (colonne `subjects.difficulte` + index `task_subjects(subject_id)`, `dropbox_links(task_id)`)
> - `supabase/migrations/003_proposal_subject_link.sql` (colonne `proposals.subject_id` — convert idempotent)

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

- [ ] Task 12 — Page Data (Dropbox explorer)
- [ ] Task 13 — Page Publications
- [ ] Task 14 — Page Prompts
- [ ] Task 15 — Page Team (trombinoscope)
- [ ] Task 16 — Emails transactionnels (invitation, retour proposition)
- [ ] Task 17 — Politique de confidentialité RGPD

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
| 2026-06-24 | **Correctif auth majeur** (`cc133c5`) : `createServiceClient()` était bâti via `@supabase/ssr` **avec les cookies de la requête** → pour un utilisateur connecté, supabase-js mettait l'`Authorization` au JWT du user (cookie), écrasant la clé service-role → PostgREST exécutait les requêtes en rôle `authenticated` **sous RLS**, pas en `service_role`. Conséquence : le lookup `members` de `getSession()` renvoyait 0 ligne (PGRST116) pour tout utilisateur connecté → TopBar affichait « Sign in », `requireMember()`/`requireAdmin()` échouaient → la connexion semblait « déconnecter » sur toute page utilisant `getSession`. Corrigé en construisant le client service-role **sans cookies** via `@supabase/supabase-js` (Authorization = clé service-role, RLS contournée comme prévu). Vérifié : `/en/paris` connecté affiche le membre, `/en/admin/proposals` → 200. |
