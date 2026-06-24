# Audit D7 — Configuration & Préparation au Déploiement

**Date** : 2026-06-24  
**Branche** : `feat/p4-pre-prod`  
**Cible** : Vercel + Supabase (production)  
**Périmètre** : lecture seule — aucun fichier source modifié

---

## 1. Variables d'environnement

### 1.1 Inventaire exhaustif des `process.env.*`

| Variable | Scope | Fichier(s) | Gestion d'absence |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **public** (client + server) | `src/lib/supabase/client.ts:5`, `server.ts:8,32`, `middleware.ts:41`, `seed-admin.ts:18,28` | `!` (assert TypeScript) — crash runtime si absente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **public** (client + server) | `src/lib/supabase/client.ts:6`, `server.ts:9`, `middleware.ts:42` | `!` (assert TypeScript) — crash runtime si absente |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | `src/lib/supabase/server.ts:33`, `seed-admin.ts:22,29` | `!` (assert TypeScript) — crash runtime si absente |
| `NEXT_PUBLIC_APP_URL` | **public** (server-side uniquement en pratique) | `src/app/api/members/invite/route.ts:34` | `?? ''` — silencieux, URL d'activation brisée (voir finding #3) |
| `DROPBOX_ACCESS_TOKEN` | **server-only** | `src/lib/dropbox/client.ts:7-8` | `throw new Error(...)` — 503 dégradé côté `/api/dropbox/tree` |
| `RESEND_API_KEY` | **server-only** | `src/lib/resend/send-invitation.ts:12`, `send-proposal-result.ts:13` | `console.warn` + skip (dégradé gracieux) |
| `EMAIL_FROM` | **server-only** | `src/lib/resend/send-invitation.ts:3`, `send-proposal-result.ts:3` | `?? 'FAME <noreply@fame-lab.eu>'` — fallback raisonnable |
| `SEED_ADMIN_PASSWORD` | **server-only** (script hors app) | `src/scripts/seed-admin.ts:11,13` | `process.exit(1)` avec message clair |

**Aucune variable sensible n'utilise le préfixe `NEXT_PUBLIC_`.** Les clés server-only (`SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY`) sont uniquement référencées dans des fichiers `src/lib/` ou `src/app/api/`, jamais dans des composants `"use client"`.

### 1.2 Findings

---

**[🟠] NEXT_PUBLIC_APP_URL manquante → URLs d'activation brisées en email**

- **Fichier :** `src/app/api/members/invite/route.ts:34-35`
- **Impact :** Si `NEXT_PUBLIC_APP_URL` n'est pas défini en production, `base` vaut `''` et l'URL envoyée par email devient `/en/auth/activate/{token}` — un chemin relatif qui ne fonctionne pas dans un email HTML. Le membre invité reçoit un lien inutilisable ; l'invitation est créée en base mais non actionnable.
- **Reproduction :** Déployer sans `NEXT_PUBLIC_APP_URL` dans les variables Vercel, puis créer un membre via `/admin` → l'email d'invitation contient un lien relatif.
- **Fix suggéré :** Remplacer le fallback silencieux par un guard explicite :
  ```ts
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base) {
    console.error('NEXT_PUBLIC_APP_URL is not set — invitation email will have a broken URL')
  }
  const activationUrl = `${base ?? ''}/en/auth/activate/${token}`
  ```
  Ou mieux, lever une erreur 500 avec un message clair pour forcer la configuration avant d'aller en prod.

---

**[🟡] Pas de fichier `.env.example`**

- **Fichier :** racine du projet (absent)
- **Impact :** Aucun développeur rejoignant le projet ne sait quelles variables configurer sans lire le code source. Risque d'oubli en production.
- **Reproduction :** `ls .env.example` → fichier absent.
- **Fix suggéré :** Créer `.env.example` avec les 7 variables listées ci-dessus, toutes commentées, sans valeurs réelles.

---

**[⚪] `.env.local` correctement gitignoré, jamais commité**

- **Fichier :** `.gitignore:34` — pattern `.env*` (couvre `.env.local`, `.env.production`, etc.)
- `git log --all --full-history -- .env.local` → aucun commit.
- Aucun secret détecté dans l'historique git.

---

**[🟡] Email admin hardcodé dans `seed-admin.ts`**

