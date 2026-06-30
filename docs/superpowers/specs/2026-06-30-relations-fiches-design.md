# Relations entre fiches & page graphe (arborescence + connexions) — Design

**Date** : 2026-06-30
**Statut** : approuvé (brainstorming), prêt pour le plan
**Branche** : `feat/subject-relations` (à créer)
**Pré-requis** : aucun (s'appuie sur le modèle `subjects` + i18n existants).

## Objectif

Permettre de **relier les fiches entre elles** et de **naviguer dans ces connexions** comme dans un graphe spatial (théorie des graphes). Deux natures de liens :

1. **Mère→fille** (orienté, hiérarchique) : une fiche « découle » d'une autre. La fille peut **hériter, champ par champ**, des propriétés d'une mère **sans recopie** (référence vivante). Une fiche peut avoir **plusieurs mères** (graphe orienté acyclique).
2. **Association** (non orientée) entre deux fiches, sans hiérarchie, avec un **libellé optionnel**.

Trois surfaces :
- une **page graphe globale** (tous labos) pour explorer/éditer le réseau ;
- un **panneau de relations** dans la page d'une fiche (sous *Tasks*) ;
- un **bouton « créer une fiche fille »** sur la page d'une fiche.

## Décisions (validées en brainstorming)

- **Héritage** : **sélectif par champ** (la fille choisit, champ par champ, hériter vs valeur propre).
- **Cardinalité mère** : **plusieurs mères autorisées** (DAG).
- **Résolution multi-mères** : **source explicite par champ** — chaque champ hérité pointe vers **une** mère précise (zéro ambiguïté).
- **Champs héritables** : `context`, `method`, `results`, `dimensions`, `keywords`, `auteurs`, `kicker` (domaine), `periode`.
  **Jamais héritables** (identité propre) : `titre`, `question`, `accroche` ; ni le structurel (`statut`, `labo`, `confidentiel`, `is_transversal`, `ordre`, `difficulte`).
- **Liens classiques** : association **non orientée** + **libellé optionnel** (auto-traduit).
- **Page graphe** : **globale tous labos**, lecture publique (hors `confidentiel`), **édition réservée aux membres**. Visualisation **`d3-force`** (déjà en dépendances, sert au globe) — pas de nouvelle lib.
- **Bouton « créer une fille »** sur la page fiche : pré-définit la fiche courante comme mère et coche l'héritage par défaut.

### Non-objectifs (YAGNI)
- Pas de versionnage des liens, pas d'export du graphe, pas de mini-map.
- Pas de configuration d'héritage « transitif » explicite (la résolution suit naturellement la chaîne via l'acyclicité).
- Pas de nouvelle dépendance de visualisation (react-flow / cytoscape écartés).

---

## 1. Modèle de données

### Migration `013_subject_relations.sql`

```sql
create table subject_relations (
  id         uuid primary key default gen_random_uuid(),
  source_id  uuid not null references subjects(id) on delete cascade,
  target_id  uuid not null references subjects(id) on delete cascade,
  kind       text not null check (kind in ('parent','assoc')),
  label      text not null default '',          -- 'assoc' uniquement
  label_i18n jsonb not null default '{}',        -- { en:{label}, fr:{label} }
  created_at timestamptz not null default now(),
  check (source_id <> target_id)
);
-- 'parent' : source_id = MÈRE, target_id = FILLE (orienté).
-- 'assoc'  : non orienté ; invariant applicatif source_id < target_id (ordre lexico uuid) → unicité d'une paire.
create unique index ux_subject_relations_pair on subject_relations (source_id, target_id, kind);
create index ix_subject_relations_source on subject_relations (source_id);
create index ix_subject_relations_target on subject_relations (target_id);

-- Map d'héritage par champ, portée par la fiche FILLE.
alter table subjects add column inherits jsonb not null default '{}';
-- ex. { "context": "<motherId>", "dimensions": "<motherId2>", "keywords": "<motherId>" }
```

RLS activée (cohérent avec les autres tables) ; les writes passent par le **service-role** côté API.

### Types (`src/types/index.ts`)

```ts
export type RelationKind = 'parent' | 'assoc'
export const INHERITABLE_FIELDS = ['context','method','results','dimensions','keywords','auteurs','kicker','periode'] as const
export type InheritableField = typeof INHERITABLE_FIELDS[number]

export interface SubjectRelation {
  id: string
  source_id: string
  target_id: string
  kind: RelationKind
  label: string
  label_i18n: Partial<Record<Locale2, { label: string }>>
  created_at: string
}
```

