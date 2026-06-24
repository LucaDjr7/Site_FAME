# FAME — Plan de finition pré-production (A+B+C)

> **Pour exécutants agentiques :** SOUS-SKILL REQUISE — `superpowers:subagent-driven-development` (recommandé) pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

## Contexte

Le code de la Part 3 est terminé et **PR #3 mergée dans `main`** (`02249f2`), `tsc`/`lint`/`build` clean, migrations prod `001/002/003` appliquées. Avant de déployer (Task 20), `docs/REVUE_PRE_PROD.md` impose une phase de **finition** — pas de nouvelles features. Ce plan couvre **A (fidélité graphique aux maquettes), B (restyle de l'admin), C (lot polish / dette technique)**. Le **déploiement (D) fera l'objet d'un plan superpowers dédié ensuite**.

Décisions tranchées avec l'utilisateur pour ce plan :
- **Périmètre** : finition seule (A+B+C). Déploiement = plan séparé.
- **Admin** : **dériver** le langage immersif des pages existantes (pas de nouvelle maquette MCP).
- **Audit fidélité** : **ciblé + correctifs** (lire chaque maquette via MCP, prioriser les écarts probables, appliquer les fix).
- **Footer overflow** : **retirer le `min-h-screen` redondant** et réserver la hauteur du footer dans les `calc()`.

## Méthode (rappel REVUE_PRE_PROD)

