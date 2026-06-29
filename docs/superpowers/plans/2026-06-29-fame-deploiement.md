# Déploiement FAME Website — Plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre le site FAME en production sur Vercel + Supabase, avec assistant RAG, emails, et fichiers Dropbox fonctionnels.

**Architecture:** App Next.js 16 déployée sur Vercel (intégration Git native, pas de `vercel.json` requis). BDD/Auth/Storage sur Supabase (projet déjà créé, migrations `001`→`011` appliquées). Intégrations server-only : OpenAI (assistant/traductions), Resend (emails), Dropbox (explorateur de fichiers). Post-déploiement : `seed:admin` puis `index:rag` exécutés depuis la machine dev avec un `.env.local` pointant la prod.

**Tech Stack:** Next.js 16.2.9 · React 19 · Supabase (`@supabase/ssr`) · OpenAI · Resend · Dropbox SDK · Vercel.

## Légende
- 👤 **Manuel (toi)** : action dans un dashboard externe / DNS / décision. Un agent ne peut pas la faire.
- 🤖 **Automatisable** : commande locale ou édition de fichier qu'un agent/CLI peut exécuter.

## Global Constraints
- Secrets **server-only** jamais préfixés `NEXT_PUBLIC_` : `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `ASSISTANT_IP_SALT`, `REPORT_EMAIL`. Seuls `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` sont publics.
- Migrations Supabase `001`→`011` : **déjà appliquées** sur le projet cible (confirmé). Le bucket privé Storage `subject-files` et l'extension `pgvector` sont créés par ces migrations — aucune création manuelle.
- Embeddings réduits à **1536 dimensions** (constante `EMBED_DIMENSIONS` dans `src/lib/llm/index.ts`) pour matcher la colonne `vector(1536)`. Ne pas changer le modèle d'embedding sans réindexer.
- `seed:admin` et `index:rag` lisent **`.env.local`** (via `dotenv`), pas les vars Vercel. Pour viser la prod, pointer `.env.local` sur les credentials prod le temps de l'exécution.
- Ne jamais commiter `.env.local`.

---

## Phase 0 — Pré-vol (avant tout déploiement)

### Task 0 : Valider la base de code localement

**Files:** aucun (vérification seule).

- [ ] **Step 1 — 🤖 Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune sortie d'erreur (exit 0).

- [ ] **Step 2 — 🤖 Lint**

Run: `npm run lint`
Expected: pas d'erreur ESLint.

- [ ] **Step 3 — 🤖 Tests**

Run: `npm run test`
Expected: suite verte (≈258 tests OK).

- [ ] **Step 4 — 🤖 Build prod**

Run: `npm run build`
Expected: `✓ Compiled successfully`, build termine sans erreur.

> ⛔ Si une étape échoue, **stop** : corriger avant de continuer. On ne déploie pas une base rouge.

---

## Phase 1 — Décisions & provisioning des comptes (👤 toi)

### Task 1 : Trancher les décisions structurantes

**Files:** aucun (décisions notées pour les tâches suivantes).

- [ ] **Step 1 — 👤 Domaine final**

Choisir le domaine prod (ex. `fame.example.org`). Il fixe `NEXT_PUBLIC_APP_URL`, `EMAIL_FROM`, le domaine Resend à vérifier, et les Redirect URLs Supabase. Noter la valeur.

- [ ] **Step 2 — 👤 Région**

Confirmer la région Vercel (cohérente avec la région du projet Supabase existant). Aucune migration de région BDD (déjà en place).

- [ ] **Step 3 — 👤 Stratégie Dropbox**

Décider : (a) token longue durée généré manuellement, ou (b) faire évoluer le code vers un refresh token. Le code actuel (`src/lib/dropbox/client.ts`) lit un `DROPBOX_ACCESS_TOKEN` statique ; un token « generated » standard expire en ~4 h. **Recommandé pour livrer vite : (a)**, en notant le risque d'expiration ; planifier (b) ensuite si besoin.

### Task 2 : Générer les secrets propres à la prod

**Files:** aucun (valeurs stockées dans ton gestionnaire de secrets).

- [ ] **Step 1 — 🤖 Pepper IP**

Run: `openssl rand -hex 32`
Expected: une chaîne hex de 64 caractères → ce sera `ASSISTANT_IP_SALT` (prod). Ne pas réutiliser celui de dev.

- [ ] **Step 2 — 👤 Identifiants admin initial**

Choisir `SEED_ADMIN_EMAIL` et un `SEED_ADMIN_PASSWORD` fort. Servent une seule fois au seed.

### Task 3 : Provisionner les services externes

**Files:** aucun (dashboards externes). Collecter chaque clé pour la Phase 2.

- [ ] **Step 1 — 👤 Supabase (déjà créé)** : récupérer dans Settings → API les 3 valeurs `Project URL`, `anon public`, `service_role`.

- [ ] **Step 2 — 👤 Supabase Auth** : Authentication → URL Configuration → poser `Site URL` = domaine prod, ajouter Redirect URL `https://<domaine>/**`. Sans ça, activation/login cassent.