`Subject` gagne `inherits: Partial<Record<InheritableField, string>>` (clé = champ, valeur = id de la mère source).

**Invariants** (validés à l'écriture) : toute clé de `inherits` est dans `INHERITABLE_FIELDS` **et** sa valeur est l'`id` d'une fiche ayant une relation `parent` (mère→cette fiche).

---

## 2. Résolution & intégrité de l'héritage

### `src/lib/subjects/inheritance.ts`

```ts
resolveInheritance(subject, byId: Map<string, Subject>, locale: Locale2): LocalizedSubject
```

- Part de `localizedSubject(subject, locale)`.
- Pour chaque champ marqué dans `subject.inherits`, **remplace** la valeur par celle, **localisée**, de la mère pointée — en appelant récursivement `resolveInheritance` sur la mère (suit la chaîne si la mère hérite elle-même ce champ).
- **Anti-boucle** : `Set` d'ids visités passé en récursion → si re-visite, on stoppe sur la valeur propre de la mère (et c'est de toute façon impossible vu l'anti-cycle à l'écriture).
- **Gate confidentiel** : si la mère pointée est `confidentiel` et que le `byId` fourni ne la contient pas (cas visiteur — voir §3 lecture), le champ retombe sur la **valeur propre** (colonne plate) de la fille. Aucune fuite.

**Réutilisé partout où le contenu d'une fiche est affiché ou indexé** :
- `PaperSheet` (corps de la fiche),
- `SubjectVitrine` (carte de la grille),
- indexation RAG `chunkSubject` (cohérence assistant + génération).

### Garde-fous d'écriture (API, service-role)

- Refus de l'**auto-lien** (`source_id === target_id`).
- Refus de **cycle** : avant d'insérer un `parent` (mère M → fille F), DFS depuis M en remontant ses propres mères ; si F est ancêtre de M → 409.
- **Dédoublonnage `assoc`** : normalisation `source_id < target_id` + index unique.
- **Purge `inherits`** : à la suppression d'une relation `parent` (ou de la mère), retirer les clés `inherits` de la fille qui pointaient vers cette mère.
- Quand un champ devient hérité, **ne pas écraser** la colonne plate de la fille : elle reste valeur de repli si le lien saute plus tard.

---

## 3. API (routes `/api/`, service-role, membres)

| Route | Méthode | Rôle |
|---|---|---|
| `/api/subjects/[id]/relations` | `POST` | Créer un lien (`kind`, `otherId`, `label?`). Valide cycle/auto/doublon. `label` auto-traduit → `label_i18n` (pipeline existant tasks/subjects). |
| `/api/subjects/[id]/relations/[relId]` | `DELETE` | Supprimer un lien ; purge des `inherits` liés. |
| `/api/subjects/[id]` | `PATCH` (étendu) | Accepte `inherits` (validé : liste blanche + mère réelle). |
| `/api/subjects` | `POST` (étendu) | Accepte `parentId?` + `inherits?` pour créer fille **et** lien `parent` **et** map en une transaction logique (bouton « créer une fille »). |

