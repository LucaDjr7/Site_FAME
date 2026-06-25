# Design — Vagues 2 à 4 : remédiation exhaustive de l'audit (D6, D1/D7, D4/D5)

**Date** : 2026-06-25
**Branches** : `vague2`, `vague3`, `vague4` (chacune depuis `main`, séquentiellement — voir §7)
**Audit de référence** : `docs/AUDIT_2026-06-24.md` + rapports bruts `docs/audit-raw/D{1,4,5,6,7}-*.md`
**Décision produit liée** : mémoire `b5-cross-lab-pas-isolation` — aucune isolation cross-lab ; « transversal » = visibilité, pas droits.
**Pré-requis technique acté** : le bug Tailwind v4 est corrigé (`29d5f62`, directive `@config` dans `globals.css`) → les classes `fame-*` génèrent de nouveau du CSS, ce qui **rend viable** la migration CONV-01/CONV-02 (V4).

---

## 1. Objectif & cadrage

Solder **tout le reste** de l'audit pré-prod après les Vagues 0 (bloquants B1–B7) et 1 (robustesse D2/D3 + sujets transversaux). Trois vagues, **trois PR distinctes**, dans l'ordre **Public → Sécurité → Dette** :

| Vague | Domaines audit | Thème | Branche | PR |
|---|---|---|---|---|
| **V2** | D6 | Accessibilité, SEO, perf, UX | `vague2` | `vague2 → main` |
| **V3** | D1 (reste) + D7 | Durcissement sécurité, config, headers, **CI** | `vague3` | `vague3 → main` |
| **V4** | D4 + D5 | Dette qualité (TS, dédup, conventions), i18n | `vague4` | `vague4 → main` |

**Profondeur** : exhaustive — toutes les sévérités (🟠 + 🟡 + ⚪). Aucune sélection « High only ».

**Déploiement production** (Task 20 de la roadmap audit : env Vercel, secrets, smoke test) : **hors de ces 3 vagues**, plan séparé écrit après. La CI (GitHub Actions) est dans V3 ; le déploiement n'y est pas.

---

## 2. Périmètre exclu (binding — ne PAS traiter)

### 2.1 Déjà livré (Vagues 0 & 1) — vérifié sur le code courant

| Constat audit | Statut | Preuve |
|---|---|---|
| **B4 / CONV-03** — `GET /api/members` sans auth | ✅ FAIT (V0) | `src/app/api/members/route.ts:9` appelle `requireMember()` |
| **B6** — injection HTML emails Resend | ✅ FAIT (V0) | échappement dans `src/lib/resend/` |
| **B7 / D7** — garde `NEXT_PUBLIC_APP_URL` | ✅ FAIT (V0) | guard présent |
| **D2/D3 robustesse** (F5–F22, 404, `res.ok`…) | ✅ FAIT (V1) | plan `…vague1-robustesse-transversaux.md` |
| feature transversaux (`is_transversal`) | ✅ FAIT (V1) | migration `004_transversal.sql` |

Chaque plan inclut un bloc **« Notes d'exécution »** : la première étape RED de chaque tâche révèle un constat déjà résolu → le convertir en **test de garde** (pattern V1), ne pas ré-implémenter.

### 2.2 Won't-fix par décision produit — cross-lab (mémoire `b5-cross-lab-pas-isolation`)

Les constats D1 suivants supposent une **isolation cross-lab** que le produit a **délibérément abandonnée**. Ils sont **explicitement hors périmètre** ; **aucune garde `assertLabAccess` n'est réintroduite**, le type `Lab = 'paris' | 'montreal'` reste intact :

- **Sec-2** (writes cross-lab non vérifiés) — won't-fix.
- **§4** constats « `sujet_id`/`labo` non vérifié », filtre labo sur `order`, `tasks` POST, `dropbox/links` — won't-fix (la partie *validation d'entrée* de `order` est, elle, retenue : voir §4 V3, c'est de la robustesse, pas du cloisonnement).