- [ ] **Step 3 — 👤 OpenAI** : créer `OPENAI_API_KEY` ; poser une limite de budget mensuelle sur le compte.

- [ ] **Step 4 — 👤 Resend** : créer le compte → `RESEND_API_KEY` ; ajouter le domaine expéditeur et poser les enregistrements **SPF + DKIM (+ DMARC)** chez le registrar ; attendre la **vérification du domaine**. Définir `EMAIL_FROM` sur ce domaine.

- [ ] **Step 5 — 👤 Dropbox** : créer l'app (scopes `files.metadata.read`, `files.content.read`), générer le `DROPBOX_ACCESS_TOKEN` selon la décision Task 1 Step 3.

- [ ] **Step 6 — Vérification** : avoir en main les 11 valeurs du tableau de la Task 5 (sinon le déploiement échouera silencieusement à l'usage).

---

## Phase 2 — Configuration Vercel & premier déploiement

### Task 4 : Connecter le repo à Vercel

**Files:** aucun (dashboard Vercel).

- [ ] **Step 1 — 👤** Créer le projet Vercel, importer le repo GitHub `FAME_Website`. Framework détecté = Next.js, build `npm run build`, output par défaut. Ne pas déployer tout de suite (vars manquantes).

### Task 5 : Renseigner les variables d'environnement (Production)

**Files:** aucun (Vercel → Settings → Environment Variables).

- [ ] **Step 1 — 👤** Saisir **toutes** ces variables (scope Production) :

| Variable | Public ? | Valeur |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase API |
| `NEXT_PUBLIC_APP_URL` | public | `https://<domaine>` |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | Supabase API |
| `OPENAI_API_KEY` | server-only | OpenAI |
| `RESEND_API_KEY` | server-only | Resend |
| `EMAIL_FROM` | server-only | `FAME <no-reply@<domaine>>` |
| `DROPBOX_ACCESS_TOKEN` | server-only | Dropbox |
| `ASSISTANT_IP_SALT` | server-only | sortie `openssl` (Task 2) |
| `REPORT_EMAIL` | server-only | destinataire des signalements |

Optionnels (défauts OK, ne poser que pour override) : `ASSISTANT_EMBED_MODEL`, `ASSISTANT_MODEL`, `ASSISTANT_SIMILARITY_THRESHOLD`, `ASSISTANT_MONTHLY_BUDGET_USD`, `ASSISTANT_DISABLED`.

- [ ] **Step 2 — Vérification** : aucun secret server-only n'a le préfixe `NEXT_PUBLIC_`. Relire la colonne « Public ? ».

### Task 6 : Premier déploiement

**Files:** aucun.

- [ ] **Step 1 — 👤/🤖** Déclencher le déploiement (push sur `main` ou bouton « Deploy »).

- [ ] **Step 2 — Vérification** : le build Vercel se termine en **Ready**. Ouvrir l'URL `*.vercel.app` → la home (globe) s'affiche, locale `/en` par défaut.

### Task 7 : Brancher le domaine custom

**Files:** aucun (Vercel → Domains + DNS registrar).

- [ ] **Step 1 — 👤** Ajouter le domaine dans Vercel, poser les enregistrements DNS indiqués chez le registrar, attendre la propagation + le certificat TLS.

- [ ] **Step 2 — 👤** Vérifier que `NEXT_PUBLIC_APP_URL` et les Redirect URLs Supabase (Task 3 Step 2) correspondent **exactement** au domaine final (sinon liens d'email cassés). Re-déployer si `NEXT_PUBLIC_APP_URL` a changé après coup.

---

## Phase 3 — Initialisation des données (one-shot)

> ⚠️ Ces scripts lisent `.env.local`. Procédure : sauvegarder ton `.env.local` de dev, le pointer temporairement sur la **prod** (`SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` prod, `OPENAI_API_KEY` prod, `SEED_ADMIN_*`), exécuter, puis restaurer.

### Task 8 : Créer le compte admin initial

**Files:** `.env.local` (temporaire, non commité).

- [ ] **Step 1 — 🤖** Sauvegarder l'actuel : `cp .env.local .env.local.dev.bak`

- [ ] **Step 2 — 👤/🤖** Mettre dans `.env.local` les valeurs **prod** : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

- [ ] **Step 3 — 🤖** Run: `npm run seed:admin`
Expected: confirmation de création de l'admin (pas d'erreur « Set SEED_ADMIN_… »).

- [ ] **Step 4 — Vérification** : se connecter sur le site prod avec ces identifiants → accès admin OK.

### Task 9 : Indexer le RAG

**Files:** `.env.local` (toujours en mode prod).

- [ ] **Step 1 — 👤/🤖** S'assurer que `OPENAI_API_KEY` (prod) est dans `.env.local`.

- [ ] **Step 2 — 🤖** Run: `npm run index:rag`
Expected: indexation des sources sans erreur ; consomme du budget OpenAI.

- [ ] **Step 3 — 🤖** Restaurer l'env dev : `mv .env.local.dev.bak .env.local`

- [ ] **Step 4 — Vérification** : sur le site prod, poser une question à l'assistant Astra → réponse avec citations (le RAG répond).

---

## Phase 4 — Vérification de bout en bout (smoke tests prod)

### Task 10 : Parcours fonctionnel complet

**Files:** aucun (test manuel navigateur sur le domaine prod).

- [ ] **Step 1 — 👤 Auth** : login admin OK ; déconnexion OK.
- [ ] **Step 2 — 👤 Invitation membre** : inviter un membre → **email reçu** (valide Resend + domaine vérifié) → activation via le lien → login membre.
- [ ] **Step 3 — 👤 i18n** : bascule `en`/`fr` sur plusieurs pages, aucune chaîne brute manquante.
- [ ] **Step 4 — 👤 Sujets** : créer/éditer un sujet → l'auto-traduction remplit l'autre langue ; le sujet apparaît dans la grille du lab.
- [ ] **Step 5 — 👤 Fichiers de sujet** : uploader un fichier (flux signé 3 temps) → re-télécharger ; vérifier qu'un sujet `confidentiel` n'est **pas** servi à un visiteur non connecté (404).
- [ ] **Step 6 — 👤 Assistant** : question RAG → réponse + citations ; vérifier qu'un doc de sujet confidentiel n'apparaît jamais pour un visiteur.
- [ ] **Step 7 — 👤 Dropbox** : page `/data` (membre) → l'arbre se charge (valide `DROPBOX_ACCESS_TOKEN`).
- [ ] **Step 8 — 👤 Signalement** : « Signaler un problème » → email reçu sur `REPORT_EMAIL`.
- [ ] **Step 9 — 👤 Sécurité bundle** : DevTools → vérifier qu'aucune valeur server-only (service role, tokens) n'est dans le JS client.

### Task 11 : Clôture

**Files:** `docs/STATUS.md`.

- [ ] **Step 1 — 🤖** Mettre à jour la section « Déploiement » de `docs/STATUS.md` : passer de « non démarré » à « livré », dater, lister le domaine prod et les éventuels restes (ex. migration Dropbox refresh token).

- [ ] **Step 2 — 🤖 Commit**

```bash
git add docs/STATUS.md
git commit -m "docs: déploiement prod livré + STATUS à jour"
```

---

## Risques & points de vigilance
- **Dropbox token court-vivant** : si l'arbre `/data` casse au bout de quelques heures, c'est l'expiration du token → implémenter le refresh (décision Task 1 Step 3).
- **Resend non vérifié** : tant que SPF/DKIM ne sont pas validés, invitations et activations **échouent silencieusement** → membres bloqués.
- **Redirect URLs Supabase** : un domaine non listé casse les liens d'email d'activation/reset.
- **`.env.local` prod oublié** : ne jamais commiter ; restaurer la version dev après les scripts (Task 9 Step 3).
- **Budget OpenAI** : `index:rag` + usage assistant consomment du budget ; le garde-fou applicatif est `ASSISTANT_MONTHLY_BUDGET_USD` + kill-switch `ASSISTANT_DISABLED=1`.
