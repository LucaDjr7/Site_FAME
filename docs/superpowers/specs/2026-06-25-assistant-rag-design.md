# Spec — Assistant conversationnel RAG (chatbot LLM) FAME

**Date :** 2026-06-25
**Statut :** design validé (brainstorming) → prêt pour `writing-plans`
**Périmètre :** v1 d'un assistant conversationnel public + membre, ancré (RAG) sur le contenu des deux labos, fortement bridé.

---

## 1. Contexte & objectif

Le site FAME présente deux labos de recherche (Paris, Montréal). On ajoute un **assistant conversationnel** dont l'objectif est **double**, avec une **priorité au visiteur** :

- **Visiteur (cible n°1)** — découverte « sans chercher » : un journaliste, un partenaire, un étudiant comprend le projet **en discutant**, sans naviguer dans le site.
- **Membre (cible n°2)** — assistance à la recherche : retrouver une tâche, connaître l'avancement d'un sujet, pointer les fichiers d'un sujet.

**Le point le plus critique n'est pas le RAG mais le bridage** : le bot ne doit jamais sortir de son rôle, aborder un sujet hors-périmètre, divulguer du contenu confidentiel/PII, ni être détourné. La qualité de la garde prime sur la richesse des réponses.

---

## 2. Périmètre v1

### Dans la v1
- Chat **public + membre** : bulle flottante sur toutes les pages + **page plein écran** + **entrée mise en avant sur l'accueil/globe**. Réponses en **streaming**.
- **RAG** sur : sujets, tâches, publications, membres (sans email), prompts (membres), **KB Markdown** (`docs/kb/*.md`) + **pointeurs Dropbox** (membres).
- **Tool-calling** : avancement d'un sujet (%), recherche de tâches (sujet/statut/assigné), fichiers Dropbox d'un sujet — chaque outil **ré-applique les permissions**.
- **Bridage en couches** : prompt système strict, modération d'entrée, court-circuit par seuil d'ancrage, anti-injection, masquage PII de sortie. **Jeu de prompts rouges** explicite, rejoué à chaque déploiement.
- **Confidentialité** : nouveau flag `confidentiel` sur les sujets (posable par tout membre, **public par défaut**), filtré **au moment de la requête** (effet instantané).
- **Indexation à l'écriture** (embed-on-write) + script de **backfill** initial + KB indexée au build.
- **Conservation C** : journalisation des **questions sans réponse** et des **tentatives signalées** uniquement (pas de transcription intégrale).
- **Rate-limit persistant** (table Supabase) + **plafond budgétaire dur 50 $/mois** → **mode dégradé**.
- **Page admin** `/admin/assistant`.
- Réponse **dans la langue de la question** ; embeddings multilingues ; UI du chat i18n en/fr ; MAJ `/privacy`.

### Reporté (v1.1+)
- Indexation du **contenu** des fichiers Dropbox (parsing PDF/Word).
- Résidence de données UE / zéro-rétention contractuelle.
- Bascule génération vers Claude et/ou étage flagship.
- Tableau de bord admin riche (graphes/tendances).
- Création de proposition **directement** par le bot.

---

## 3. Matrice d'accès (frontière de sécurité)

Le retrieval **et** chaque outil filtrent selon *qui pose la question*. Rien d'autre ne doit fuiter.

| Contenu | Visiteur (public) | Membre connecté |
|---|---|---|
| Sujets publics | ✅ | ✅ |
| Sujets **confidentiels** | ❌ | ✅ |
| Tâches / avancement | ✅ *(hors sujet confidentiel)* | ✅ |
| Publications | ✅ | ✅ |
| Membres (nom, rôle, labo, domaines) | ✅ | ✅ |
| **Emails de membres** / tout contact perso | ❌ | ❌ |
| KB (mission, FAQ, à-propos) | ✅ | ✅ |
| Prompts (contenu) | ❌ | ✅ |
| Pointeurs Dropbox d'un sujet | ❌ | ✅ |
| Données/contenu Dropbox, propositions, financement, commentaires | ❌ | ❌ (hors univers du bot en v1) |

- **Tier d'autorisation** dérivé de `getSession()` : `visitor` (anonyme) ou `member` (toute session membre ; un membre voit tout, y compris confidentiel). Pas de palier admin pour la *lecture* du bot.
- La **confidentialité est un filtre au query-time** : la table vectorielle porte les colonnes `visibility`/`confidentiel`/`labo`/`is_transversal` ; basculer un sujet en confidentiel le retire **immédiatement** des résultats visiteurs sans ré-indexation.
- **Pas de filtre par labo** sur la visibilité : le public couvre les deux labos (cohérent avec la décision produit « cross-lab non isolé », [[b5-cross-lab-pas-isolation]]). Le labo courant peut servir d'indice de *ranking* doux, pas de filtre.

