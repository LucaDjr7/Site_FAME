# Guide de migration FAME — Repo GitHub · Supabase · Vercel

> Document destiné à la personne qui reprend l'infrastructure. Il liste **tout ce qui n'est pas dans le repo**
> (secrets, comptes, réglages de dashboards) et qu'il faut recréer à la main.
> **Ne jamais écrire de vraie valeur dans ce fichier** : le repo est public. Les champs `___` sont à remplir
> dans un gestionnaire de mots de passe, pas ici.

Dernière vérification du contenu : 2026-10-14 (commit `a1e5f71`).

---

## 0. Vue d'ensemble : ce qui migre, ce qui ne migre pas

| Élément | Dans le repo ? | Action à la migration |
|---|---|---|
| Code, migrations SQL (`supabase/migrations/001`→`017`), `vercel.json`, CI | Oui | Pousser le repo vers le nouveau compte GitHub |
| Variables d'environnement (clés, tokens) | **Non** (`.env*` ignoré, seul `.env.example` est suivi) | Tout re-saisir (section 3) |
| Données Supabase (membres, sujets, tâches, fichiers, comptes Auth) | **Non** | Export/import de la base (section 2.4) |
| Fichiers uploadés (bucket `subject-files`) | **Non** | À copier à part (section 2.5) |
| Lien projet Vercel (`.vercel/project.json`) | **Non** (ignoré) | `vercel link` sur le nouveau projet |
| Domaine, DNS, domaine d'envoi Resend | **Non** | À reconfigurer (section 5) |
| Index RAG (`rag_chunks`) | Non (données) | Soit copié avec la base, soit régénéré avec `npm run index:rag` |

Ordre recommandé : **1. GitHub → 2. Supabase → 3. Services tiers → 4. Vercel → 5. Domaine/DNS → 6. Post-déploiement.**

---

## 1. GitHub

- [ ] Créer le nouveau dépôt : `___` (org/compte : `___`). Repo actuel : `LucaDjr7/Site_FAME` (**public**).
- [ ] Pousser tout l'historique : `git remote set-url origin <nouvelle-url> && git push --mirror origin`
- [ ] Branche par défaut : `main`.
- [ ] CI : `.github/workflows/ci.yml` (typecheck, lint, tests, audit npm). **Aucun secret GitHub requis.** Node 20.
- [ ] Reconnecter l'intégration Git de Vercel au nouveau dépôt (section 4).
- [ ] Mettre à jour le lien dans le `README` / docs si le nom du repo change (références dans `docs/REVUE_PRE_PROD.md`).
- [ ] (Optionnel) Protection de `main`, reviewers, Dependabot.

---

## 2. Supabase

### 2.1 Création du projet

- [ ] Nouveau projet Supabase : nom `___`, région `___` (choisir proche de Vercel), mot de passe DB `___`.
- [ ] Récupérer dans *Project Settings → API* : **Project URL**, clé **anon**, clé **service_role**.

### 2.2 Schéma : appliquer les migrations dans l'ordre

À exécuter dans le SQL Editor (ou `supabase db push`), **dans l'ordre** :

`001_initial_schema` · `002_subject_difficulte_and_indexes` · `003_proposal_subject_link` · `004_transversal` ·
`005_drop_password_hash` · `006_assistant_rag` · `007_match_rag_chunks` · `008_subject_vitrine` ·
`009_subject_i18n` · `010_subject_files` · `011_subject_files_rag` · `012_task_i18n` · `013_subject_relations` ·
`014_subject_file_confidentiel` · `015_security_hardening` · `016_subject_show_in_tasks` · `017_research_hub`

Ce que les migrations créent déjà (rien à faire à la main) :
- Extensions `pgcrypto` et **`vector`** (pgvector, colonnes `vector(1536)`).
- Bucket Storage **privé** `subject-files` (50 Mo, liste blanche MIME) — migration 010.
- Ligne `app_settings.assistant_enabled = true` — migration 006.
- RLS activée sur toutes les tables ; l'accès passe par la clé service-role côté API.

> Si vous restaurez un dump complet (2.4), vérifiez que `vector` est bien activée (*Database → Extensions*) avant l'import.

### 2.3 Réglages de dashboard à refaire (non versionnés)

