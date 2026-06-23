@AGENTS.md

# FAME Website

## Session Start — Read This First

1. Read `docs/STATUS.md` — état actuel, tâches complétées, décisions prises
2. Identifier la prochaine tâche dans `docs/superpowers/plans/`
3. Avant tout composant UI : consulter les maquettes **via le MCP Claude Design** (voir Design Mockups ci-dessous — **nécessite une session Opus 4.8**)

## Project Overview

Site web interne + vitrine publique pour deux labos de recherche indépendants : **Paris** et **Montréal**.

- Visiteurs : lecture publique, commentaires, proposition de sujets
- Membres : contribution active (tâches, fiches, publications)
- Admin : gestion des membres, validation des propositions, configuration Dropbox

## Model Assignments

| Tâches | Modèle | Raison |
|---|---|---|
| Tasks 1–4 (types, schema SQL, seed, auth) | **Opus 4.8** (`claude-opus-4-8`) | Architecture critique — erreurs coûteuses à corriger |
| Tasks 5+ (UI, pages, API routes) | **Sonnet 4.6** (`claude-sonnet-4-6`) | Volume élevé, complexité moindre |

Toujours spécifier `model: "claude-opus-4-8"` ou `"claude-sonnet-4-6"` lors du spawn de sous-agents.

> ⚠️ **Accès aux maquettes = Opus obligatoire.** La connexion à claude.ai/design (MCP Claude Design, outil `DesignSync`) n'est disponible que dans la session principale tournant sous **Opus 4.8** ; les sous-agents Sonnet ne peuvent pas s'y connecter. Pour les tâches UI (Tasks 5+) confiées à Sonnet, l'orchestrateur Opus lit la maquette via le MCP puis **injecte le markup pertinent dans le prompt** du sous-agent Sonnet.

## Design Mockups

9 maquettes vivent **uniquement dans le projet Claude Design** « Site FAME projet » (`5bd688a8-2928-4c09-8d94-63f35b89ec74`) et se lisent **via le MCP** — ne **jamais** les copier dans le repo. Le dossier `docs/mockups/` n'existe pas, c'est volontaire.

- **Accès** : MCP Claude Design, outil `DesignSync` méthode `get_file` (`projectId` + `path`) — **nécessite Opus 4.8**. Les sessions/sous-agents Sonnet ne peuvent pas se connecter à claude.ai/design.
- **Règle** : lire la maquette correspondante **avant d'écrire tout composant UI ou page**.
- **Contient** : tokens couleur, typographie, espacements, données fictives de seed, comportements d'interaction.
- **Format** : fichiers `.dc.html` (Design Code : balises `<x-dc>`, `sc-for`, props éditeur) — maquette source, pas du HTML statique autonome.
- **Workflow sous-agents** : l'orchestrateur Opus lit la maquette via le MCP, puis colle le markup pertinent dans le prompt du sous-agent Sonnet (qui n'a pas accès au MCP).

| Page | Fichier MCP (`path`) |
|---|---|
| Accueil / globe | `FAME Accueil.dc.html` |
| Lab (grille de fiches) | `FAME Laboratoire.dc.html` |
| Paper (fiche détaillée) | `FAME Paper.dc.html` |
| Tasks (kanban) | `FAME Tasks.dc.html` |
| Propose (formulaire) | `FAME Proposer.dc.html` |
| Publications | `FAME Publications.dc.html` |
| Team (trombinoscope) | `FAME Trombinoscope.dc.html` |
| Data (Dropbox) | `FAME Données.dc.html` |
| Prompts | `FAME Prompts.dc.html` |

> Si le MCP Claude Design n'est pas connecté : lancer `/design-login` (ajoute les scopes `user:design:read/write`). La connexion exige une session **Opus**.

## Key Paths

| Quoi | Où |
|---|---|
| Specs complètes | `specs_projet_FAME.md` |
| Plan Part 1 (Foundation) | `docs/superpowers/plans/2026-06-22-fame-website-p1-foundation.md` |
| Plan Part 2 (Features) | `docs/superpowers/plans/2026-06-22-fame-website-p2-features.md` |
| Plan Part 3 (Secondary) | `docs/superpowers/plans/2026-06-22-fame-website-p3-secondary.md` |
| État d'avancement | `docs/STATUS.md` |
| Messages i18n | `messages/en.json`, `messages/fr.json` |
| Variables d'env | `.env.local` (non commité) |

## Dev Commands

```bash
npm run dev            # dev server → http://localhost:3000
npm run build          # production build
npx tsc --noEmit       # vérification TypeScript
npm run lint           # ESLint
npm run seed:admin     # créer le compte admin initial (nécessite SEED_ADMIN_PASSWORD dans .env.local)
```