---

## 4. Architecture d'ensemble

```
Navigateur (bulle / page / entrée globe)
        │  POST /api/assistant/chat   (SSE streaming)
        ▼
Route handler  ──► 1. kill-switch + budget (mode dégradé si dépassé)
                   2. rate-limit persistant (IP visiteur / id membre)
                   3. modération d'entrée (OpenAI Moderation)
                   4. embed de la question (OpenAI embeddings)
                   5. retrieve pgvector  ── filtre permissions (tier) ──►
                   6. seuil d'ancrage : rien au-dessus ⇒ court-circuit "non traité → /propose"
                   7. boucle tool-calling (outils BDD, permissions re-appliquées)
                   8. génération streamée (provider swappable, étage mini)
                   9. masquage PII de sortie
                  10. comptabilité tokens + journalisation (sans réponse / signalé)
```

**Familles de sources** (deux rythmes de fraîcheur) :
- **Contenu BDD** (sujets/tâches/publications/prompts/membres) → **embed-on-write** sur les routes existantes.
- **KB Markdown** (`docs/kb/*.md`) → indexée au **build/déploiement** + bouton ré-indexer admin.

### Modules (`src/lib/`)
- `llm/provider.ts` — **interface fournisseur swappable** (chat + embeddings), pilotée par env. v1 = OpenAI.
- `rag/embeddings.ts` — wrapper embeddings (`text-embedding-3-large`, dimensions réduites à 1536).
- `rag/chunk.ts` — découpage des sources en extraits (~512 tokens, titre du sujet préfixé).
- `rag/index.ts` — upsert/delete des vecteurs ; `index-source(type, id)` appelé par les hooks d'écriture.
- `rag/kb.ts` — chargement + indexation des fichiers Markdown.
- `rag/retrieve.ts` — recherche vectorielle + **filtre de permissions** + seuil d'ancrage.
- `rag/tools.ts` — définition des outils + handlers (chaque handler **ré-applique les permissions**).
- `rag/system-prompt.ts` — prompt système de bridage.
- `rag/moderation.ts` — modération d'entrée.
- `rag/guardrails.ts` — court-circuit seuil, masquage PII, heuristiques d'injection.
- `rag/usage.ts` — comptabilité tokens + vérif plafond 50 $.
- `rag/rate-limit-db.ts` — rate-limit **persistant** (remplace `rate-limit.ts` en mémoire pour cet endpoint).

### Composants (`src/components/assistant/`)
- `ChatWidget` (bulle flottante, montée dans le layout), `ChatPanel` (conversation), `ChatPage` (plein écran `/[locale]/assistant`), `HomeChatEntry` (entrée proéminente sur le globe), `MessageBubble`, `SourceCitation`, `ProposeCta`.

### Routes API (`src/app/api/assistant/`)
- `POST /chat` — endpoint principal (streaming SSE). Auth optionnelle → dérive le tier.
- `POST /reindex` — admin only (backfill complet).
- Hooks d'embed branchés dans les routes existantes `subjects|publications|prompts` (POST/PATCH/DELETE) via `index-source`, exécutés après réponse (`waitUntil`).

---

## 5. Modèle de données (nouvelles migrations)

> Conventions du projet respectées : RLS activée ; **écritures via routes `/api/` au service-role sans cookies** ([[service-role-no-cookies]]).

- **`subjects.confidentiel boolean NOT NULL DEFAULT false`** (migration `006`). Type `Subject` mis à jour. Coercition `!!` à l'écriture (POST/PATCH subjects), comme `is_transversal`.
- **Extension `pgvector`** + table **`rag_chunks`** :
  - `id uuid pk`, `source_type` (`subject|task|publication|prompt|member|kb`), `source_id text` (id BDD ; chemin pour KB), `labo lab null`, `is_transversal bool default false`, `confidentiel bool default false`, `visibility` (`public|member`), `lang text`, `content text`, `embedding vector(1536)`, `token_count int`, `embedding_stale bool default false`, `created_at`, `updated_at`. Index **hnsw** sur `embedding`.
