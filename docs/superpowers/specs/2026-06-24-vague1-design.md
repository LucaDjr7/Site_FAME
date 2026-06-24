# Design — Vague 1 : robustesse + sujets transversaux

**Date** : 2026-06-24
**Branche** : `vague1` (depuis le tip de `audit`, commit `5b2a3ab`)
**Audit de référence** : `docs/AUDIT_2026-06-24.md` (constats 🟠 D2/D3, roadmap § 3)
**Décision produit liée** : mémoire `b5-cross-lab-pas-isolation` — aucune isolation cross-lab en v1 ; la notion « transversal » est une feature de visibilité (listing), pas un contrôle de droits.

---

## 1. Objectif & périmètre

La Vague 1 regroupe **deux choses** dans un seul plan, deux phases, une seule PR :

1. **Phase 1 — Robustesse** : les bugs 🟠 restants des domaines D2 (API) et D3 (Frontend/React) de l'audit. Correctifs ciblés, aucune migration.
2. **Phase 2 — Feature « sujets transversaux »** : un sujet (ou prompt) peut être marqué transversal → il devient **visible dans les deux labos**. Les publications sont **toujours** transversales. Migration additive + ajustement des requêtes de listing + UI.

### Cadrage produit (décisions actées)

- **« Transversal » = visibilité, pas droits.** Aujourd'hui, après la Vague 0, il n'y a **aucun** cloisonnement d'édition : tout membre connecté agit sur les deux labos de la même manière. **Cette Vague 1 ne réintroduit AUCUNE garde `assertLabAccess`.** La seule chose que « transversal » change, c'est *où un élément apparaît dans les listes*.
- **Cascade** : un sujet transversal rend aussi ses **tâches** visibles dans les deux labos (héritage via `sujet_id`, pas de flag propre sur `tasks`).
- **Publications** : toujours transversales (visibles partout, en permanence). Pas de flag, pas de badge.
- **Prompts** : transversal **en option** (flag par prompt), comme les sujets.
- **Qui marque** : tout membre connecté, depuis le mode édition existant (cohérent avec l'absence de cloisonnement).
- **Indicateur visuel** : badge « Transversal » sur les cartes de sujet et de prompt partagés.

### Hors périmètre (explicitement)

- Toute réintroduction de cloisonnement d'édition par labo.
- Un flag transversal sur les tâches (héritage seulement) ou sur les publications (toujours partagées).
- Filtre UI « transversal seulement / mon labo seulement » (YAGNI).
- Les domaines D4–D7 de l'audit (dette, i18n, a11y/SEO, config) → Vagues 2-4.

---

## 2. Phase 1 — Robustesse

Correctifs indépendants, TDD (RED → GREEN). Un commit atomique par correctif (ou par petit groupe cohérent).

| ID | Fichier | Correctif attendu |
|----|---------|-------------------|
| **F6** | `src/app/api/subjects/[id]/route.ts` (PATCH) | Ligne introuvable (`PGRST116` / 0 ligne) → **404**, pas 500. |
| **F7** | `src/app/api/tasks/[id]/route.ts` (PATCH) | Idem F6 → **404**. |
| **F8** | `src/app/api/dropbox/links/[id]/route.ts` (DELETE) | 0 ligne supprimée → **404** (plus de faux 200). Confirmer l'effet via `.select()` / count. |
| **F5** | `src/app/api/auth/activate/route.ts` | Vérifier `error` des `update`/`delete` ignorés ; statut adéquat en cas d'échec. |
| **F10** | `src/app/globals.css` | Ajouter les keyframes `fameSpin` et `fameSpinRev` (utilisées par `Globe.tsx:304`, aujourd'hui non définies → animation cassée). |
| **F21** | `src/components/prompts/PromptCard.tsx` | `handleDelete` n'appelle `onDeleted` **que** si la réponse est `res.ok` (fin de la suppression optimiste fausse). |
| **F06** | `src/components/publications/PublicationList.tsx` | Vérifier `res.ok` avant de parser la réponse du fetch. |
| **F05** | `src/components/paper/CommentsPanel.tsx` | Ajouter `catch` + feedback d'erreur (Toast) ; pas d'échec silencieux. |
| **F07** | `src/components/admin/AdminProposalsClient.tsx` | Ajouter `catch` + feedback d'erreur. |
| **F01** | `src/components/globe/Globe.tsx` | Ne plus lire `window` au render initial (état initialisé côté client via `useEffect`) → fin du risque d'hydratation. |
| **F02** | `src/components/globe/Globe.tsx` | Corriger la closure périmée dans le `useEffect` de drag (ref ou dépendances correctes). |
| **F22** | `src/components/globe/Globe.tsx` | `loadAtlas` ne doit pas appeler `draw()` après démontage (flag/`AbortController`/cancel). |
| **F04** | `src/components/lab/FilterSidebar.tsx` | Ajouter la directive `'use client'` (composant utilisant un hook). *Constat 🟠 D3 omis de la roadmap ligne 152 — rattaché ici.* |

> Les trois correctifs `Globe.tsx` (F01/F02/F22) touchent le même fichier : les regrouper en une seule tâche pour éviter les conflits.

---

## 3. Phase 2 — Feature « sujets transversaux »

### 3.1 Migration

`supabase/migrations/004_transversal.sql` :

```sql
ALTER TABLE subjects ADD COLUMN is_transversal boolean NOT NULL DEFAULT false;
ALTER TABLE prompts  ADD COLUMN is_transversal boolean NOT NULL DEFAULT false;
-- publications : aucune colonne. Toujours partagées → on retire le filtre labo au listing.
```

Migration additive, réversible, défaut `false` (comportement actuel préservé pour l'existant). Pas d'index ajouté (tables petites, YAGNI). Le type TS `Lab = 'paris' | 'montreal'` reste **intact**.

### 3.2 Requêtes de listing

| Ressource | Avant | Après |
|-----------|-------|-------|
| Sujets — `src/app/[locale]/[lab]/page.tsx:17` | `.eq('labo', lab)` | `.or('labo.eq.${lab},is_transversal.eq.true')` |
| Sujets — `src/app/[locale]/[lab]/tasks/page.tsx:18` | `.eq('labo', lab)` | idem |
| Tâches — `src/app/[locale]/[lab]/tasks/page.tsx:22` | `.eq('labo', lab)` | `.in('sujet_id', visibleSubjectIds)` où `visibleSubjectIds` = IDs des sujets déjà chargés (propres + transversaux). **Cascade automatique.** |
| Publications — `src/app/api/publications/route.ts:15` (GET) | `.eq('labo', lab)` | filtre retiré → toutes les publications. |
| Prompts — `src/app/api/prompts/route.ts:17` (GET) | `.eq('labo', lab)` | `.or('labo.eq.${lab},is_transversal.eq.true')` |

> Note tâches : la requête tâches dépend désormais des sujets chargés. Garder l'ordre dans le `Promise.all` ou séquencer (charger les sujets, en dériver les IDs, puis charger les tâches). La création de tâche / le POST `tasks` conserve le `labo` d'origine (provenance), inchangé.

### 3.3 Écriture du flag (API)

- `src/app/api/subjects/[id]/route.ts` (PATCH) : ajouter `is_transversal` à l'ensemble des champs whitelistés.
- `src/app/api/prompts/[id]/route.ts` (PATCH) : idem.
- **Aucune** garde `assertLabAccess` ajoutée (droits d'édition inchangés ; `requireMember()` suffit, comme aujourd'hui).
- F6/F7 (Phase 1) modifient déjà `subjects/[id]` et `tasks/[id]` PATCH → Phase 2 vient **après**, sur un fichier déjà corrigé.

### 3.4 UI

- **Modale create/edit de sujet** (`src/components/lab/AddSubjectModal.tsx`) : checkbox **« Transversal — visible dans les deux labos »**. Idem pour la création/édition de prompt (composant prompts correspondant — `PromptLibrary` / sa modale).
- **`src/components/lab/SubjectCard.tsx`** et **`src/components/prompts/PromptCard.tsx`** : badge « Transversal » (composant `StatusBadge` existant) quand `is_transversal === true`.
- **Publications** : aucun badge (toutes partagées → l'info serait du bruit).
- **i18n** : nouvelles clés (label checkbox, texte badge) ajoutées dans `messages/en.json` **et** `messages/fr.json`. Zéro chaîne hardcodée.

### 3.5 Types

`src/types/index.ts` : ajouter `is_transversal: boolean` aux interfaces `Subject` et `Prompt`.

---

## 4. Stratégie de test

TDD avec Vitest (`npm test` = `vitest run`). Honnêteté sur la couverture.

**Testables unitairement (RED → GREEN)** :
- Tous les correctifs API : F6, F7 (404 sur ligne absente), F8 (404 sur 0 suppression), F5 (propagation d'erreur).
- Le whitelisting `is_transversal` sur les PATCH subjects/prompts.
- Les nouvelles requêtes de listing (mocks service-role déjà en place dans la suite Vague 0) : vérifier que la clause inclut bien les transversaux / retire le filtre labo.
- Handlers de composants avec `fetch` mockable : F21 (`onDeleted` seulement si `res.ok`), F06 (`res.ok`).

**Difficiles en unitaire (timing render/animation)** : F10, F01, F02, F22.
- Correctifs structurels vérifiés par `tsc` + une assertion ciblée quand faisable (ex. : test que `globals.css` contient `@keyframes fameSpin`).
- Sinon, vérification manuelle **documentée explicitement** dans le plan (ce qui n'est pas couvert est dit, pas masqué).

**Gate par tâche** : `npm test` + `npx tsc --noEmit` + `npm run lint` à **0 erreur / 0 warning**.

---

## 5. Contraintes globales (binding)

Copiées verbatim des règles projet (CLAUDE.md / AGENTS.md) — le plan et les reviewers les traitent comme la grille d'attention :

- **i18n** : zéro chaîne UI hardcodée ; toute clé ajoutée existe dans `messages/en.json` **ET** `messages/fr.json`.
- **DB** : tous les writes via routes `/api/` avec `createServiceClient()` ; `createServiceClient()` **ne porte jamais** les cookies de la requête.
- **Sécurité** : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` server-only, jamais `NEXT_PUBLIC_`. Seuls `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` portent ce préfixe.
- **Routing** : valider le lab slug (`paris` | `montreal`, minuscules) dans chaque handler ; lab invalide → 404.
- **Next.js 16** : `params` est `Promise<{...}>` → toujours `await params`.
- **Versioning** : commits atomiques `feat:` / `fix:` ; MAJ `docs/STATUS.md` après la vague ; ne jamais commiter `.env.local`.

---

## 6. Organisation d'exécution

- Exécution en **subagent-driven-development** sur la branche `vague1`.
- Ordre : **Phase 1 d'abord** (robustesse, sans migration), **puis Phase 2** (feature). Raison : Phase 2 réécrit des fichiers déjà corrigés en Phase 1 (`subjects/[id]`, `tasks/[id]` PATCH) → l'ordre évite les conflits et part d'un socle robuste.
- Une seule PR `vague1 → main` à la fin (après la PR #5 Vague 0).
- Modèles : implementers/reviewers Sonnet 4.6 ; revue finale whole-branch Opus 4.8.
