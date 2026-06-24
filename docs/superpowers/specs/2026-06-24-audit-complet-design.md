# Design — Audit complet FAME Website

_Date : 2026-06-24 · Branche : `feat/p4-pre-prod` · État projet : pré-prod (PR #4), 100 fichiers TS/TSX, 25 routes API, **aucun test, aucune CI**._

## Objectif

Trouver **toutes les failles et erreurs de code** du projet avant déploiement, à travers un audit **exhaustif** couvrant chaque aspect (sécurité, correction, qualité, perf/a11y/UX, config). Le résultat est un **rapport priorisé unique** ; l'audit ne modifie aucun code.

## Contraintes & principes

- **Lecture seule.** Aucun agent ne modifie le code, ne refactore, ne commite de code. Seul le rapport d'audit est écrit.
- **Exécution par sous-agents parallèles**, un par domaine, lancés simultanément. Chaque agent renvoie un rapport de findings classés par sévérité.
- **Consolidation par l'orchestrateur** (Opus) en un rapport maître unique.
- **Répartition modèles :** D1 (Sécurité) en **Opus 4.8** (criticité) ; D2–D7 en **Sonnet 4.6** (volume de lecture).
- **Un seul plan** organisé en 7 work-streams ; les 7 domaines constituent la décomposition.

## Découpage en 7 domaines

| # | Domaine | Cœur de l'audit |
|---|---|---|
| D1 | **Sécurité & Auth** (Opus) | Fuite clés service-role/Dropbox dans le bundle client ; usage correct de `createServiceClient()` (piège RLS : jamais avec les cookies de requête) ; policies RLS des migrations ; couverture `requireMember`/`requireAdmin` route par route ; **isolation entre labos `paris`/`montreal`** (pas de fuite cross-lab) ; validation des entrées ; endpoints publics vs protégés ; CSRF/headers ; tokens d'activation |
| D2 | **API & données** (Sonnet) | Les 25 routes : `await params` (Next 16) ; gestion d'erreurs + codes HTTP cohérents ; PGRST116→404 ; idempotence (convert) ; invariant `members.id === auth.users.id` ; conditions de course (claim/reorder) ; cohérence schéma SQL ↔ migrations ↔ types TS |
| D3 | **Frontend / React** (Sonnet) | Frontières client/server components ; hooks & cleanup d'effets (globe D3, listeners) ; risques d'hydratation ; props mortes ; `key` manquantes ; patterns Next 16 (`searchParams` Promise) |
| D4 | **Qualité & dette** (Sonnet) | TS strict (`any`, casts non sûrs) ; code mort ; duplications ; respect CLAUDE.md/AGENTS.md ; structure des fichiers ; config ESLint (laxismes) |
| D5 | **i18n** (Sonnet) | Parité `messages/en.json` ↔ `messages/fr.json` ; chaînes hardcodées dans l'UI ; clés manquantes/mortes ; namespaces |
| D6 | **Perf · a11y · UX · SEO** (Sonnet) | Accessibilité (roles, aria, contraste, focus) ; meta/SEO ; responsive (rappel : desktop-first v1) ; fidélité maquettes via MCP Claude Design ; perf de rendu ; usage `next/image` |
| D7 | **Config & deploy-readiness** (Sonnet) | Gestion des env vars (server-only vs `NEXT_PUBLIC_`) ; middleware ; `next.config` ; `npm audit` (vulnérabilités deps) ; fraîcheur des dépendances ; `.env*` non commités ; build prod |

## Rubrique de sévérité (commune à tous les agents)

- 🔴 **Critical** — faille de sécurité, perte de données, ou casse en production.
- 🟠 **High** — bug fonctionnel, contrôle d'accès défaillant, donnée incorrecte.
- 🟡 **Medium** — dette technique réelle, edge case non géré, incohérence.
- ⚪ **Low** — cosmétique, nit, amélioration mineure.

**Format de finding imposé :**
```
[sévérité] Titre court
- Fichier : chemin:ligne
- Impact : conséquence concrète
- Reproduction : comment l'observer / le déclencher
- Fix suggéré : piste de correction (non appliquée)
```

## Livrable

`docs/AUDIT_2026-06-24.md` :
1. **Synthèse exécutive** — compteur par sévérité, top risques bloquant le déploiement, verdict go/no-go.
2. **Findings par domaine** (D1→D7), chacun classé par sévérité.
3. **Annexe outillage recommandé** (non appliqué) : passage `tsc` strict, `npm audit`, ajout d'un harnais de test minimal, CI. Recommandations seulement.

## Hors périmètre

- Aucun fix, refactor, ni commit de code.
- Pas de mise en place effective de tests/CI (seulement recommandée en annexe).
- Pas de déploiement (Task 20 reste un plan séparé).