- **`chat_rate_limit`** : `key text` (ip pseudonymisée ou `member:<id>`), `window_start timestamptz`, `count int`. (compteur fenêtre glissante persistant)
- **`chat_usage`** : `month text pk` (`YYYY-MM`), `tokens_in bigint`, `tokens_out bigint`, `est_cost_usd numeric` — incrémenté atomiquement ; base du kill-switch.
- **`chat_unanswered`** : `id`, `question text`, `lang`, `ip_hash`, `created_at`, `resolved bool default false`. (conservation C)
- **`chat_flagged`** : `id`, `question text`, `reason text` (catégorie modération / heuristique injection), `ip_hash`, `created_at`. (conservation C)
- **`app_settings`** (ou réutilisation existante) : drapeau `assistant_enabled bool` (kill-switch manuel), **doublé** par la variable d'env `ASSISTANT_DISABLED`.

**Confidentialité & embeddings :** un sujet confidentiel **est** vectorisé (posture A, §11) avec `visibility='member'` + `confidentiel=true` ; il n'est jamais renvoyé à un visiteur grâce au filtre query-time. Le masquage des emails se fait à l'indexation des membres (jamais d'email dans `content`) **et** en sortie (filet).

---

## 6. Indexation

- **Embed-on-write** : après succès d'un `POST/PATCH` sur `subjects|publications|prompts`, `index-source(type, id)` (re)chunke + (re)vectorise + upsert ; `DELETE` purge les vecteurs. Exécuté **après la réponse** via `waitUntil` (n'allonge pas l'écriture). En cas d'échec d'embedding → `embedding_stale=true`, balayé par un **cron léger** de rattrapage.
- **Backfill** : script `npm run index:rag` — vectorise tout l'existant + la KB. Idempotent (upsert). Lancé au premier déploiement et via le bouton admin.
- **KB** : `docs/kb/*.md` découpés par titres/~512 tokens, `visibility='public'`, indexés au build/déploiement.
- **Découpage** : sujets = un extrait par champ logique (`context`/`method`/`results`) avec titre + kicker préfixés ; publications = un extrait (ligne bibliographique) ; prompts = un extrait (ou découpé si long) ; membres = un extrait (nom, rôle, labo, domaines — **sans email**).

---

## 7. Retrieval, génération & langue

- **Embeddings** : OpenAI `text-embedding-3-large`, `dimensions=1536`. Multilingue (recherche translingue : lit FR, répond EN, et inversement).
- **Retrieval** : top-k par similarité cosinus, **filtré par tier** (et `confidentiel`/`visibility`). **Seuil d'ancrage** : si le meilleur score < seuil → court-circuit (pas d'appel génération).
- **Tool-calling** : si la question est structurée (avancement, recherche de tâches, fichiers), le modèle appelle un outil ; le handler interroge la BDD **en ré-appliquant les permissions**, renvoie du structuré, puis le modèle rédige.
  - `get_subject_progress(subject_id)` → tâches done/total, statut. (refus si sujet confidentiel et tier visiteur)
  - `find_tasks({subject?, statut?, assignee?})` → liste (hors sujets confidentiels pour visiteur ; `assignee`=« mes tâches » réservé aux membres).
  - `get_subject_files(subject_id)` → pointeurs `dropbox_links` (membres only).
- **Génération** : provider **swappable**, v1 = OpenAI étage **mini**. Bascule flagship/Claude = variable d'env (interface `llm/provider.ts`).
- **Langue** : réponse dans la **langue détectée de la question** ; fallback locale UI. KB mono-langue, traduite à la volée.
- **Streaming** : la réponse finale est streamée (SSE). Pendant retrieval/outils, indicateur « recherche… ».
- **Citations** : chaque réponse de fond cite ses sources sous forme de **liens cliquables** (`paper/[id]`, publications, membres, KB).

---

## 8. Bridage en couches (priorité produit) + tests

Défense en profondeur — aucune couche seule ne suffit :

