# Sonde HTTP — GET anonymes sur build de prod local (`next start -p 3100`), 2026-07-02

Serveur : `next build` (commit `3d4142a`) + `next start`. Requêtes GET anonymes uniquement, aucun POST. BDD de dev réelle.

## Pages publiques (statut observé)

| URL | Code | Attendu | Verdict |
|---|---|---|---|
| `/` | 307 | redirect → `/en` | ✅ |
| `/en`, `/fr` | 200 | 200 | ✅ |
| `/en/paris`, `/en/montreal` | 200 | 200 | ✅ |
| `/en/paris/tasks`, `/publications`, `/team`, `/propose` | 200 | 200 | ✅ |
| `/en/graph`, `/en/assistant`, `/en/privacy` | 200 | 200 | ✅ |
| `/robots.txt`, `/sitemap.xml` | 200 | 200 | ✅ |
| `/en/auth/login` | 200 | 200 | ✅ |
| `/en/lyon` (lab invalide) | 404 | 404 | ✅ |

## Pages réservées membres/admin

| URL | Code | Redirect | Verdict |
|---|---|---|---|
| `/en/paris/data` | **200** | — | ⚠️ voir note |
| `/en/paris/prompts` | **200** | — | ⚠️ voir note |
| `/en/admin/proposals` | 307 | → `/en/auth/login` | ✅ |
| `/en/admin/assistant` | 307 | → `/en/auth/login` | ✅ |

**Note `/data` et `/prompts`** : renvoient 200 en tant que **coquille de page** (le middleware ne les redirige pas). À vérifier en consolidation : le contenu réservé (arbre Dropbox, prompts) est-il chargé côté client via une API `requireMember` (donc vide/erreur pour l'anonyme) ou fuit-il dans le HTML ? Les pages `/admin/*` sont, elles, correctement gardées côté serveur (307 → login). → **à contre-lire** (D1 a jugé le middleware OK ; lever l'ambiguïté sur data/prompts).

## Headers de sécurité (sur `/en`)

Tous présents : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. **CSP absente** (différée assumée, cf. `next.config.ts`).

## Gates confidentiel

| Cible | Code | Attendu | Verdict |
|---|---|---|---|
| Page paper sujet confidentiel `b9cfac5d` | **200** | 404 | ⚠️ **soft-404** (voir ci-dessous) |
| `GET /api/subjects/b9cfac5d` (confi) | 404 | 404 | ✅ |
| `GET …/files/ec9a89e9` (doc confi sur sujet confi) | 404 | 404 | ✅ |
| Page paper sujet public `fb313865` (contrôle) | 200 | 200 | ✅ |
| `GET …/files/96b7ed98` (doc public, contrôle) | 302 → URL signée Storage | download | ✅ |
| `GET /api/subjects?lab=paris` anonyme | 200, **11 sujets, aucun confidentiel** | — | ✅ |

**Soft-404 sur la page paper (constat vérifié, pas une fuite)** : `/en/paris/paper/<confidentiel>` renvoie **HTTP 200** alors que le code appelle `notFound()`. Vérifications : (a) un **id inexistant** renvoie lui aussi 200 → comportement générique, pas spécifique au confidentiel ; (b) le **titre réel** du sujet confidentiel (« Comprendre les features important… ») est **absent de la page (0 occurrence)** ; (c) le `<title>` est le fallback générique « Paris — Paris · FAME », pas de h1, la payload contient l'UI `notFound()`. → **Le contenu confidentiel ne fuit pas** ; le gate `notFound()` s'exécute bien. Le défaut est que Next.js sert ce `notFound()` avec un **statut 200 au lieu de 404** (soft-404 : impact SEO/correction — un moteur peut indexer ces URLs comme valides). Sévérité **Low**. À investiguer en consolidation : absence de `not-found.tsx` sur le segment, ou statut committé tôt par le streaming.

## API `/api/subjects` — champs exposés à l'anonyme

Champs sérialisés : `id, labo, titre, kicker, statut, context, method, results, keywords, auteurs, dimensions, ordre, created_at, updated_at, difficulte, is_transversal, confidentiel, question, accroche, periode, i18n, inherits`. Aucun champ secret (pas de `password_hash`, pas d'email). `confidentiel` est exposé mais seulement pour les sujets publics (les confidentiels sont exclus du tableau). Acceptable.

## Limites

- Combinaison « doc confidentiel sur sujet **public** » absente de la BDD de dev → gate purement par-fichier non sondable en HTTP (couvert par tests unitaires PR #49).
- Aucune sonde POST (règle lecture seule) → rate-limits, création, upload non testés dynamiquement (couverts par tests + D1/D2).
- Interactions visuelles (drag/zoom du graphe, rendu) hors périmètre (humain).
