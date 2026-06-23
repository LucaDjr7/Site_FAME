# FAME Website — État d'avancement

_Mettre à jour ce fichier après chaque tâche complétée._

Dernière mise à jour : 2026-06-23

---

## Phase active

**Phase 1 — Foundation TERMINÉE et validée** (Tasks 1–7 ✅, migration appliquée, admin seedé, **connexion vérifiée de bout en bout**). PR `feat/p1-foundation` ouverte. → Prochaine phase : **Part 2 Features (Task 8)**.

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

> **Carry-forwards de la revue finale Part 1 (à traiter en Part 2) :**
> - **Invariant** `members.id === auth.users.id` : le schéma a `default gen_random_uuid()` — la route `members/invite` **doit** fixer `members.id` à l'id du user Supabase Auth explicitement (ne jamais laisser le défaut).
> - Réconcilier le nom d'export de `src/lib/supabase/server.ts` (`createClient` vs `createServerClient` documenté) **avant** d'écrire les routes API.
> - Pages `/admin/*` : appliquer le rôle via `requireAdmin()` en RSC (le middleware n'est qu'une barrière d'auth).
> - Ajouter les index différés avant chargement de données : `dropbox_links(task_id)`, `task_subjects(subject_id)`.
> - Next 16 : renommer la convention `middleware` → `proxy` (avertissement de dépréciation).

- [ ] Task 8 — Page Lab (grille, filtres, barre segmentée)
- [ ] Task 9 — Page Paper (fiche détaillée, commentaires, navigation)
- [ ] Task 10 — Page Tasks (kanban, modal, sous-tâches, historique)
- [ ] Task 11 — Page Propose + workflow admin

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