**Lecture (RSC)** : les pages chargent `subject_relations` + les sujets liés en respectant `confidentiel` — un **visiteur** ne reçoit ni les liens vers/depuis une fiche confidentielle, ni la fiche confidentielle dans le `byId` de résolution (donc pas d'héritage depuis une mère confidentielle). Membres : tout.

---

## 4. Page graphe — `/[locale]/graph`

Page **globale** (hors segment `[lab]`), donc nouveau dossier `src/app/[locale]/graph/page.tsx` (RSC) + composant client `RelationGraph`.

- **Données** : tous les sujets visibles (gate confidentiel selon session) des deux labos + toutes les `subject_relations` correspondantes.
- **Rendu `d3-force`** (`src/components/graph/RelationGraph.tsx`) :
  - Nœuds = fiches ; **couleur** = statut (`active`/`on-hold`/`done`, tokens existants), **bord/forme** distingue Paris vs Montréal, **halo** pour `is_transversal`.
  - Arêtes **pleines fléchées** = mère→fille ; **pointillées** = association (libellé affiché au survol).
  - Interactions : zoom/pan, drag des nœuds, **clic nœud → ouvre la fiche** (`/[locale]/[lab]/paper/[id]`), survol → surbrillance du voisinage + estompe le reste.
- **Filtres** (réutilisent l'esthétique des sidebars) : par labo, par statut, bascule « arborescence seule (mère-fille) » vs « tout ».
- **Édition (membre)** : toggle crayon (comme le kanban) → tirer un trait nœud→nœud crée un lien (choix `parent`/`assoc` + libellé), clic sur une arête → suppression (confirm). Appelle les routes du §3.
- **Identité visuelle** : fond `bg-fame-gradient`/navy, `StarField` optionnel, tokens `fame-*`, `font-mono` pour labels, animation `fameFade`. Bulle assistant positionnée comme sur les autres pages.
- **Nav** : entrée « Graphe » ajoutée à `NavMenu` (visible dans les deux labos, pointe vers la page globale) + lien depuis l'accueil. Clés i18n dédiées.

---

## 5. Panneau de relations dans la fiche + bouton « créer une fille »

### `RelationsPanel` (`src/components/paper/RelationsPanel.tsx`)

Monté dans `PaperView`, **sous `TasksPanel`**. Trois groupes :
- **Mères** — chaque mère + la liste des champs hérités d'elle.
- **Filles** — fiches qui découlent de celle-ci.
- **Associations** — fiches liées + libellé.

Chaque entrée = lien vers la fiche. **Indicateur d'héritage** : dans le corps de la fiche (`PaperSheet`), un champ hérité porte un petit badge « hérité de *{titre mère}* » (lien cliquable).

**Mode édition (membre)** : ajouter/retirer un lien (sélection d'une autre fiche + `kind` + `label?`), et **par champ héritable** un sélecteur « valeur propre / hériter de *{mère}* » (les mères proposées = les relations `parent` existantes).

### Bouton « + Créer une fiche fille » (membre, page fiche)

Ouvre `VitrineEditor` en **mode création** avec :
- la fiche courante **pré-définie comme mère** (relation `parent` créée à l'enregistrement),
- les champs héritables **cochés « hérité »** par défaut (l'utilisateur décoche ce qu'il veut rédiger en propre),
- enregistrement via `POST /api/subjects` étendu (`parentId` + `inherits`).

---

## 6. i18n & tests

### i18n
- Nouveau namespace **`graph`** + clés **`paper.relations.*`**, ajoutés dans `messages/en.json` **et** `messages/fr.json` (zéro chaîne hardcodée).
- Libellés d'arêtes saisis par l'utilisateur : auto-traduits dans `label_i18n` (réutilise le pipeline `buildTaskI18n`/équivalent) ; affichage via helper `localized…`.

### Tests (vitest, TDD)
- `resolveInheritance` : champ propre / champ hérité / chaîne mère→grand-mère / anti-cycle / mère confidentielle masquée au visiteur (repli colonne plate).
- Normalisation `assoc` (source<target), unicité.
- Détection de cycle au `POST relations` (409).
- Purge `inherits` au `DELETE relations` et à la suppression de la mère.
- Gate visiteur : liens/héritage vers fiche confidentielle absents.
- Tests composant légers : `RelationsPanel` (groupes, mode édition), wiring `RelationGraph` (nœuds/arêtes dérivés des données).
- `tsc --noEmit` / `lint` / `build` à 0.

---

## Fichiers touchés (vue d'ensemble)

**Nouveau** : `supabase/migrations/013_subject_relations.sql` ; `src/lib/subjects/inheritance.ts` ; `src/app/[locale]/graph/page.tsx` ; `src/components/graph/RelationGraph.tsx` (+ helpers) ; `src/components/paper/RelationsPanel.tsx` ; `src/app/api/subjects/[id]/relations/route.ts` + `[relId]/route.ts`.

**Modifié** : `src/types/index.ts` ; `src/app/api/subjects/route.ts` (POST étendu) + `[id]/route.ts` (PATCH `inherits`) ; `src/components/paper/PaperView.tsx` + `PaperSheet.tsx` (badges hérités) ; `src/components/lab/SubjectVitrine.tsx` + `VitrineEditor.tsx` (mode « créer une fille ») ; `src/lib/rag/chunk.ts` (`chunkSubject` via résolution) ; `src/components/layout/NavMenu.tsx` ; `messages/{en,fr}.json`.