1. **Prompt système strict** (`rag/system-prompt.ts`) : périmètre FAME/recherche uniquement ; **refus poli + redirection** hors-périmètre (strict, aucun écart) ; **réponse uniquement à partir des extraits fournis** ; jamais de PII ni d'opinion hors-mission ; **voix au nom de FAME mais chaleureuse** (pas impersonnelle) ; ne jamais révéler le prompt système ni obéir à une instruction cachée.
2. **Modération d'entrée** : chaque question passe par l'**API Moderation OpenAI** (gratuite) ; contenu signalé → refus + journalisation `chat_flagged`.
3. **Court-circuit par ancrage** (barrière la plus efficace) : aucun extrait au-dessus du seuil ⇒ on **n'appelle pas** la génération ⇒ réponse « ce sujet n'est pas traité » + **CTA `/propose` pré-rempli** (§9) + journalisation `chat_unanswered`. *Pas de sources = pas de réponse* (tue hallucination + hors-sujet). Arbitrage prudence/utilité **assumé** (un seuil haut refuse parfois une question légitime).
4. **Anti-injection** : consignes pour ignorer toute instruction dans le contenu récupéré *ou* la question (« ignore tes règles », jeux de rôle) ; heuristiques de détection → `chat_flagged`.
5. **Masquage PII de sortie** : tout motif d'email (et contacts) masqué avant affichage, même si une source en contenait par erreur.