- **Fichier :** `src/scripts/seed-admin.ts:10`
- **Impact :** `ADMIN_EMAIL = 'luca.desjardin@dauphine.eu'` est câblé en dur. Si l'admin change ou si le script est réutilisé pour un autre lab, il faut modifier le code source. Pas un secret exposé (c'est un email institutionnel), mais manque de flexibilité et de réutilisabilité.
- **Fix suggéré :** Lire depuis `process.env.SEED_ADMIN_EMAIL` avec guard `process.exit(1)` si absent.

---

## 2. Dépendances npm

Lecture de `docs/audit-raw/npm-audit.json`.

### 2.1 Vulnérabilités détectées

**[🟡] PostCSS XSS via `</style>` non échappé — moderate (CVE via GHSA-qx2v-qp2m-jg93)**

- **Package affecté :** `node_modules/next/node_modules/postcss@8.4.31` (dépendance interne de `next@16.2.9`)
- **Packages déclarés vulnérables :** `postcss`, `next`, `next-intl`
- **CVSS :** 6.1 (AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N)
- **CWE :** CWE-79 (XSS)
- **Plage vulnérable :** `postcss < 8.5.10`
- **Correctif :** `next@9.3.3` selon npm audit — mais c'est une downgrade majeure (16 → 9) **non applicable**. Le fix réel sera dans une version future de Next.js 16 (canary fix confirmé sur la plage `9.3.4-canary.0 – 16.3.0-canary.5`).
- **Impact réel :** Le PostCSS vulnérable est utilisé lors du **build uniquement**, pas en runtime. L'XSS ne peut se produire que si un attaquant contrôle du CSS source traité par Next.js — vecteur essentiellement absent dans ce projet (pas de CSS utilisateur dynamique).
- **Fix suggéré :** Surveiller les sorties de `next@16.x` et mettre à jour dès qu'un patch est disponible. En attendant, aucun mitigant d'urgence requis. La top-level `postcss@8.5.15` (pour Tailwind) est à jour et non vulnérable.

### 2.2 Résumé

| Sévérité | Nombre |
|---|---|
| Critical | 0 |
| High | 0 |
| Moderate | 3 (postcss + ses 2 dependants `next`, `next-intl`) |
| Low | 0 |

### 2.3 Versions épinglées / retard majeur

- **`react` / `react-dom` : `19.2.4`** — versé exact (non caret) dans `package.json`. Risque : pas de patch automatique si une correction de sécurité sort en `19.x.x+1`.
- **`next` : `16.2.9`** — épinglé exact. Même risque mais cohérent avec `eslint-config-next`.
- **`@types/node` : `^20`** — Node 20 LTS, compatible avec Vercel. Pas de retard critique.
- Pas de dépendances en retard majeur notable par rapport à leur semver déclaré.

---

## 3. `next.config.ts`

```ts
// src/next.config.ts (intégralité)
const nextConfig: NextConfig = {}
export default withNextIntl(nextConfig)
```

### 3.1 Findings

**[🟡] Absence totale de headers de sécurité HTTP**

- **Fichier :** `next.config.ts:6` — `nextConfig` est vide
- **Impact :** Les réponses HTTP de l'application n'incluent aucun des headers de sécurité recommandés :
  - Pas de `Content-Security-Policy` → exposition XSS/injection
  - Pas de `X-Frame-Options: DENY` / `frame-ancestors 'none'` → clickjacking possible
  - Pas de `X-Content-Type-Options: nosniff` → MIME-sniffing
  - Pas de `Referrer-Policy` → fuite de referrer
  - Pas de `Strict-Transport-Security` (HSTS) — Vercel ajoute HSTS par défaut sur les domaines `.vercel.app`, mais pas nécessairement sur un domaine custom sans configuration.
- **Reproduction :** `curl -I https://<prod-url>/` → aucun de ces headers dans la réponse.
- **Fix suggéré :** Ajouter un bloc `headers()` dans `next.config.ts` :
  ```ts
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  }
  ```
  La CSP est plus complexe à cause de Google Fonts et des scripts inline — à traiter séparément.

---

**[⚪] Pas d'options risquées activées**