> Tout reviewer qui voit ces items doit les considérer comme **résolus par décision produit**, pas comme des manques.

### 2.3 YAGNI / nits acceptés tels quels

- **CONV-06** (`privacy/page.tsx` hors structure AGENTS.md) → on **documente** la page dans AGENTS.md, pas de déplacement.
- **CFG-03** (règles ESLint projet custom `no-restricted-syntax` anti-hex) → **non** : trop de faux positifs avec les composants immersifs ; on s'appuie sur la revue.
- **postcss@8.4.31** (vuln modérée build-time) → **monitor only**, déjà tracé dans `npm audit` baseline.
- **F-HC-07** (`placeholder="https://…"`) → laissé tel quel (valeur technique universelle).
- **F-FR-01/02** (`preprint`/`working paper`) → traduits (faible coût), retenus en V4.

---

## 3. V2 — Accessibilité / SEO / Perf / UX (domaine D6)

31 constats. Regroupés par testabilité.

### 3.1 SEO — **unit-testable** (modules importables en env `node`)

| ID | Livrable | Fichier |
|---|---|---|
| S2 | `sitemap.ts` (toutes routes publiques × locales × labs) + `robots.ts` | `src/app/sitemap.ts`, `src/app/robots.ts` (créer) |
| S1, S5 | `generateMetadata()` par page (titre/desc localisés) sur home, lab, paper, publications, team, tasks, data, prompts, propose | pages concernées |
| S3 | `alternates.languages` (hreflang en/fr) dans la metadata racine + pages | `src/app/[locale]/layout.tsx` + pages |
| S4 | OpenGraph (title, description, type, locale) dans la metadata | metadata des pages |

