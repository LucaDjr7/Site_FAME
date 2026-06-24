# FAME Website — Revue pré-production

_Document de travail. Points à reprendre **avant** le déploiement prod (Task 20). À mettre à jour au fur et à mesure._

Dernière mise à jour : 2026-06-24
Document frère : [`docs/STATUS.md`](./STATUS.md)

> **Phase finition A+B+C close** (branche `feat/p4-pre-prod`, PR #4). Reste **D — Déploiement** (plan superpowers dédié).

---

## Contexte

- **Code Part 3 terminé** (Publications, Team, Prompts, Data, Emails, RGPD) → **PR #3** ouverte sur `main` (https://github.com/LucaDjr7/Site_FAME/pull/3).
- `tsc --noEmit` / `lint` (1 warning pré-existant) / `npm run build` : **clean**.
- **Migrations prod appliquées** : `001` + `002` + `003` ✅.
- **Ne pas déployer tant que cette revue n'est pas close.** L'objectif de cette phase est la **finition graphique** (fidélité maquettes + admin) et le **lot de dette technique**, pas l'ajout de features.

---

## Méthode de travail (rappel)

Cette revue **et** le déploiement passent par le workflow **superpowers** :

1. **Plan d'abord** — formaliser un plan via `superpowers:writing-plans` (`docs/superpowers/plans/2026-06-2X-fame-pre-prod-finition.md`) découpant les points ci-dessous en tâches atomiques vérifiables.
2. **Exécution par sous-agents Sonnet** — chaque tâche UI confiée à un sous-agent `model: claude-sonnet-4-6` (volume élevé, complexité moindre).
3. **Opus orchestre** — Opus 4.8 lit la maquette via le **MCP Claude Design** (`DesignSync` `get_file`), **injecte le markup** dans le prompt du sous-agent (les sous-agents Sonnet n'ont **pas** accès au MCP), revoit la sortie, puis commit.
4. **Déploiement (Task 20)** — voir section dédiée : ce qui est automatisable par sous-agent vs ce qui reste manuel (dashboards).

> ⚠️ Accès maquettes = **Opus obligatoire**. La connexion claude.ai/design n'existe que dans la session principale Opus.

---

## A. Fidélité graphique aux maquettes — **priorité haute**

**Règle absolue : sur le plan graphique (pas les features), le site doit suivre _exactement_ ce qui est trouvé via le MCP Design.** Les pages Part 2/3 ont été construites « fidèles » à partir de markup injecté, mais **n'ont pas été revérifiées pixel-à-pixel contre la maquette vivante**. Faire une **passe d'audit page par page** : ouvrir la maquette via `DesignSync` et comparer (tokens couleur, typo, espacements, rayons, ombres, états d'interaction, comportements).

Projet MCP : « Site FAME projet » — `projectId = 5bd688a8-2928-4c09-8d94-63f35b89ec74`.

| Page | Route | Maquette (`path`) | Audit |
|---|---|---|---|
| Accueil / globe | `/[locale]` | `FAME Accueil.dc.html` | [x] A1 |
| Lab (grille fiches) | `/[locale]/[lab]` | `FAME Laboratoire.dc.html` | [x] A2 (converti en clair) |
| Paper (fiche) | `/[locale]/[lab]/paper/[id]` | `FAME Paper.dc.html` | [x] A3 (déjà fidèle) |
| Tasks (kanban) | `/[locale]/[lab]/tasks` | `FAME Tasks.dc.html` | [x] A4 |
| Propose (formulaire) | `/[locale]/[lab]/propose` | `FAME Proposer.dc.html` | [x] A5 |
| Publications | `/[locale]/[lab]/publications` | `FAME Publications.dc.html` | [x] A6 |
| Team (trombinoscope) | `/[locale]/[lab]/team` | `FAME Trombinoscope.dc.html` | [x] A7 |
| Data (Dropbox) | `/[locale]/[lab]/data` | `FAME Données.dc.html` | [x] A8 |
| Prompts | `/[locale]/[lab]/prompts` | `FAME Prompts.dc.html` | [x] A9 |

> **A0 — TopBar (transverse)** : [x] barre bleue pleine opaque `#2f4486` (deux niveaux conservés, bouton MENU encadré + panneau clair `#fbf9f3`).

**Points d'attention transverses :**
- La barre bleue « MENU » des maquettes correspond à la **TopBar globale** — vérifier que le mapping est cohérent partout (et que la TopBar elle-même est fidèle).
- Les pages immersives utilisent des **styles inline en hex** : vérifier que les valeurs correspondent aux maquettes (pas d'approximation).
- États d'interaction (hover, focus, edit-mode, toasts, modals) : présents dans les maquettes via `style-hover` / `sc-if` — à reproduire.
- Cohérence inter-pages des fonds dégradés radiaux, ombres de cartes, polices (Roboto Slab / IBM Plex Mono).

---

## B. Interface admin — aspect graphique **non traité**

Aujourd'hui `/admin/proposals` (`AdminProposalsClient.tsx`) est **fonctionnel mais en Tailwind brut** (`p-8`, pas de langage immersif, pas de TopBar/dégradé/barre d'outils secondaire, pas d'inline-hex). **Il n'existe aucune maquette admin** parmi les 9.

À traiter :
- [x] **Décision maquette** : pas de nouvelle maquette → **dériver** le langage immersif des pages existantes (décision utilisateur).
- [x] **Restyler `/admin/proposals`** (B1) : page pleine hauteur `PAGE_BG`, barre secondaire kicker `FAME / Admin` + titre serif, filtres labo/statut en boutons mono, cartes `#fbf9f3`, `ProposalStatusBadge` réutilisé, actions accepter `#1e9b7e` / refuser `#c0473b` / convertir bordé `#2f4486`. **Aucun changement de logique/API.**
- [x] **Futures surfaces admin** : la gestion membres reste dans la page Team (invitation par admin) — **pas de point d'entrée admin dédié en v1**, cohérence Team/Admin jugée suffisante.
- [x] **Navigation vers l'admin** (B2) : lien `NavMenu` conditionné à `member?.is_admin` (doré, vers `/{locale}/admin/proposals`) — vérifié, pointe vers la page restylée.

---

## C. Lot polish / dette technique (reporté de la Part 2 + observations Part 3)

- [x] **`PGRST116` → 404 uniforme** (C1) : harmonisé sur `proposals/publications/members/prompts/comments/[id]` (alignés sur le pattern `subjects/[id]`).
- [x] **Clés i18n mortes** (C6) : auditées et supprimées, parité en/fr maintenue.
- [x] **`<a>` → `Link`** (C2) : toolbars immersives migrées (`KanbanBoard`, `SubjectGrid` ×2) — navigation client sans full-reload.
- [x] **Prop morte `members`** sur `TasksPanel` (C3) : supprimée (type + appel `PaperView`).
- [x] **Footer RGPD vs pages immersives** (C5) : `min-h-screen` redondant retiré du `<main>` — plus de scrollbar parasite.
- [x] **Warning `Avatar.tsx <img>`** (C4) : migré vers `next/image` (`unoptimized`) — **0 warning lint**.
- [ ] **`EMAIL_FROM`** → **reporté en D (déploiement)** : le défaut `noreply@fame-lab.eu` nécessite un **domaine vérifié dans Resend**, sinon échec d'envoi en prod. Décider du domaine expéditeur réel (décision de déploiement, hors phase finition).

---

## D. Déploiement — Task 20 (par sous-agent + manuel)

Le déploiement sera **planifié via superpowers** puis exécuté en partie par sous-agent. Distinguer :

**Automatisable par sous-agent (CLI) :**
- [ ] Vérifications finales : `tsc --noEmit`, `lint`, `npm run build`.
- [ ] Préparer/valider le `.env.production` attendu (liste exhaustive des vars, sans secrets commités).
- [ ] `npm run seed:admin` contre la prod **si** les creds Supabase prod sont fournis au sous-agent de façon sûre (sinon → manuel).
- [ ] Générer une checklist de smoke-test post-déploiement (login, lab grid, paper, tasks, propose, publications, team, data, prompts, privacy ; FR/EN ; rôles visiteur/membre/admin).

**Manuel (hors agent — dashboards) :**
- [ ] **Merge PR #3** dans `main`.
- [ ] **Vercel** : connecter le repo `LucaDjr7/Site_FAME`, définir les **env vars** :
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (URL prod → liens d'activation), `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`.
- [ ] **Resend** : vérifier le domaine expéditeur.
- [ ] **Supabase prod** : migrations `001/002/003` ✅ déjà appliquées — rien à refaire.
- [ ] **Dropbox** : confirmer que le token pointe vers le bon dossier d'équipe (sinon Data → 503 dégradé, ce qui est acceptable au lancement).

---

## Ordre suggéré

1. **A — Fidélité graphique** (audit MCP page par page) — le plus structurant, à faire en premier.
2. **B — Admin graphique** (décision maquette → restyle).
3. **C — Lot polish** (parallélisable, petites tâches).
4. **D — Déploiement** (plan superpowers dédié, dernier).
