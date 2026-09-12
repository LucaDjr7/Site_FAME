# Hub de veille recherche (IA × finance) — Design

_Date : 2026-09-12 · Statut : approuvé_

## Contexte & sources d'inspiration

Deux projets externes ont été audités avant ce design :

- **`ArdiaD/fame`** (GitHub, David Ardia / HEC Montréal) — pipeline Python complet
  (fetch arXiv/RePEc/SSRN/OpenAlex → filtre mots-clés IA×finance → score de
  pertinence FAME par embedding → revue humaine en Excel → site statique
  `fame-ai.org/hub`). Fonctionnel mais **100 % manuel** (pas de CI, cron local,
  review Excel via Dropbox) — le hub public n'a pas été régénéré depuis
  ~3 mois faute de disponibilité humaine récurrente.
- **Papyrus** (projet local, `~/Documents/Projets Programmation/Papyrus`) —
  plateforme Next.js/TypeScript/Prisma/PostgreSQL+pgvector, déjà partiellement
  orientée FAME (`jobs/ingestFame.ts`, thèmes dans `lib/scoring/themes.ts`).
  Code réel (81 commits, tests verts), tourne déjà sur **Supabase Postgres**.
  Deux enseignements clés de l'audit :
  1. `lib/sources/{arxiv,openAlex,semanticScholar,repec,crossRef}.ts` et
     `lib/scoring/*` sont **zéro-dépendance Prisma** — logique de fetch/scoring
     pure, portable quasi telle quelle.
  2. Le cron Vercel de Papyrus appelait la route en `GET` alors que
     l'ingestion réelle attendait un `POST` protégé — **l'automatisation n'a
     probablement jamais tourné en prod**, en silence. Piège à ne pas
     reproduire (voir § Fetch & cron).
  3. SSRN est bloqué par Cloudflare : seul patchright + Chrome **headful**
     passe, donc **incompatible avec Vercel serverless** — confirmé
     indépendamment par les deux projets.

## Objectif produit