- [ ] *Authentication → Providers → Email* : l'app utilise **email + mot de passe**. Pas d'auto-inscription ; les comptes sont créés par l'API (`auth.admin.createUser` avec `email_confirm: true`).
- [ ] *Authentication → URL Configuration* : **Site URL** = nouvelle URL de prod ; ajouter les URLs de redirection autorisées (prod + éventuellement `http://localhost:3000`). L'app n'utilise ni OAuth ni magic link, mais gardez cohérent.
- [ ] *Authentication → Rate limits / SMTP* : l'app envoie ses mails via **Resend**, pas via le SMTP Supabase. Rien à configurer sauf si vous voulez des mails Supabase natifs.
- [ ] *Storage* : vérifier que le bucket `subject-files` existe et est **privé**.
- [ ] CSP (`next.config.ts`) autorise `https://*.supabase.co`. **Si vous utilisez un domaine custom Supabase**, ajouter ce domaine dans `connect-src` (upload direct vers Storage depuis le navigateur).

### 2.4 Migrer les données (si on garde l'existant)

Les comptes Auth sont dans `auth.users` ; `members.id` référence ces utilisateurs. **Il faut migrer les deux ensemble**, sinon les membres n'ont plus de compte.

- [ ] Dump de l'ancienne base : `pg_dump` (schémas `public` **et** `auth`, données comprises) ou `supabase db dump`.
- [ ] Restaurer sur la nouvelle base. Les mots de passe (hashés) suivent avec `auth.users`.
- [ ] Alternative « propre » : repartir d'une base vide, lancer `npm run seed:admin`, puis ré-inviter les membres depuis `/admin`.
- [ ] Vérifier après import : nombre de lignes dans `members`, `subjects`, `tasks`, `comments`, `subject_files`, `rag_chunks`.

### 2.5 Migrer les fichiers uploadés

- [ ] Les objets du bucket `subject-files` ne sont **pas** dans un dump SQL. Les copier (API Storage / script `supabase-js` avec les deux clés service-role) en conservant les mêmes chemins : `subject_files.storage_path` doit rester valide.

### 2.6 Compte admin

