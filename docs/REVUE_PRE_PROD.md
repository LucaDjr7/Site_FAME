# FAME Website — Revue pré-production

_Document de travail. Points à reprendre **avant** le déploiement prod (Task 20). À mettre à jour au fur et à mesure._

Dernière mise à jour : 2026-06-24
Document frère : [`docs/STATUS.md`](./STATUS.md)

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
| Accueil / globe | `/[locale]` | `FAME Accueil.dc.html` | [ ] |
| Lab (grille fiches) | `/[locale]/[lab]` | `FAME Laboratoire.dc.html` | [ ] |
| Paper (fiche) | `/[locale]/[lab]/paper/[id]` | `FAME Paper.dc.html` | [ ] |
| Tasks (kanban) | `/[locale]/[lab]/tasks` | `FAME Tasks.dc.html` | [ ] |
| Propose (formulaire) | `/[locale]/[lab]/propose` | `FAME Proposer.dc.html` | [ ] |
| Publications | `/[locale]/[lab]/publications` | `FAME Publications.dc.html` | [ ] |
| Team (trombinoscope) | `/[locale]/[lab]/team` | `FAME Trombinoscope.dc.html` | [ ] |
| Data (Dropbox) | `/[locale]/[lab]/data` | `FAME Données.dc.html` | [ ] |
| Prompts | `/[locale]/[lab]/prompts` | `FAME Prompts.dc.html` | [ ] |

**Points d'attention transverses :**
- La barre bleue « MENU » des maquettes correspond à la **TopBar globale** — vérifier que le mapping est cohérent partout (et que la TopBar elle-même est fidèle).
- Les pages immersives utilisent des **styles inline en hex** : vérifier que les valeurs correspondent aux maquettes (pas d'approximation).
- États d'interaction (hover, focus, edit-mode, toasts, modals) : présents dans les maquettes via `style-hover` / `sc-if` — à reproduire.
- Cohérence inter-pages des fonds dégradés radiaux, ombres de cartes, polices (Roboto Slab / IBM Plex Mono).

---

## B. Interface admin — aspect graphique **non traité**

Aujourd'hui `/admin/proposals` (`AdminProposalsClient.tsx`) est **fonctionnel mais en Tailwind brut** (`p-8`, pas de langage immersif, pas de TopBar/dégradé/barre d'outils secondaire, pas d'inline-hex). **Il n'existe aucune maquette admin** parmi les 9.

À traiter :
- [ ] **Décision maquette** : soit créer une maquette admin dans le projet Claude Design (cohérente avec le design system), soit **dériver** le style des autres pages (langage immersif : dégradé radial, barre d'outils secondaire kicker+titre, cartes `#fbf9f3`, badges mono, etc.).
- [ ] **Restyler `/admin/proposals`** selon ce langage (liste des propositions, filtres statut/labo, actions accepter/refuser/convertir, commentaire admin).
- [ ] **Anticiper les futures surfaces admin** : gestion membres (invitation) vit aujourd'hui dans la page Team ; vérifier s'il faut un point d'entrée admin dédié, ou si la cohérence Team/Admin suffit.
- [ ] Vérifier la **navigation vers l'admin** (lien visible uniquement pour `is_admin`, dans la TopBar/menu).

---

## C. Lot polish / dette technique (reporté de la Part 2 + observations Part 3)

- [ ] **`PGRST116` → 404 uniforme** : harmoniser la gestion « row not found » sur les routes `/api/**/[id]` (certaines renvoient 500 au lieu de 404).
- [ ] **Clés i18n mortes** : auditer et supprimer les clés non utilisées dans `messages/en.json` / `fr.json` (garder la parité en/fr).
- [ ] **`<a>` → `Link`** sur les barres d'outils immersives (le footer RGPD est déjà migré ; restent les toolbars Lab/Paper/etc. qui font du full-reload).
- [ ] **Prop morte `members`** sur `TasksPanel` : supprimer.
- [ ] **Footer RGPD vs pages immersives** : le footer ajoute un léger débordement de scroll sur les pages en `calc(100vh - 3rem)`. Décider : retirer le `min-h-screen` redondant, intégrer le footer dans le flux immersif, ou assumer.
- [ ] **Warning `Avatar.tsx <img>`** : passer à `next/image` (ou assumer explicitement le warning et l'ignorer en lint).
- [ ] **`EMAIL_FROM`** : le défaut `noreply@fame-lab.eu` nécessite un **domaine vérifié dans Resend**, sinon échec d'envoi en prod. Décider du domaine expéditeur réel.

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