Donner au site FAME une **vue automatisée et à jour de l'état de l'art**
recherche IA×finance, sans dépendre d'une revue humaine récurrente
(la leçon d'ArdiaD/fame), et sans réintroduire un pipeline Python séparé
(la leçon de Papyrus côté portabilité).

## Décisions produit

1. **Audience** : page publique en lecture (vitrine "labo actif"), avec
   bookmarks/notes personnelles réservés aux membres connectés.
2. **Curation** : **publication automatique** au-dessus d'un seuil de score —
   pas de file d'attente humaine bloquante. L'admin garde un **pouvoir de
   correction a posteriori** (masquer un publié, republier un rejeté, ajouter
   un papier manuellement).
3. **Sources** : arXiv, OpenAlex, RePEc, Semantic Scholar — 4 APIs fiables,
   100 % serverless. **SSRN exclu du MVP** (blocker Cloudflare confirmé).
4. **Filtre de pertinence** : principe à deux étages d'ArdiaD, sans l'étage
   humain (détaillé § Scoring).
5. **Emplacement** : page globale hors `[lab]` (comme `/privacy`), accessible
   depuis la nav des deux labos + un bouton dédié sur le globe d'accueil.
6. **Cadence** : fetch hebdomadaire via Vercel Cron.
7. **Stockage** : métadonnées uniquement (pas de PDF) — titre, auteurs,
   résumé, lien, embedding. Purge différenciée par statut (§ Rétention).

## 1. Filtre de pertinence & scoring FAME

Deux étages, comme `ArdiaD/fame` (`relevance.py` + `fame.py`), fusionnés en un
seul pipeline sans revue humaine :

1. **Filtre grossier (AND-gate mots-clés)** — un papier n'est même considéré
   que s'il matche ≥1 terme "IA" ET ≥1 terme "finance" dans titre/résumé.
   Termes fusionnés d'`ArdiaD/config.yaml` et `Papyrus/lib/scoring/themes.ts`
   dans `src/lib/research/themes.ts` (source de vérité unique, 12 thèmes
   repris de Papyrus — LLMs, RL, factor investing, volatilité, crypto, etc.).
   Élimine le bruit évident **avant** de dépenser un appel d'embedding.
2. **Score de pertinence FAME** — embedding du texte `titre + résumé` via le
   provider déjà en place (`getEmbeddingProvider()` de `src/lib/llm`, même
   `OPENAI_API_KEY`/`text-embedding-3-large` que le RAG Astra — **aucune
   nouvelle clé/dépendance**), similarité cosinus contre un résumé du projet
   FAME, normalisée 0-100 % (même formule que `fame.py`).
3. **Décision** : `fame_score >= FAME_THRESHOLD` (config, défaut 50 comme
   Ardia, ajustable sans redéploiement) → `status = 'published'` ; sinon
   → `status = 'rejected'`.

Différence assumée avec Ardia : chez lui le score FAME n'est qu'un badge
affiché après validation Excel. Ici il **est** le seuil de publication.

## 2. Modèle de données

Migration `017_research_hub.sql` :

```sql
create table research_papers (
  id               uuid primary key default gen_random_uuid(),
  fingerprint      text not null unique,        -- arXiv id / DOI / SSRN id, sinon hash du titre
  title            text not null,
  authors          text[] not null default '{}',
  abstract         text,
  url              text not null,
  source           text not null,               -- arxiv | openalex | repec | semantic_scholar | manual
  venue            text,
  themes           text[] not null default '{}',
  fame_score       int,                          -- 0-100
  embedding        vector(1536),
  published_at     date,                         -- date de publication du papier
  status           text not null,               -- published | rejected | hidden — décidé à l'insertion, jamais 'pending'
  manual_override  boolean not null default false,  -- respecté par le job hebdo, jamais écrasé
  fetched_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint research_papers_status_check check (status in ('published','rejected','hidden'))
);
create index research_papers_status_idx on research_papers (status, published_at desc);

create table research_fetch_log (
  id         uuid primary key default gen_random_uuid(),
  run_at     timestamptz not null default now(),
  source     text not null,
  added      int not null default 0,
  skipped    int not null default 0,
  errors     int not null default 0,
  message    text
);

create table research_bookmarks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  paper_id   uuid not null references research_papers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);

create table research_notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  paper_id   uuid not null references research_papers(id) on delete cascade,
  content    text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);
```

RLS : activée sur les 4 tables (convention du projet), **sans policy** —
comme `rag_chunks`, `subjects`, etc. Aucune table de ce repo n'a de policy
RLS réelle ; l'autorisation se fait entièrement côté application via
`createServiceClient()` + filtres explicites (`.eq('status', 'published')`
pour un visiteur, `.eq('user_id', member.id)` pour les bookmarks/notes),
jamais via des policies SQL. On suit ce pattern à l'identique plutôt que
d'introduire un mécanisme d'autorisation différent pour une seule feature.

Un papier qui rate l'étage 1 (AND-gate) n'est **jamais écrit** en base
(comme `fetch.py` d'Ardia, qui ne stocke que ce qui passe le filtre) — pas
de statut `pending` intermédiaire. Seuls les papiers ayant passé l'étage 1
sont insérés, avec `status` déjà déterminé (`published`/`rejected`) par
l'étage 2 au moment de l'écriture.

`src/types/index.ts` reçoit les interfaces `ResearchPaper`, `ResearchBookmark`,
`ResearchNote`, `ResearchFetchLogEntry` correspondantes.

## 3. Fetch & cron — pipeline hebdomadaire

```
Vercel Cron (hebdo, lundi 06:00)
   │  GET /api/research/fetch   Authorization: Bearer <CRON_SECRET>
   ▼
src/lib/research/sources/{arxiv,openalex,repec,semanticScholar}.ts
   │  repris de Papyrus (adaptation mineure : suppression de tout import Prisma,
   │  signature pure fetch(query, cfg) -> Paper[])
   │  chaque source dans un try/catch isolé — un échec n'interrompt jamais les autres
   ▼
src/lib/research/relevance.ts   (étage 1 : AND-gate)
   ▼
src/lib/research/dedup.ts       (fingerprint fort + fuzzy title token_sort_ratio ≥ 92,
                                  contre les fingerprints déjà en base)
   ▼
src/lib/research/score.ts       (étage 2 : embedding + cosinus + seuil)
   ▼
insertion research_papers (service-role) + une ligne research_fetch_log par source
   ▼
src/lib/research/retention.ts   (purge, voir § Rétention — même run, en fin de job)
```

**Point critique (leçon Papyrus)** : Vercel Cron n'envoie que des requêtes
`GET`. La route `GET /api/research/fetch` doit donc **directement** déclencher
l'ingestion (pas de split GET-liste / POST-ingestion comme chez Papyrus),
authentifiée par le header `Authorization: Bearer` que Vercel Cron envoie
nativement. Un test dédié simule un vrai déclenchement Vercel Cron (pas un
`curl POST` à la main) pour ne pas répéter le bug silencieux découvert chez
Papyrus.

`vercel.json` :
```json
{ "crons": [{ "path": "/api/research/fetch", "schedule": "0 6 * * 1" }] }
```

## 4. Rétention / purge

Exécutée en fin de chaque run hebdomadaire (`src/lib/research/retention.ts`) :

| Statut | Politique | Raison |
|---|---|---|
| `published` | Conservé indéfiniment | C'est le contenu de la veille elle-même ; volume négligeable (~500-1500/an). |
| `rejected` | Ligne supprimée après 90 jours | Bruit sans décision admin ; un retour au fetch plus tard sera juste re-scoré. |
| `hidden` | Après 90 jours : `abstract` et `embedding` mis à `null`, ligne conservée indéfiniment | Empêche la résurrection silencieuse du papier (le `fingerprint` reste connu du dédup) tout en libérant l'espace des champs lourds. |

`manual_override = true` (papier ajouté/masqué/republié à la main par un
admin) n'est **jamais** ré-écrit par le job de fetch, y compris lors du
dédup — le job saute simplement ces lignes.

## 5. Admin override (`admin/research`)

Nouvelle page, même pattern que `admin/proposals` :
- liste tous les papiers (`published` + `rejected`), score et thèmes visibles
- bouton **masquer** (`published → hidden`, `manual_override = true`)
- bouton **republier** (`rejected → published`, `manual_override = true`)
- formulaire **ajout manuel** (titre/auteurs/lien/résumé), `source = 'manual'`,
  `manual_override = true`
- section **journal de fetch** : dernières lignes de `research_fetch_log`,
  pour repérer immédiatement un run hebdo qui aurait échoué silencieusement

Routes : `POST /api/research/[id]/hide`, `POST /api/research/[id]/publish`,
`POST /api/research` (ajout manuel) — toutes `requireAdmin`, service-role.

## 6. UI publique — `src/app/[locale]/research/page.tsx`

Server Component — lecture via `createServiceClient()` filtrée
`.eq('status', 'published')`, comme le fait déjà `[lab]/page.tsx` pour la
grille de sujets (le projet n'a aucune policy RLS réelle ; le filtrage
visiteur/membre se fait toujours côté requête, jamais côté RLS). Pas de
route API pour cette lecture — page read-heavy, conforme AGENTS.md.

- `ResearchList` — grille/liste des papiers `published`
- `ResearchCard` — titre, auteurs, extrait du résumé, venue, chips de thème,
  badge score FAME, lien externe vers la source
- `ResearchFilters` — thème / source / plage de dates / recherche texte,
  état dans l'URL via `searchParams` natif Next 16 (pas de nouvelle
  dépendance type `nuqs`)
- `BookmarkButton` / `NoteField` (client components) — visibles uniquement
  si session membre active ; actions via `/api/research/bookmarks` et
  `/api/research/notes`

**Navigation** :
- chaque `[lab]/layout.tsx` (TopBar/NavMenu) : nouvelle entrée vers
  `/{locale}/research` (page partagée, pas dupliquée par labo)
- globe d'accueil (`[locale]/page.tsx`) : nouveau bouton cliquable à côté des
  pins de labo

**⚠️ Étape process obligatoire avant implémentation UI** (AGENTS.md) : lire
la maquette correspondante via le MCP Claude Design avant d'écrire
`ResearchCard`/`ResearchFilters`/le bouton d'accueil. `FAME Accueil.dc.html`
couvre le bouton du globe ; aucune maquette existante ne couvre la page
`research` elle-même — à vérifier/demander à l'utilisateur au moment de
l'implémentation (Opus requis pour cet accès).

## 7. i18n

Nouveau namespace `research` dans `messages/en.json` et `messages/fr.json` :
titres de filtres, labels de thèmes (12, réutilisés de `themes.ts`), textes
des boutons bookmark/note, labels admin (masquer/republier/ajouter).

## 8. Tests

- `src/lib/research/relevance.test.ts` — AND-gate mots-clés (fixtures avec/sans
  match IA, avec/sans match finance)
- `src/lib/research/dedup.test.ts` — fingerprint fort + fuzzy title
- `src/lib/research/retention.test.ts` — `rejected` >90j supprimé,
  `hidden` >90j vidé mais conservé, `manual_override` jamais touché
- `src/lib/research/sources/*.test.ts` — fixtures HTTP par source (l'audit a
  montré que ces fetchers n'étaient **pas testés** côté Papyrus ; on corrige
  ici), aucun appel réseau réel en CI
- `src/app/api/research/fetch/route.test.ts` — rejet sans `Authorization`
  valide ; format de requête conforme à un déclenchement Vercel Cron réel
- `src/app/api/research/[id]/{hide,publish}/route.test.ts`,
  `src/app/api/research/route.test.ts` (ajout manuel) — `requireAdmin`,
  404 si id inconnu

## Hors périmètre (v1)

- SSRN (blocker Cloudflare confirmé — pourra être ajouté plus tard via un
  script manuel local alimentant la même base, comme le font déjà
  ArdiaD/fame et Papyrus)
- Graphe de citations, alertes auteur/mot-clé, digest email hebdomadaire
  (fonctionnalités présentes dans Papyrus mais hors de l'objectif formulé
  — "avoir une vision de l'état de l'art", pas un outil de veille avancé)
- Re-scoring LLM des décisions admin (`manual_override` gèle définitivement
  la ligne)

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `supabase/migrations/017_research_hub.sql` | nouveau — 4 tables + RLS |
| `src/types/index.ts` | `ResearchPaper`, `ResearchBookmark`, `ResearchNote`, `ResearchFetchLogEntry` |
| `src/lib/research/themes.ts` | nouveau — 12 thèmes IA×finance (fusion Ardia+Papyrus) |
| `src/lib/research/sources/{arxiv,openalex,repec,semanticScholar}.ts` | nouveau — adaptés de Papyrus |
| `src/lib/research/relevance.ts` | nouveau — AND-gate |
| `src/lib/research/dedup.ts` | nouveau — fingerprint + fuzzy title |
| `src/lib/research/score.ts` | nouveau — embedding + seuil FAME |
| `src/lib/research/retention.ts` | nouveau — purge/anonymisation |
| `src/app/api/research/fetch/route.ts` | nouveau — `GET`, cron Vercel |
| `src/app/api/research/route.ts` | nouveau — `POST` ajout manuel admin |
| `src/app/api/research/[id]/{hide,publish}/route.ts` | nouveau |
| `src/app/api/research/bookmarks/route.ts`, `.../notes/route.ts` | nouveau |
| `src/app/[locale]/research/page.tsx` | nouveau |
| `src/app/[locale]/admin/research/page.tsx` | nouveau |
| `src/components/research/*` | nouveau — List, Card, Filters, BookmarkButton, NoteField |
| `src/app/[locale]/[lab]/layout.tsx` | + entrée nav |
| `src/app/[locale]/page.tsx` (globe) | + bouton vers `/research` |
| `vercel.json` | nouveau — cron hebdo |
| `messages/{en,fr}.json` | namespace `research` |