> Les fonctions `sitemap()`, `robots()`, `generateMetadata()` s'importent et s'assertent en Vitest node (retour d'objet) → **TDD complet**.

### 3.2 Accessibilité — **structurel** (env node, pas de jsdom → vérif `tsc`+`lint`+revue+manuel)

| ID | Constat | Fichier:ligne |
|---|---|---|
| A1 | `Modal` : `role="dialog"` `aria-modal` + focus-trap + restitution focus | `ui/Modal.tsx` |
| A6 | bouton `×` du Modal : `aria-label` (i18n) | `ui/Modal.tsx` |
| A7 | `Toast` : `role="status"` `aria-live="polite"` | `ui/Toast.tsx:27` |
| A2 | labels `htmlFor` ↔ `id` dans 5 modales | AddSubjectModal, AddTaskModal, InviteModal, EditMemberModal, AddPublicationModal |
| A11 | inputs commentaire visiteur : `<label>`/`aria-label` | `paper/CommentsPanel.tsx` |
| A3 | `TaskCard` div `onClick` → `role="button"` `tabIndex=0` + clavier (ou `<button>`) | `tasks/TaskCard.tsx:23` |
| A4 | arbre Dropbox : `role="tree"`/`treeitem`, clavier | `data/DataExplorer.tsx:428` |
| A5 | globe canvas : `aria-label` **i18n** (clé `home.globeLabel`) | `globe/Globe.tsx:321` |
| A8 | `NavMenu` : `aria-controls`/`aria-expanded` | `layout/NavMenu.tsx` |
| A9 | bouton `×` sous-tâche : `aria-label` (i18n) | `tasks/SubtaskList` |
| A10 | micro-texte 7px : porter à ≥ 11px ou exempter via contraste | composants concernés |
| A12 | `LanguageSwitcher` : `lang=`/`hreflang=` sur les options | `layout/LanguageSwitcher.tsx` |

> **Contrainte cross-cutting** : toute attribut a11y introduit en V2 qui contient du texte (aria-label) **naît i18n** (`t()` + clés EN/FR). V2 n'ajoute aucune chaîne hardcodée. Cela couvre **F-HC-03** (globe aria-label) côté svg également → marqué « fait en V2 » dans V4.

### 3.3 Perf & UX — structurel + 1 testable

| ID | Constat | Fichier |
|---|---|---|
| P1 | globe rAF : pause sur `visibilitychange` | `globe/Globe.tsx` |
| P5 | `prefers-reduced-motion` : couper animations globe/paper | `globe/Globe.tsx`, `globals.css` |
| P2 | `<link rel=preconnect>` Google Fonts (ou next/font) | `[locale]/layout.tsx` |
| P3 | `Avatar` : `next/image` (ou justification `unoptimized`) | `ui/Avatar.tsx` |
| P4 | keyframes `drift1-4` inline → `globals.css` (= LIS-05) | `paper/PaperView.tsx` → `globals.css` |
| P6 | `PublicationList` : `useMemo` sur les comptes | `publications/PublicationList.tsx` |
| P7 | `StarField` 46 SVG : doc/justif (ou `<canvas>` — YAGNI, doc) | `globe/StarField.tsx` |
| U1 | double-submit : `disabled={posting}` | `propose/ProposeForm`, `paper/CommentsPanel` |
| U2 | `loading.tsx` RSC sur les routes lourdes | `[lab]/`, `paper/[id]/` |
| U3 | toast après commentaire visiteur | `paper/CommentsPanel` |
| U4 | input commentaire admin → `<textarea>` | `admin/…` |
| U5 | `PaperNav href="#"` sur sujet unique → désactiver | `paper/PaperNav` |
| U6 | focus restitué à la fermeture de modale (= A1) | `ui/Modal.tsx` |
| U7 | inputs recherche : `aria-label` (i18n) | sidebars |
| U8 | tri : `aria-pressed` | sidebars |

---

## 4. V3 — Durcissement sécurité / config / CI (D1 reste + D7)

### 4.1 Sécurité applicative (D1, hors cross-lab) — **unit-testable**

| ID | Livrable | Fichier |
|---|---|---|
| Sec-4 | `POST /api/comments` : bornes (`texte` ≤ 4000, nom visiteur ≤ 80, champs requis) → 400 | `api/comments/route.ts` |
| Sec-4 | `POST /api/proposals` : bornes (titre, description, email format, domaine ∈ liste) → 400 | `api/proposals/route.ts` |
| §3 | `GET /api/proposals?ids=` (branche publique) : `select` restreint — **exclure** `proposant_email`, `commentaire_admin` | `api/proposals/route.ts` |
| §5 | `subjects/[id]` `order` : valider `Array.isArray(orderedIds)` + éléments `string` → 400 (robustesse d'entrée, **pas** cloisonnement) | `api/subjects/[id]/route.ts` |
| Sec-6 | rate-limit `POST /api/auth/sign-in` + soumissions publiques (comments/proposals) : limiteur mémoire par IP, fenêtre glissante | `src/lib/rate-limit.ts` (créer) + routes |
| §6 | résidu colonne `password_hash` (migration `001:18`) → migration de suppression si confirmé inutilisé | `supabase/migrations/005_*.sql` |
| CONV-04 | activation : complexité mot de passe (≥ 1 majuscule, ≥ 1 chiffre, ≥ 8) | `api/auth/activate/route.ts:7` |

### 4.2 Config & headers (D7) — testable (next.config) + structurel

| ID | Livrable | Fichier |
|---|---|---|
| D7 | `headers()` : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` | `next.config.ts` |
| D7 | `.env.example` (8 vars, sans valeurs) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_EMAIL` | `.env.example` (créer) |
| D7 | `seed-admin.ts` : email via `SEED_ADMIN_EMAIL` (fin du hardcode) | `src/scripts/seed-admin.ts` |
| D7/D1 | `admin/layout.tsx` : `await requireAdmin()` (aujourd'hui absent — vérifié) | `src/app/[locale]/admin/layout.tsx` |
| TS-04 | guards explicites env manquantes dans `server.ts` (`createServiceClient`/`createServerClient`) | `src/lib/supabase/server.ts` |

### 4.3 CI & rigueur de typage

| Livrable | Détail |
|---|---|
| GitHub Actions | `.github/workflows/ci.yml` : `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm audit --audit-level=high` sur push/PR |
| script `typecheck` | ajouter `"typecheck": "tsc --noEmit"` dans `package.json` |
| CFG-02 | `noUncheckedIndexedAccess: true` dans `tsconfig.json` + traiter les ~10 accès indexés (`TasksPanel.tsx:63`, `SubjectCard.tsx:58`, etc.) |

---

## 5. V4 — Dette qualité (D4) + i18n (D5)

### 5.1 Centralisations / dédup (D4) — partiellement testable

| ID | Livrable | Cible |
|---|---|---|
| DUP-04 | `VALID_LABS` exporté, importé dans ~17 fichiers (supprimer les `LABS` locaux) | `src/lib/constants.ts` |
| MORT-03 | `LAB_LABELS: Record<Lab,string>` centralisé | `src/lib/constants.ts` |
| DUP-02 | `FAME_PAGE_BG` (gradient canonique) centralisé, dérivés documentés (~8 sites) | `src/lib/constants.ts` |
| DUP-01 | `DiffDots` unifié `{ level: number }`, importé (3 sites) | `src/components/ui/DiffDots.tsx` |
| DUP-03 | `DateBucket` type + `dateBucket()` centralisés (4 sites) | `src/types`, `src/lib/utils.ts` |
| DUP-05 | styles formulaire `FORM_*_STYLE` partagés (5 modales) | `src/components/ui/form-styles.ts` |
| DUP-06 | helper `apiFetch<T>()` (toast d'erreur centralisé) (4 composants) | `src/lib/api-fetch.ts` |
| DUP-07 | `ROLE_KEY` partagé | `src/components/team/team-shared.ts` |
| MORT-02 | `TARGET_META`/`TARGET_ORDER` partagés | `src/components/prompts/prompt-shared.ts` |
| TS-01 | `paper/[id]/page.tsx` : appeler `flattenTasks()` (fin du flatten dupliqué + `any`) | — |
| LIS-03 | `bucket()` inline Kanban → `kanban-shared` | — |

### 5.2 Typage & code mort (D4) — structurel

TS-02 (callbacks `Subject`/`Publication` au lieu de `unknown`), TS-03 (cast `as Lab` après validation, 5 routes), TS-04 (déjà en V3 §4.2), TS-05 (`null as any` GeoJSON → types topojson), TS-06 (`void` → `_`), MORT-01 (`isSelf` mort), CONV-07/TS-04 (`getContext('2d')` gardé), CFG-01 (documenter le `eslint-disable` globe), LIS-01/02/04/05 (découpe/renommage/keyframes — LIS-05 fait en V2).

### 5.3 Conventions couleur/police (D4) — **migration systématique bornée**

- **CONV-01** (~351 hex inline hors immersif) et **CONV-02** (~246 `fontFamily` inline) : migration **par lots de répertoires** vers `bg/text/border-fame-*` et `font-serif`/`font-mono`. Table de correspondance hex→token canonique fournie dans le plan. **Exemptions** : `globe/`, `paper/PaperView` immersif, valeurs `rgba()` à opacité custom sans token. Vérification par lot : `grep` du compte d'occurrences avant/après + diff visuel manuel documenté. Viable car `@config` est en place.

### 5.4 i18n (D5)

| ID | Livrable | Fichier |
|---|---|---|
| F-HC-01 | clés `kicker` (`publications`/`data`/`prompts`/`team`) interpolant `{lab}` | + 4 composants |
| F-HC-02 | `admin.kicker` | `admin/AdminProposalsClient.tsx:129` |
| F-HC-04 | `SubjectCard` `title="Delete"` → label i18n passé en prop | `lab/SubjectCard.tsx:69` |
| F-HC-05 | `data.openInDropbox`, `data.removeLink` | `data/DataExplorer.tsx:568,830` |
| F-HC-06 | placeholders InviteModal → clés (ou exception annotée) | `team/InviteModal.tsx` |
| F-FR-01/02 | `preprint`→`Prépublication`, `working`→`Document de travail` (FR) | `messages/fr.json` |
| F-DEAD-01…06 | supprimer **19 clés mortes** (EN+FR) : `tasks.history/assignees`, `lab.delete.kicker/title`, `paper.keywords/saved`, `admin.proposals`, 12 `common.*` | `messages/{en,fr}.json` |

> **F-HC-03** (globe aria-label) : traité en **V2** (§3.2). Marqué résolu ici.
> **Parité EN/FR** : 357 clés des deux côtés aujourd'hui ; après suppression, re-vérifier la parité (test de garde possible : charger les deux JSON, comparer les ensembles de clés).

---

## 6. Stratégie de test (commune)

Harnais **Vitest `environment: 'node'`**, `include: src/**/*.test.ts`, **pas** de jsdom/`@testing-library`. Honnêteté de couverture (convention V0/V1) :

- **TDD complet (RED→GREEN)** : routes API (V3 bornes/rate-limit/select/order/password), modules SEO importables (`sitemap`/`robots`/`generateMetadata` — V2), helpers purs (`dateBucket`, `apiFetch` mockable, `rate-limit`, constantes — V4), parité des clés i18n (V4).
- **Structurel (`tsc` + `lint` + revue + manuel documenté)** : tout changement de composant React (a11y V2, dédup UI V4, migration couleur V4), `next.config.ts` headers, CSS. Le **test de garde** (assertion ciblée : présence d'un attribut, d'une clé, d'un keyframe, absence d'un hex) est utilisé quand faisable.
- **Gate par tâche** : `npm test` + `npx tsc --noEmit` + `npm run lint` à **0 erreur / 0 warning**.
- **Ce qui n'est pas couvert est dit explicitement** dans le plan, jamais masqué.

---

## 7. Contraintes globales (binding)

Verbatim CLAUDE.md / AGENTS.md — grille d'attention des reviewers :

- **i18n** : zéro chaîne UI hardcodée ; toute clé existe dans `messages/en.json` **ET** `messages/fr.json`.
- **DB** : writes via `/api/` + `createServiceClient()` ; ce client **ne porte jamais** les cookies de la requête (sinon RLS s'applique).
- **Sécurité** : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` server-only, jamais `NEXT_PUBLIC_`. Seuls `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` portent ce préfixe.
- **Routing** : valider le lab slug (`paris`|`montreal`, minuscules) dans chaque handler ; lab invalide → 404 (pages) / 400 (API).
- **Next.js 16** : `params` = `Promise<{...}>` → toujours `await params`.
- **Aucune garde `assertLabAccess`** réintroduite ; `Lab = 'paris'|'montreal'` intact.
- **Tailwind v4** : ne JAMAIS retirer `@config "../../tailwind.config.ts"` de `globals.css` (sinon tous les `fame-*` meurent silencieusement).
- **Versioning** : commits atomiques `feat:`/`fix:`/`chore:` finissant par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` ; MAJ `docs/STATUS.md` après chaque vague ; ne jamais commiter `.env.local`.

---

## 8. Organisation d'exécution

- **Séquentiel**, une vague après l'autre, en **subagent-driven-development**. Chaque vague : sa branche depuis `main`, sa PR, son merge avant la suivante (V3 et V4 touchent parfois les mêmes fichiers — éviter les conflits inter-branches).
- **Ordre** : V2 (public) → V3 (sécurité + CI) → V4 (dette + i18n). Raison : livrer d'abord la valeur visible (a11y/SEO), puis sécuriser, puis assainir. La CI de V3 protège ensuite V4 (gros volume de refactor).
- **Modèles** : implementers/reviewers UI → Sonnet 4.6 ; tâches sécurité/config/CI → Opus 4.8 ; revue finale whole-branch de chaque vague → Opus 4.8.
- **Déploiement production** : plan séparé après V4.