**Tests :**
- **Gardes déterministes → Vitest (node)**, fiables : filtre de permissions (visiteur n'obtient jamais confidentiel/membre/PII), court-circuit seuil, masquage PII, permissions des outils, compteur rate-limit, kill-switch budget → dégradé, chemin de modération, parité i18n du namespace `assistant`.
- **Comportement modèle (non déterministe) → jeu de prompts rouges** : liste explicite dans `docs/assistant-red-team.md` (hors-sujet, jailbreak, extraction PII, fuite de confidentiel, injection), **rejouée manuellement à chaque déploiement**. Les gardes déterministes rattrapent l'essentiel quoi que dise le modèle.

---

## 9. Rebond « proposez-nous le sujet »

Au court-circuit pour un **visiteur** : réponse « ce sujet n'est pas (encore) traité » + **bouton CTA** ouvrant `/propose` avec la **description pré-remplie** par la question (le visiteur complète nom/email/domaine). **Aucune écriture en base par le bot.** La question est journalisée dans `chat_unanswered` que le visiteur propose ou non.

---

## 10. UI

- **Bulle flottante** (`ChatWidget`) sur toutes les pages (montée au niveau layout), tokens FAME existants.
- **Page plein écran** `/[locale]/assistant` pour les sessions longues.
- **Entrée proéminente sur l'accueil/globe** (`HomeChatEntry`) : invitation visible (barre de saisie / CTA « Posez votre question sur FAME ») intégrée à la scène du globe — **pas** une simple bulle discrète.
- **Citations** rendues en liens cliquables ; **CTA propose** quand non traité.
- **Mode dégradé** : message « assistant momentanément indisponible » (parallèle au 503 Dropbox).
- i18n : namespace `assistant`, **parité en/fr stricte** ([[tailwind-fame-tokens-dead]] : utiliser les tokens `fame-*`, `@config` intact).
- Process maquette : **design directement dans la spec/implémentation** (option ii, pas de maquette Claude Design dédiée).

---

## 11. Gouvernance des données, fournisseurs & RGPD

- **Posture A** : recours aux fournisseurs hébergés acceptable, en s'appuyant sur leurs conditions d'API (pas d'entraînement sur les données d'API par défaut ; rétention zéro disponible).
- **Single-vendor v1 : OpenAI** (embeddings + génération) → **une seule clé**, un seul DPA, un seul sous-traitant à déclarer.
- **Obligations** : signer le **DPA OpenAI** (contient les SCC légalisant le transfert UE→USA) ; **déclarer OpenAI** comme sous-traitant dans `/privacy` (transfert hors UE encadré par SCC) ; base légale (intérêt légitime / consentement à l'ouverture du chat).
- **Loi 25 (Québec)** pour le pôle de Montréal : obligations analogues (divulgation du transfert, consentement).
- **Reporté** : résidence UE (OpenAI propose une résidence européenne API ; Claude via Bedrock/Vertex EU) et zéro-rétention contractuelle.

---

## 12. Coût & abus

- **Rate-limit persistant** (table `chat_rate_limit`) — la `Map` mémoire de `rate-limit.ts` ne tient pas sur Vercel serverless pour un endpoint public coûteux. Par **IP** (visiteur) / **id membre**. **Valeurs prudentes par défaut** (à confirmer à l'implémentation) : ex. 8 messages / 10 min et 40 / jour par IP visiteur ; plus généreux pour les membres.
- **Plafonds par requête** : max tokens de réponse, longueur max de question, **N derniers tours** seulement renvoyés (mémoire multi-tours plafonnée), garde sur la taille du contexte récupéré.
- **Plafond budgétaire dur 50 $/mois** : `chat_usage` cumule les tokens → coût estimé ; au-delà, **mode dégradé** automatique (kill-switch budget). Doublé d'un **kill-switch manuel** (`assistant_enabled` + env `ASSISTANT_DISABLED`).
- **Mode dégradé** : si `OPENAI_API_KEY` absente, budget dépassé, ou désactivation manuelle → l'endpoint renvoie un état dégradé et l'UI affiche le message d'indisponibilité.

---

## 13. Admin & observabilité

Page **`/admin/assistant`** (`requireAdmin`) :
- **Consommation du mois vs plafond 50 $** (tokens cumulés, %, état dégradé courant).
- **Interrupteur manuel** (activer/désactiver, doublé par env).
- **Questions sans réponse** (`chat_unanswered`) — signal de trous KB + entonnoir de propositions.
- **Tentatives signalées** (`chat_flagged`) — audit de sécurité.
- **Bouton « ré-indexer »** (`POST /api/assistant/reindex`, backfill complet).

---

## 14. Conservation (RGPD — option C)

- **Pas** de transcription intégrale stockée côté serveur.
- Stockés : **questions sans réponse** (`chat_unanswered`) et **tentatives signalées** (`chat_flagged`), IP **pseudonymisée** (hash).
- Conversation multi-tours : vit côté client ; seuls les N derniers tours sont renvoyés à chaque appel.
- Rétention courte + purge documentée dans `/privacy`.

---

## 15. Secrets & variables d'environnement (server-only)

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | embeddings + génération (server-only, **jamais** `NEXT_PUBLIC_`) |
| `ASSISTANT_MODEL` | id du modèle de génération (défaut : étage mini) |
| `ASSISTANT_EMBED_MODEL` | `text-embedding-3-large` |
| `ASSISTANT_MONTHLY_BUDGET_USD` | défaut `50` |
| `ASSISTANT_DISABLED` | kill-switch manuel (défense en profondeur) |
| `ASSISTANT_SIMILARITY_THRESHOLD` | seuil d'ancrage |

Respecte la règle projet : seuls `NEXT_PUBLIC_{SUPABASE_URL,SUPABASE_ANON_KEY,APP_URL}` portent ce préfixe. `.env.example` mis à jour (clés sans valeurs).

---

## 16. Critères de réussite v1

- (a) **Jeu de prompts rouges à 100 %** : aucun hors-sujet / fuite / jailbreak réussi.
- (b) Chaque réponse de fond **cite ses sources** (liens cliquables).
- (c) **Zéro fuite** de contenu confidentiel / PII — vérifié par tests déterministes.
- (d) **Coût réel sous le plafond** 50 $/mois (kill-switch effectif).
- (e) **Latence de première réponse acceptable** grâce au streaming.

---

## 17. Décisions & exceptions à tracer

- **Exception `CLAUDE.md`** : le projet impose Claude pour l'IA ; la v1 utilise **OpenAI** pour la génération (single-vendor / coût / clé unique), **derrière une interface swappable**. Exception **assumée et documentée** pour qu'elle ne soit pas « corrigée » par erreur.
- **Assouplissement B4** : `GET /api/members` a été passé en auth-requise (Vague 0) ; le bot **expose des infos membres non-PII (sans email) aux visiteurs**. Assouplissement assumé.
- **Rate-limit** : `rate-limit.ts` (Map mémoire) insuffisant pour cet endpoint → **rate-limit persistant Supabase** dédié.
- **Cross-lab** : pas de filtre labo sur la visibilité (cohérent avec [[b5-cross-lab-pas-isolation]]).

## 18. Alternatives écartées (résumé)

- **Embeddings** : Voyage (recommandé Anthropic) / Mistral (UE) écartés au profit d'OpenAI (single-vendor, simplicité, posture A).
- **Indexation** : batch-only écartée au profit de l'embed-on-write (fraîcheur temps réel demandée).
- **KB** : page admin éditable (option A) écartée au profit des fichiers Markdown repo (option B).
- **Conservation** : transcriptions complètes (B) écartées au profit du log ciblé (C).
- **Proposition** : création directe par le bot (C) écartée (surface d'écriture publique / spam) au profit du CTA pré-rempli (B).

---

## 19. Mise en œuvre

Feature livrée sur une **branche dédiée** (`feat/assistant-rag`), via `writing-plans` → `subagent-driven-development`, une PR. Migrations Supabase à appliquer par l'utilisateur (comme `004`/`005`). Audit pré-prod déjà soldé (Vagues 0–4) ; cette feature est indépendante du déploiement (Task 20).