- Exécution via **sous-agents Sonnet 4.6** ; **Opus 4.8 orchestre** : lit la maquette via le **MCP Claude Design** (`DesignSync` `get_file`, `projectId = 5bd688a8-2928-4c09-8d94-63f35b89ec74`), **injecte le markup** dans le prompt du sous-agent (Sonnet n'a pas le MCP), revoit, commit.
- **Pas de suite de tests automatisée** dans ce repo → la **vérification de chaque tâche** = `npx tsc --noEmit` + `npm run lint` + `npm run build` clean, **plus** un contrôle visuel (dev server `http://localhost:3000` et/ou comparaison MCP pour les tâches graphiques).
- Commit atomique par tâche (`feat:`/`fix:`/`chore:`) + mise à jour de `docs/STATUS.md` et des cases dans `docs/REVUE_PRE_PROD.md`.

## Branche de travail

Branche dédiée **`feat/p4-pre-prod`** (créée depuis `main` à jour après merge de #3). Tous les commits vont dessus ; **nouvelle PR (#4)** ouverte sur `main` en clôture.

## Ordre d'exécution recommandé

**Groupe C d'abord** (correctifs mécaniques isolés → base propre, évite le churn sur les pages immersives que A va aussi toucher), **puis A** (fidélité page par page), **puis B** (admin). C5/C2 touchent les mêmes pages immersives que l'audit A : les faire avant évite les conflits.

---

## Groupe C — Lot polish / dette technique

Tâches indépendantes, mécaniques, faibles en risque. Vérification commune : `tsc --noEmit` + `lint` + `build` clean.

### Tâche C1 — `PGRST116` → 404 uniforme sur les routes `/api/**/[id]`
**Constat (audit)** : `subjects/[id]` et `tasks/[id]` gèrent déjà le not-found → 404. Restent **5 routes** qui renvoient 500 au lieu de 404 :
- `src/app/api/proposals/[id]/route.ts`
- `src/app/api/publications/[id]/route.ts`
- `src/app/api/members/[id]/route.ts`
- `src/app/api/prompts/[id]/route.ts`
- `src/app/api/comments/[id]/route.ts`

**À faire** : dans chaque handler PATCH/DELETE, après l'appel Supabase, détecter `error.code === 'PGRST116'` (ou `!data`) et renvoyer `NextResponse.json({ error: 'Not found' }, { status: 404 })` avant le 500 générique. S'aligner exactement sur le pattern déjà présent dans `subjects/[id]/route.ts`. Vérifier que les `.select().single()` existent là où nécessaire pour que PGRST116 soit bien émis.
**Vérif** : `tsc`/`lint`/`build` + test manuel d'un `[id]` inexistant → 404.

### Tâche C2 — `<a>` → `next/link` sur les barres d'outils immersives
**Constat** : 3 ancres internes en full-reload :
- `src/components/tasks/KanbanBoard.tsx:234` → `/{locale}/{lab}`
- `src/components/lab/SubjectGrid.tsx:351` → `/{locale}/{lab}/propose`
- `src/components/lab/SubjectGrid.tsx:471` → `/{locale}/{lab}/tasks`

**À faire** : remplacer par `<Link href=…>` (`import Link from 'next/link'`) en **conservant à l'identique** les `style`/`className` inline. Le footer RGPD est déjà migré (`src/app/[locale]/[lab]/layout.tsx`).
**Vérif** : navigation client sans rechargement complet ; `tsc`/`lint`/`build`.

### Tâche C3 — Supprimer la prop morte `members` de `TasksPanel`
**Constat** : `src/components/paper/TasksPanel.tsx` déclare `members: MemberRef[]` (jamais utilisée). Passée depuis `src/components/paper/PaperView.tsx` (`members={members}`).
**À faire** : retirer la prop du type `Props` et de la signature dans `TasksPanel.tsx`, retirer `members={members}` à l'appel dans `PaperView.tsx`. Nettoyer l'import/variable devenus morts si plus utilisés.
**Vérif** : `tsc`/`lint`/`build` clean.

### Tâche C4 — `Avatar` : lever le warning `<img>`
**Constat** : `src/components/ui/Avatar.tsx:14` rend un `<img src={photoUrl}>` brut → warning `@next/next/no-img-element`.
**À faire** : migrer vers `next/image` en `unoptimized` (`import Image from 'next/image'`, `<Image … unoptimized width={size} height={size} />`) pour éviter de configurer `images.remotePatterns`, en gardant `className="rounded-full object-cover"`. Conserver intact le rendu initiales.
**Vérif** : `lint` sans warning ; rendu avatar identique sur `/team`.

### Tâche C5 — Footer RGPD : éliminer le débordement de scroll
**Constat** : `src/app/[locale]/[lab]/layout.tsx` met `min-h-screen` sur `<main>` **et** ajoute un footer séparé ; 6 pages immersives utilisent `calc(100vh - 3rem)` sans réserver le footer. Fichiers : `SubjectGrid.tsx:255`, `KanbanBoard.tsx:129`, `PromptLibrary.tsx`, `PublicationList.tsx`, `DataExplorer.tsx`, `MemberGrid.tsx`.
**À faire** (décision : *retirer le `min-h-screen` redondant*) :
1. Retirer `min-h-screen` du `<main>` du layout `[lab]` — vérifier qu'aucune page courte ne « remonte » le footer.
2. Mesurer la hauteur du footer et, dans les 6 `calc(100vh - 3rem)`, réserver aussi la hauteur du footer ou confirmer que le retrait du `min-h-screen` suffit à supprimer le débordement.
**Vérif** : sur chaque page immersive (FR+EN), plus de scrollbar parasite ; footer affiché une seule fois.

### Tâche C6 — Clés i18n mortes
**Constat** : `messages/en.json` et `messages/fr.json` à parité (373 clés). Reste à supprimer les clés non référencées.
**À faire** : vérifier l'absence d'usage de chaque clé feuille (grep `t('…')`/namespaces) ; supprimer les clés mortes **dans les deux fichiers simultanément** (parité stricte). Conserver les clés utilisées dynamiquement (statuts/rôles interpolés) en cas de doute.
**Vérif** : `tsc`/`lint`/`build` ; pages sans clé manquante ; en/fr à parité.

---

## Groupe A — Fidélité graphique aux maquettes (audit ciblé + correctifs)

**Une tâche par page.** Pour chacune : **Opus** lit la maquette via `DesignSync get_file` (`projectId` ci-dessus), compare le rendu réel à la maquette (tokens couleur, typo Roboto Slab / IBM Plex Mono, espacements, rayons, ombres, états hover/focus/edit-mode, modals/toasts, comportements), dresse une **liste d'écarts**, **injecte le markup** dans le prompt d'un sous-agent **Sonnet** qui applique les correctifs (inline-hex fidèles, pas d'approximation). Vérif : contrôle visuel comparé à la maquette + `tsc`/`lint`/`build`.

| Tâche | Page | Route | Maquette (`path`) | Composant principal |
|---|---|---|---|---|
| A0 | TopBar (transverse) | global | (barre bleue « MENU ») | `src/components/layout/TopBar.tsx`, `NavMenu.tsx` |
| A1 | Accueil / globe | `/[locale]` | `FAME Accueil.dc.html` | `src/components/globe/*`, `src/app/[locale]/page.tsx` |
| A2 | Lab (grille) | `/[locale]/[lab]` | `FAME Laboratoire.dc.html` | `src/components/lab/SubjectGrid.tsx` |
| A3 | Paper (fiche) | `…/paper/[id]` | `FAME Paper.dc.html` | `src/components/paper/PaperView.tsx` |
| A4 | Tasks (kanban) | `…/tasks` | `FAME Tasks.dc.html` | `src/components/tasks/KanbanBoard.tsx` |
| A5 | Propose | `…/propose` | `FAME Proposer.dc.html` | `src/components/propose/ProposePageClient.tsx` |
| A6 | Publications | `…/publications` | `FAME Publications.dc.html` | `src/components/publications/PublicationList.tsx` |
| A7 | Team | `…/team` | `FAME Trombinoscope.dc.html` | `src/components/team/MemberGrid.tsx` |
| A8 | Data (Dropbox) | `…/data` | `FAME Données.dc.html` | `src/components/data/DataExplorer.tsx` |
| A9 | Prompts | `…/prompts` | `FAME Prompts.dc.html` | `src/components/prompts/PromptLibrary.tsx` |

**Transverses** : cohérence `PAGE_BG` (dégradés radiaux), ombres de cartes, fond carte `#fbf9f3`, kicker mono `#7e95d6` + titre serif `#15203f`, bordures `rgba(20,40,90,0.1)`, états d'interaction (`style-hover`, `sc-if`).
**Prérequis** : MCP Claude Design connecté (sinon `/design-login`, session **Opus**). Faire **A0 (TopBar)** en premier.

---

## Groupe B — Restyle de l'interface admin (dérivé de l'immersif)

Aucune maquette admin → **dériver** le langage immersif des autres pages.

### Tâche B1 — Restyle `AdminProposalsClient`
**Constat** : `src/components/admin/AdminProposalsClient.tsx` en **Tailwind brut** (`p-8`, cartes `bg-white`), sans dégradé/toolbar immersive.
**À faire** (réutiliser tel quel le pattern immersif) :
- Fond `PAGE_BG` (copier la constante depuis ex. `KanbanBoard.tsx`).
- Toolbar : kicker mono `FAME / Admin` (`#7e95d6`, 9px, uppercase, letter-spacing `0.14em`) + titre serif (`#15203f`, ~20px).
- Filtres labo + statut en boutons mono cohérents.
- Cartes fond `#fbf9f3`, bordures `rgba(20,40,90,0.1)`, ombres douces ; badges via `ProposalStatusBadge`/`StatusBadge`.
- Actions accepter/refuser/convertir + commentaire admin : boutons inline-hex (`#1e9b7e`, `#c0473b`, `#2f4486`).
- **Aucun changement de logique/API** — restyle uniquement.
**Vérif** : visuel cohérent avec l'immersif ; flux accept/reject/convert fonctionnel ; `tsc`/`lint`/`build`.

### Tâche B2 — Confirmer l'accès admin dans la nav
**Constat** : `src/components/layout/NavMenu.tsx` affiche déjà conditionnellement le lien admin (`member?.is_admin`).
**À faire** : vérifier qu'il reste correct après restyle, n'apparaît que pour `is_admin`, pointe vers la page restylée. Pas de nouveau point d'entrée admin (gestion membres reste dans Team). Documenter ce choix dans `REVUE_PRE_PROD.md`.
**Vérif** : non-admin → pas de lien ; admin → lien présent et fonctionnel.

> **Hors-code** : `EMAIL_FROM` (domaine vérifié Resend) = décision de **déploiement** → plan D. Consigner en TODO dans `REVUE_PRE_PROD.md` section D.

---

## Clôture

- `tsc --noEmit` + `lint` (**0 warning** après C4) + `build` clean.
- Mettre à jour `docs/STATUS.md` (phase revue pré-prod close) et cocher `docs/REVUE_PRE_PROD.md` (A, B, C).
- Pousser `feat/p4-pre-prod` et ouvrir **PR #4** sur `main`.
- **Étape suivante (hors plan)** : plan superpowers de **déploiement (D / Task 20)**.

## Vérification end-to-end

1. `npx tsc --noEmit` → 0 erreur.
2. `npm run lint` → 0 warning (après C4).
3. `npm run build` → succès.
4. `npm run dev`, parcourir en **FR et EN**, rôles **visiteur / membre / admin** : accueil(globe), lab, paper, tasks, propose, publications, team, data, prompts, privacy, **admin/proposals** — comparer à la maquette MCP, vérifier absence de scrollbar parasite (C5), nav client sans full-reload (C2), avatars OK (C4), `[id]` inexistant → 404 (C1).
