# Design — Audit complet pré-production 2026-07-02

_Date : 2026-07-02 · Branche : `main` (saine — 431 tests verts, `tsc`/`lint`/`build` à 0) · 3ᵉ audit (précédents : 2026-06-24, 2026-06-28)._

## Objectif

S'assurer que le site ne posera **pas de problème en production**. Audit **complet** (tout le repo), **lecture seule**, produisant un rapport unique `docs/AUDIT_2026-07-02.md` avec verdict **go/no-go** pour la mise en ligne.

**Livrable = rapport seul.** La remédiation fera l'objet d'une demande séparée ; ce cycle n'applique aucun correctif.

## Contexte

- Deux audits ont déjà été soldés (vagues 0→4, PR #38). Leurs **différés assumés** sont documentés dans `docs/AUDIT_2026-06-28.md` (M2/M3 compteurs atomiques, CSP stricte, B3/M18 config, décisions produit M7/M10/M11/M15/M17/M19).
- Depuis le 28/06 : **~187 commits, 104 fichiers, +8 500 lignes** mergés (PRs #39–50 : upload fichiers, RAG des documents, relations/héritage/graphe, visibilité par document, i18n des tâches, admin logs, polish vitrine).
- Le **déploiement n'a pas démarré** (plan `2026-06-29-fame-deploiement.md`). Migrations `001`–`014` déclarées appliquées en BDD de dev ; env vars Vercel non posées.
- Plusieurs « vérif navigateur = humain » notées dans `docs/STATUS.md` n'ont jamais été faites (download 404 visiteur, gates confidentiel, graphe).

## Contraintes & principes

- **Lecture seule.** Aucun agent ne modifie le code ni la BDD, ne refactore, ne commite de code. Seuls le rapport et cette spec sont écrits.
- **Exécution par sous-agents parallèles**, un par domaine (découpage D1–D7 **identique à l'audit 2026-06-24**), lancés simultanément.
- **Consolidation par l'orchestrateur** avec **contre-lecture des 🔴/🟠** dans le code avant inscription au rapport (leçon du faux positif I1 de juin).
- **Répartition modèles :** D1 (Sécurité) en **Opus** ; D2–D7 en **Sonnet**.
- Chaque agent reçoit en contexte : la synthèse des audits précédents (différés assumés à ne pas re-signaler + zones à vérifier en régression), `docs/STATUS.md`, la liste des PRs mergées depuis le 28/06.

## Pondération prod (dans chaque domaine)

1. **Code mergé depuis le 28/06** (PRs #39–50) — jamais audité globalement.
2. **Deploy-readiness** — tout ce qui casserait à la mise en ligne (env vars, migrations, Vercel, seed admin, `index:rag`).
3. **Différés antérieurs** — revérifier qu'ils restent acceptables ou signaler s'ils sont devenus bloquants.

## Découpage en 7 domaines (identique à juin)

| # | Domaine | Cœur de l'audit |
|---|---|---|
| D1 | **Sécurité & Auth** (Opus) | Fuite de clés server-only dans le bundle client ; usage de `createServiceClient()` (jamais avec cookies) ; policies RLS des migrations `011`–`014` ; couverture `requireMember`/`requireAdmin` route par route (~35 routes) ; **chaîne `confidentiel` de bout en bout** : sujet OU document, download signé, tiers RAG (`match_rag_chunks`/`match_subject_files`), héritage/relations/graphe (zone du CRITICAL PR #48) ; validation des entrées (dont `fileId`, path traversal) ; tokens d'activation ; rate-limiting |
| D2 | **API & données** (Sonnet) | Toutes les routes : `await params` (Next 16) ; gestion d'erreurs + codes HTTP ; idempotence ; conditions de course (upload 3-temps, retier, relations anti-cycle) ; cohérence schéma SQL ↔ migrations ↔ types TS ; compensation upload ; purge des chunks RAG à la suppression |
| D3 | **Frontend / React** (Sonnet) | Frontières client/server ; hooks & cleanup (graphe d3-force, globe, listeners) ; hydratation ; `key` ; patterns Next 16 ; scroll interne `SubjectGrid` ; modales |
| D4 | **Qualité & dette** (Sonnet) | TS strict (`any`, casts) ; code mort ; duplications ; respect CLAUDE.md/AGENTS.md ; structure des fichiers |
| D5 | **i18n** (Sonnet) | Parité en/fr ; chaînes hardcodées ; clés mortes/manquantes ; nouveaux namespaces (adminLogs, graph, relations, files) ; i18n des tâches (migration `012`) |
| D6 | **Perf · a11y · UX · SEO** (Sonnet) | A11y (roles, aria, focus — dont graphe, cadenas, modales) ; meta/SEO ; perf de rendu (graphe, grille) ; `next/image` |
| D7 | **Config & deploy-readiness** (Sonnet) | Env vars (server-only vs `NEXT_PUBLIC_`, checklist Vercel complète) ; middleware ; `next.config` ; `npm audit` ; build prod ; scripts (`seed:admin`, `index:rag`) ; limites Vercel (taille payloads, durée fonctions, `after()`) |

## Volets dynamiques (orchestrateur, en parallèle des agents)

Tous **lecture seule** :

1. **Vérités locales** : `npm run build`, `npx tsc --noEmit`, `npm run lint`, suite de tests, `npm audit`.
2. **État réel BDD** (requêtes lecture seule sur la Supabase de dev, credentials `.env.local`) : migrations `001`–`014` réellement appliquées ; RLS active table par table ; bucket `subject-files` privé ; RPC présentes (`match_rag_chunks`, `match_subject_files`) ; état de l'index RAG (compte de chunks par `source_type`/tier).
3. **Sonde HTTP** : dev server local + requêtes **GET anonymes uniquement** (aucun POST) : gates visiteur (sujet confidentiel → 404, download doc confidentiel → 404, `data`/`prompts` → redirect), headers de sécurité (HSTS…), `robots.txt`/`sitemap.xml`, pages publiques → 200. Limite : si la BDD de dev ne contient aucune donnée confidentielle, le gate ne peut pas être testé en réel — noté tel quel dans le rapport (rien n'est créé). Les vérifs purement visuelles (drag/zoom du graphe, rendu) restent à l'humain.

**Gestion d'erreur** : BDD injoignable, `.env.local` incomplet ou dev server qui ne démarre pas → le volet concerné est marqué « non vérifié » dans le rapport. Jamais bloquant, jamais contourné en écriture.

## Rubrique de sévérité (commune)

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

`docs/AUDIT_2026-07-02.md` :
1. **Synthèse exécutive** — compteur par sévérité, top risques, **verdict go/no-go prod**.
2. **Findings par domaine** (D1→D7), classés par sévérité, contre-lus pour les 🔴/🟠.
3. **Résultats dynamiques** — état réel BDD, sonde HTTP, vérités locales.
4. **Checklist go-live actualisée** (env vars, migrations, seed, indexation, Resend, Vercel).
5. **Annexe — différés antérieurs** : statut de chaque différé des audits 06-24/06-28 (toujours OK / devenu bloquant).

## Hors périmètre

- Aucun fix, refactor, ni commit de code (rapport + spec seuls).
- Pas de déploiement effectif.
- Pas d'écriture en BDD ni de POST sur l'app.
- Vérifications visuelles/interactives (drag, zoom, rendu) — restent humaines.