- `ignoreBuildErrors` : absent → les erreurs TypeScript cassent le build (comportement correct).
- `eslint.ignoreDuringBuilds` : absent → ESLint s'exécute au build.
- `images.unoptimized` : absent → l'optimisation Vercel Image est active.
- `images.domains` : absent → seuls les chemins locaux sont autorisés par défaut (correct pour ce projet qui n'utilise pas d'images externes via `<Image>`).

---

## 4. `tsconfig.json` / `eslint.config.mjs`

### 4.1 TypeScript

**[⚪] Configuration stricte correcte**

- `"strict": true` activé → inclut `strictNullChecks`, `noImplicitAny`, etc.
- `"noEmit": true` → compilation de vérification uniquement.
- `"skipLibCheck": true` — standard Next.js, acceptable.
- `"target": "ES2017"` — compatible avec Vercel (Node 20).
- Aucune règle d'assouplissement (`noImplicitAny: false`, `strictNullChecks: false`) détectée.

### 4.2 ESLint

**[⚪] Configuration minimale mais correcte**

- `eslint.config.mjs` importe `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.
- Aucune règle critique (`@typescript-eslint/no-explicit-any`, `no-unused-vars`) n'est explicitement désactivée.
- Pas de `rules: { 'no-console': 'off' }` général — les `console.warn/error` présents dans le code sont intentionnels (dégradé gracieux).

---

## 5. Middleware (`src/middleware.ts`)

### 5.1 Findings

**[🟡] Protection admin au niveau page uniquement — pas au niveau middleware**

- **Fichier :** `src/middleware.ts:9-10`
- **Impact :** Le middleware protège `/data` et `/prompts` (connexion requise) et `/admin` (connexion requise), mais **ne vérifie pas `is_admin`** pour les routes `/admin/*`. La vérification admin réelle se fait dans `src/app/[locale]/admin/layout.tsx` et `proposals/page.tsx` via `requireAdmin()`. Le middleware lui-même le documente (`// Admin-role enforcement MUST happen in each /admin page's RSC via requireAdmin()`).
  - Vérifié : `src/app/[locale]/admin/layout.tsx` N'appelle PAS `requireAdmin()` (il se contente d'afficher la `TopBar`). La vérification est dans `src/app/[locale]/admin/proposals/page.tsx:11` via `requireAdmin()`.
  - Risque : si une nouvelle page `/admin/xxx` est ajoutée sans `requireAdmin()`, elle sera accessible à tout membre connecté.
- **Reproduction :** Connexion en tant que membre non-admin → accès à `/fr/admin/` tenté → redirigé vers login si non connecté, mais si connecté, la page layout s'affiche. Le contenu admin réel (`proposals/page.tsx`) bloque bien.
- **Fix suggéré :** Déplacer `requireAdmin()` dans `src/app/[locale]/admin/layout.tsx` pour protéger toutes les sous-pages admin par défaut, réduisant le risque d'oubli lors d'ajouts futurs.

---

**[⚪] Matcher correct**

- `matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']` — exclut `/api/`, assets statiques, et fichiers avec extension. Les routes API ne sont pas touchées par l'intl-middleware (double protection : guard dans le matcher + short-circuit ligne 19).
- Le court-circuit `if (pathname.startsWith('/api/')) return NextResponse.next()` à la ligne 19 est redondant avec le matcher mais sain (belt-and-suspenders).
- Les routes `/api/` non protégées par le middleware sont protégées individuellement (`requireMember()` / `requireAdmin()` dans chaque route handler) — vérifié sur les routes Dropbox, membres, prompts, publications, tâches.

---

**[⚪] Absence de rate limiting sur `/api/auth/sign-in`**

- **Fichier :** `src/app/api/auth/sign-in/route.ts`
- Pas de protection brute-force (rate limiting) sur le endpoint de connexion. La protection de Supabase Auth (lockout après N tentatives) peut s'appliquer selon la configuration du projet Supabase, mais rien n'est géré côté Next.js.
- Sévérité : ⚪ (hors périmètre strict de cet audit config/déploiement, et Supabase Auth offre une protection native configurable).

---

## 6. Build & scripts

### 6.1 Findings

**[⚪] Scripts cohérents et sûrs**

- `package.json` scripts : `dev`, `build`, `start`, `lint`, `seed:admin` — aucun script destructeur.
- `seed:admin` : exécuté manuellement via `npx tsx` — guards présents pour `SEED_ADMIN_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (tous avec `process.exit(1)` si absents). Script idempotent (vérifie si le membre existe avant insertion).
- **Artefacts gitignorés :** `.next/`, `node_modules/`, `/build`, `/out` — tous présents dans `.gitignore`.
- **Lock file :** `package-lock.json` présent → builds Vercel reproductibles.

**[🟡] Email admin câblé en dur dans `seed-admin.ts` (rappel — voir §1.2)**

---

## 7. Migrations Supabase

### 7.1 Findings

**[⚪] Ordre et rejouabilité corrects**

Les trois migrations sont ordonnées par préfixe numérique et leurs dépendances sont respectées :

| Migration | Contenu | Dépendance |
|---|---|---|
| `001_initial_schema.sql` | Création de toutes les tables, indexes, trigger, RLS | Aucune |
| `002_subject_difficulte_and_indexes.sql` | `ALTER TABLE subjects ADD COLUMN difficulte`, 2 indexes différés | `001` (table `subjects`, `task_subjects`, `dropbox_links` doivent exister) |
| `003_proposal_subject_link.sql` | `ALTER TABLE proposals ADD COLUMN subject_id` | `001` (table `proposals`, `subjects` doivent exister) |

- Toutes les migrations utilisent `IF NOT EXISTS` / `IF NOT EXISTS` sur les clauses `ADD COLUMN` et `CREATE INDEX` → idempotentes.
- Pas de migration destructrice (DROP TABLE, DELETE en masse).
- La migration `001` active RLS sur toutes les tables **sans définir de policies permissives** — intention documentée (service-role bypass en prod). Correct.

**[🟡] Pas de CLI Supabase configuré**

- **Fichier :** absence de `supabase/config.toml` et de `supabase` dans `devDependencies`
- **Impact :** Les migrations sont appliquées manuellement via le SQL editor Supabase ou via `supabase db push`. Il n'y a pas de workflow de migration automatique, ce qui augmente le risque d'oubli en production.
- **Reproduction :** `ls supabase/config.toml` → absent.
- **Fix suggéré :** Considérer l'ajout de `supabase` CLI (`devDependencies`) et d'un `supabase/config.toml` pour permettre `supabase db push` dans le pipeline CI/CD. Non bloquant pour le déploiement initial.

---

## Synthèse

### Tableau des variables d'environnement

| Variable | Scope | Gestion d'absence | Statut prod |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (client+server) | `!` assert → crash TypeScript | **Obligatoire** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (client+server) | `!` assert → crash TypeScript | **Obligatoire** |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | `!` assert → crash TypeScript | **Obligatoire** |
| `NEXT_PUBLIC_APP_URL` | Public (serveur uniquement) | `?? ''` → URL email brisée | **Obligatoire** (🟠 non guardé) |
| `DROPBOX_ACCESS_TOKEN` | Server-only | `throw Error` → 503 dégradé | Optionnel (page Data → 503) |
| `RESEND_API_KEY` | Server-only | `console.warn` + skip | Optionnel (emails skippés) |
| `EMAIL_FROM` | Server-only | `?? 'FAME <noreply@fame-lab.eu>'` | Optionnel (fallback OK) |
| `SEED_ADMIN_PASSWORD` | Server-only (script) | `process.exit(1)` | Script uniquement |

### Tableau des vulnérabilités npm

| Sévérité | Package | Chemin | Vuln | Fix dispo |
|---|---|---|---|---|
| Moderate | `postcss@8.4.31` | `node_modules/next/node_modules/postcss` | GHSA-qx2v-qp2m-jg93 (XSS, CVSS 6.1) | Nécessite `next@9.3.3` (downgrade majeure — non applicable) |
| Moderate | `next@16.2.9` | `node_modules/next` | Via postcss (build-time uniquement) | Attendre patch Next.js 16.x |
| Moderate | `next-intl@^4.13.0` | `node_modules/next-intl` | Via next (transitif) | Attendre patch |

---

## Compte par sévérité

| Sévérité | Nombre |
|---|---|
| 🔴 (critique) | 0 |
| 🟠 (high) | 1 |
| 🟡 (medium) | 5 |
| ⚪ (info) | 6 |