- [ ] Renseigner `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` dans `.env.local` **pointant vers la nouvelle base**, puis `npm run seed:admin`. À faire uniquement si la base est vide (sinon l'admin existe déjà).

---

## 3. Variables d'environnement (inventaire complet)

Source de vérité : `.env.example` + `process.env.*` dans le code. 23 variables au total.
Colonne **Où** : `Vercel` = à définir dans le projet Vercel (Production, et Preview si besoin) ; `Local` = `.env.local` uniquement.

### 3.1 Obligatoires

| Variable | Public ? | Où | Obtenir | Valeur |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Vercel + Local | Supabase → Settings → API → Project URL | `___` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Vercel + Local | Supabase → Settings → API → anon key | `___` |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Vercel + Local | Supabase → Settings → API → service_role | `___` |
| `NEXT_PUBLIC_APP_URL` | public | Vercel + Local | URL finale du site, sans `/` final. **Sert aux liens d'activation des mails** : si absente, l'invitation de membres renvoie une erreur 500 | `___` |
| `RESEND_API_KEY` | **secret** | Vercel | resend.com → API Keys | `___` |
| `EMAIL_FROM` | non | Vercel | Format `FAME <no-reply@votre-domaine>`. Le domaine **doit être vérifié dans Resend**. Défaut codé en dur : `noreply@fame-lab.eu` (probablement inutilisable sur un autre compte) | `___` |
| `OPENAI_API_KEY` | **secret** | Vercel + Local | platform.openai.com → API keys. Sert à l'assistant Astra, aux embeddings, aux traductions et à la génération assistée | `___` |
| `ASSISTANT_IP_SALT` | **secret** | Vercel | Chaîne aléatoire longue (ex. `openssl rand -hex 32`). Poivre du hash des IP. **Si changé, les anciens hash de rate-limit ne correspondent plus** (sans gravité) | `___` |
| `CRON_SECRET` | **secret** | Vercel | Chaîne aléatoire (`openssl rand -hex 32`). Vercel l'envoie en `Authorization: Bearer` au cron `/api/research/fetch`. **Sans elle, le cron répond 401** | `___` |
| `OPENALEX_MAILTO` | non | Vercel | Email de contact réel exigé par OpenAlex (« polite pool ») | `___` |

### 3.2 Optionnelles / avec valeur par défaut

| Variable | Défaut / exemple | Où | Rôle |
|---|---|---|---|
| `REPORT_EMAIL` | *(vide)* | Vercel | Destinataire du bouton « Signaler un problème ». **Vide = signalements non envoyés** (warning en log) |
| `DROPBOX_ACCESS_TOKEN` | *(vide)* | Vercel | Token Dropbox (page Data). **Vide = page Data en mode dégradé (503)**. Voir 3.4 |
| `SEMANTIC_SCHOLAR_API_KEY` | *(vide)* | Vercel | Relève la limite de débit Semantic Scholar (1 req/s avec clé) |
| `ASSISTANT_EMBED_MODEL` | `text-embedding-3-large` | Vercel | **Ne pas changer sans réindexer** (`npm run index:rag`) : les vecteurs sont en 1536 dimensions |
| `ASSISTANT_MODEL` | `gpt-4o-mini` | Vercel | Modèle de chat |
| `ASSISTANT_SIMILARITY_THRESHOLD` | `0.35` | Vercel | Seuil de similarité RAG |
| `ASSISTANT_MONTHLY_BUDGET_USD` | `50` | Vercel | Plafond de dépense mensuel de l'assistant (coupe au-delà) |
| `ASSISTANT_DISABLED` | *(vide)* | Vercel | Mettre `1` = kill-switch global de l'assistant |
| `RESEARCH_FAME_THRESHOLD` | `50` | Vercel | Score (0-100) à partir duquel un papier est publié |
| `RESEARCH_SIM_LO` / `RESEARCH_SIM_HI` | `0.32` / `0.72` | Vercel | Bornes de similarité cosinus mappées à 0 % / 100 % |
| `SEED_ADMIN_EMAIL` | — | **Local** | Seulement pour `npm run seed:admin` |
| `SEED_ADMIN_PASSWORD` | — | **Local** | Idem. Ne jamais mettre sur Vercel |

`NODE_ENV` est géré par Next/Vercel. Les scripts `seed:admin` et `index:rag` lisent **`.env.local`** (pas les variables Vercel).

### 3.3 Règle de sécurité

Seules `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `NEXT_PUBLIC_APP_URL` peuvent être préfixées `NEXT_PUBLIC_`. Tout le reste est **server-only**.

### 3.4 Dropbox

- [ ] Créer une app Dropbox (dropbox.com/developers) avec les droits de lecture sur le dossier d'équipe, générer le token → `DROPBOX_ACCESS_TOKEN`.
- [ ] Attention : un token « access token » généré dans la console **expire** (courte durée). Si la page Data repasse en 503 quelques heures après le déploiement, il faut un token durable (refresh token / flow OAuth) — le code actuel attend un simple access token (`src/lib/dropbox/client.ts`).

---

## 4. Vercel

- [ ] Créer le projet depuis le nouveau repo GitHub (framework détecté : **Next.js**, Node ≥ 20, build `next build`).
  Ancien projet : `site-fame` (plan Hobby). Nouveau : `___`, équipe/compte : `___`.
- [ ] Saisir toutes les variables de la section 3 (Production ; cocher aussi Preview si des previews doivent fonctionner).
- [ ] `vercel.json` ne contient qu'un **cron** : `GET /api/research/fetch` tous les **lundis à 06:00 UTC** (`0 6 * * 1`). Il est repris automatiquement ; il exige `CRON_SECRET`.
- [ ] Durées de fonction : `/api/research/fetch` utilise `maxDuration = 300` (plafond Hobby avec Fluid Compute), `/api/assistant/chat` `maxDuration = 60`. Rien à régler si le plan est Hobby ou supérieur.
- [ ] Re-lier la copie locale : `vercel link` (régénère `.vercel/project.json`, ignoré par git).
- [ ] Les en-têtes de sécurité (HSTS, CSP report-only, etc.) sont dans `next.config.ts` — rien à configurer côté dashboard.
- [ ] Domaine custom : voir section 5.

---

## 5. Domaine, DNS, e-mail

- [ ] Domaine du site : `___`. L'ajouter au projet Vercel, configurer les enregistrements DNS demandés, puis mettre à jour `NEXT_PUBLIC_APP_URL`.
- [ ] **Resend** : créer un compte, ajouter le domaine d'envoi `___`, publier les enregistrements **SPF / DKIM** (et DMARC conseillé) chez le registrar, attendre « Verified ». Sans cela, **toutes les invitations échouent** (l'échec est silencieux côté UI : le lien d'activation reste dans `invitations`).
- [ ] Mettre à jour `EMAIL_FROM` en conséquence.
- [ ] `robots.txt` et `sitemap.xml` dérivent de `NEXT_PUBLIC_APP_URL` : vérifier qu'ils pointent vers la nouvelle URL.

---

## 6. Éléments codés en dur à revoir dans le code

Ce ne sont pas des secrets mais des valeurs liées à l'ancienne organisation. À modifier si la personne de contact change :

| Fichier | Contenu | Pourquoi |
|---|---|---|
| `src/app/[locale]/privacy/page.tsx` (`CONTACT_EMAIL`) | Email de contact RGPD en clair | Mettre l'adresse du nouveau responsable |
| `src/lib/resend/send-*.ts` (3 fichiers) | Fallback `FAME <noreply@fame-lab.eu>` | Défini aussi via `EMAIL_FROM` ; le fallback ne doit pas rester sur un domaine non possédé |
| `src/lib/constants.ts` | Labs `paris` / `montreal` | Inchangé sauf changement de périmètre |
| `next.config.ts` | CSP `https://*.supabase.co`, `cdn.jsdelivr.net` (topojson du globe) | À adapter si domaine Supabase custom |

---

## 7. Séquence de mise en route (check-list finale)

1. [ ] Nouveau repo GitHub poussé.
2. [ ] Projet Supabase créé, migrations `001`→`017` appliquées, bucket `subject-files` présent.
3. [ ] Données + comptes Auth importés **ou** base vide + `npm run seed:admin`.
4. [ ] Fichiers Storage copiés (si données migrées).
5. [ ] Comptes tiers prêts : Resend (domaine vérifié), OpenAI (budget/limite), Dropbox, (Semantic Scholar optionnel).
6. [ ] Projet Vercel créé, **toutes** les variables de la section 3 saisies, premier déploiement vert.
7. [ ] Domaine branché, `NEXT_PUBLIC_APP_URL` à jour, **redéployer** (les variables `NEXT_PUBLIC_*` sont figées au build).
8. [ ] `npm run index:rag` (avec `.env.local` pointant la nouvelle prod) si `rag_chunks` n'a pas été migré.
9. [ ] Test de bout en bout :
   - Login admin → `/en/auth/login`.
   - Inviter un membre → l'e-mail arrive, le lien d'activation fonctionne.
   - Créer une fiche, uploader un fichier (PDF), le télécharger.
   - Poser une question à l'assistant Astra.
   - Page Data (Dropbox) charge ou affiche le mode dégradé attendu.
   - « Signaler un problème » → mail reçu sur `REPORT_EMAIL`.
   - Lancer le cron à la main :
     `curl -H "Authorization: Bearer $CRON_SECRET" https://<domaine>/api/research/fetch`
10. [ ] **Révoquer / faire tourner** les anciennes clés une fois la bascule faite (OpenAI, Resend, Dropbox, service-role Supabase de l'ancien projet) et supprimer l'ancien projet Vercel.

---

## 8. Pièges connus

- **`createServiceClient()` ne doit jamais porter les cookies de la requête** (sinon la RLS s'applique aux utilisateurs connectés). Ne pas « simplifier » `src/lib/supabase/server.ts`.
- **Tailwind v4** : ne jamais retirer la ligne `@config` de `src/app/globals.css`, sinon les classes `fame-*` disparaissent.
- **Embeddings** : modèle et dimension (1536) sont liés au schéma ; changer l'un impose de réindexer.
- **`NEXT_PUBLIC_*`** : modifier une de ces variables sur Vercel exige un **nouveau build**.
- **Crons Vercel** : n'existent qu'en production, et seulement avec `CRON_SECRET` défini.
- **Quotas externes du hub de veille** : arXiv 1 requête / 3 s, Semantic Scholar 1 req/s avec clé — déjà gérés par le code, ne pas augmenter la concurrence.
