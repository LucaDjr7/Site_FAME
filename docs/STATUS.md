# FAME Website — État d'avancement

_Mettre à jour ce fichier après chaque tâche complétée._

Dernière mise à jour : 2026-06-23

---

## Phase active

**Phase 1 — Foundation** (non démarrée)

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
- [ ] Déplacer le scaffold de `_to_delete/` vers la racine du projet
- [ ] Vérifier que `npm run dev` démarre sans erreur
- [ ] Appliquer la migration SQL dans Supabase dashboard

### Task 1 — TypeScript Types (Opus)
- [ ] Créer `src/types/index.ts` avec tous les types partagés
- [ ] `npx tsc --noEmit` sans erreurs

### Task 2 — Schema BDD (Opus)
- [ ] Créer `supabase/migrations/001_initial_schema.sql`
- [ ] Appliquer dans Supabase dashboard → SQL Editor
- [ ] Vérifier toutes les tables dans Table Editor

### Task 3 — Admin Seed (Opus)
- [ ] Créer `src/scripts/seed-admin.ts`
- [ ] Ajouter `SEED_ADMIN_PASSWORD` dans `.env.local`
- [ ] `npm run seed:admin` → compte admin créé

### Task 4 — Auth Flow (Opus)
- [ ] `src/lib/auth.ts` — getSession, requireMember, requireAdmin
- [ ] `POST /api/auth/sign-in`
- [ ] `POST /api/auth/sign-out`
- [ ] `POST /api/auth/activate`
- [ ] Page login `src/app/[locale]/auth/login/page.tsx`
- [ ] Page activate `src/app/[locale]/auth/activate/[token]/page.tsx`
- [ ] Middleware étendu (protection /data, /prompts, /admin)

### Task 5 — UI Primitives (Sonnet)
- [ ] `Avatar`, `StatusBadge`, `SegmentedBar`, `Modal`, `Toast`, `ConfirmDialog`, `EditModeToggle`
- [ ] `ToastProvider` dans `src/app/[locale]/layout.tsx`

### Task 6 — TopBar + Navigation (Sonnet)
- [ ] `LanguageSwitcher`, `AuthButton`, `NavMenu`, `TopBar`
- [ ] `src/app/[locale]/[lab]/layout.tsx`

### Task 7 — Home Globe (Sonnet)
- [ ] `StarField`, `LabPin`, `Globe` (D3 + TopoJSON)
- [ ] `src/app/[locale]/page.tsx`
- [ ] Tester le globe sur `http://localhost:3000/en`

---

## Checklist — Phase 2 (Features)

_Voir `docs/superpowers/plans/2026-06-22-fame-website-p2-features.md`_

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
