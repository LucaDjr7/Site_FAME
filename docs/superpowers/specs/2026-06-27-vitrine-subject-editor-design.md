# Design — Fiche Vitrine éditable + génération assistée par champ

> Date : 2026-06-27
> Branche : `feat/vitrine-subject-editor`
> Statut : design validé (brainstorming), en attente de relecture utilisateur avant plan d'implémentation

## Objectif

Refondre entièrement l'ajout (et l'édition) d'un sujet pour **simplifier au maximum le travail du membre** :

1. La **fiche vitrine** (maquette `Fiche Vitrine Finale.dc.html`, projet Claude Design `090c8494-34ff-4798-ba29-3414f6480b26`) devient le **format standard et universel** des cartes de la grille du Lab — elle remplace `SubjectCard`.
2. Cliquer « ajouter un sujet » ouvre cette vitrine **pleine taille, éditable inline** dans une modale overlay : on clique sur chaque élément pour le remplir directement.
3. Chaque élément propose une **aide à la rédaction** : un bouton **✨ Générer** (assistant Astra) qui pré-remplit le champ à partir des autres infos saisies, **et** un lien **« voir le prompt »** qui révèle le prompt-template à copier/adapter ailleurs.
4. Pour les membres, une **carte pointillée** en forme de vitrine apparaît **à la fin** de la grille (en plus du bouton « ajouter un sujet ») et ouvre la même modale.

## Décisions de cadrage (validées en brainstorming)

| # | Décision | Choix retenu |
|---|---|---|
| 1 | Rôle de la vitrine | Format **standard et universel** des cartes de la grille (`SubjectCard` remplacé) |
| 2 | Nouveaux champs de contenu | **Ajouter** les champs manquants à la DB |
| 3 | Mécanisme « prompt à adapter » | **Les deux** : bouton ✨ Générer (Astra) + lien « voir le prompt » |
| 4 | Surface d'édition | **Grande modale overlay** plein écran, édition **inline** |
| 5 | Polices | **Remapper sur les polices FAME** (Roboto Slab + IBM Plex Mono) — layout de la maquette, typo du site |
| 6 | Champs hors-vitrine | **Tout dans la modale vitrine** (section repliable « Détails complets ») |
| 7 | `sous_titre` | = champ **`titre` existant** (pas de nouvelle colonne) → 3 colonnes ajoutées |
| 8 | Édition inline | **Inputs/textarea contrôlés** stylés en poster (pas `contentEditable`) |
| 9 | Page Paper | **Inchangée** (lecture + tasks/comments/files) ; toute l'édition de champs passe par la modale vitrine. À revoir éventuellement plus tard. |

## Contexte technique (état actuel)

- **Type `Subject`** : `src/types/index.ts:39-62` — champs : `labo, titre, kicker, statut, context, method, results, keywords, auteurs, difficulte, dimensions{method,data,theory,writing}, ordre, is_transversal, confidentiel, created_at, updated_at`.
- **Schéma SQL** : `supabase/migrations/001_initial_schema.sql:33-51` (+ migrations 004 `is_transversal`, 006 `confidentiel`).
- **Grille** : `src/app/[locale]/[lab]/page.tsx` → `SubjectGrid` (`src/components/lab/SubjectGrid.tsx`) : recherche, filtres (statut/difficulté/personnes/date), tri, mode édition (drag-reorder + delete), bouton ajout (membre), lien propose (visiteur).
- **Carte** : `src/components/lab/SubjectCard.tsx` (poster ~1:1.34).
- **Modale actuelle** : `src/components/lab/AddSubjectModal.tsx` — 7 champs (titre, kicker, responsable, statut, difficulté, context, is_transversal).
- **Filtres** : `src/components/lab/FilterSidebar.tsx` (4 dimensions ; **difficulté en dépend** → la conserver éditable).
- **API** : `src/app/api/subjects/route.ts` (GET public, POST membre, auto-`ordre`, `scheduleReindex`), `src/app/api/subjects/[id]/route.ts` (GET public, PATCH/DELETE membre, whitelist), `…/[id]/order` (drag).
- **Détection membre** : `getSession()` (`src/lib/auth.ts`) → `session.member` → prop `canEdit` ; API `requireMember()`.
- **i18n** : namespace `lab` (modale sous `lab.modal.*`) dans `messages/en.json` + `messages/fr.json`.
- **Assistant Astra** : tourne sur **OpenAI** (`gpt-4o-mini`), pas Anthropic. Helper réutilisable `getChatProvider().complete()` (`src/lib/llm/index.ts:16`). Suivi de budget (`src/lib/rag/usage.ts`), kill-switch `ASSISTANT_DISABLED`, retrieval `retrieve(query, tier)` (`src/lib/rag/retrieve.ts`).

## Architecture cible

### A. Modèle de données — migration `007_subject_vitrine.sql`

Ajoute 3 colonnes à `subjects` :

```sql
ALTER TABLE subjects
  ADD COLUMN question text NOT NULL DEFAULT '',  -- titre-question accrocheur (gros titre)
  ADD COLUMN accroche text NOT NULL DEFAULT '',  -- phrase d'accroche (bloc navy)
  ADD COLUMN periode  text NOT NULL DEFAULT '';  -- ex. "2025–2027"
```

Mapping maquette → DB :

| Élément vitrine | Champ DB |
|---|---|
| `Recherche · IA & Finance` (domaine) | `kicker` (existant) |
| `014` (numéro) | dérivé de `ordre`, zéro-padding 3 chiffres (affichage seul) |
| `2025–2027` (période) | `periode` (**nouveau**) |
| `En cours` (statut) | `statut` (existant, label i18n) |
| `Refusé. Mais pourquoi ?` (titre-question) | `question` (**nouveau**) |
| `Explainable AI for…` (sous-titre italique) | `titre` (existant) |
| Phrase d'accroche (navy) | `accroche` (**nouveau**) |
| Tags | `keywords` (existant) |
| Auteur | `auteurs` (existant) |
| `Lire le sujet →` | lien `/[locale]/[lab]/paper/[id]` |

Champs profonds (`context`, `method`, `results`, `dimensions`) + `difficulte` + métadonnées (`is_transversal`, `confidentiel`) : inchangés, édités dans la section « Détails complets ».

### B. `SubjectVitrine` — composant d'affichage (remplace `SubjectCard`)

`src/components/lab/SubjectVitrine.tsx` — un seul layout A4 (ratio ~1:1.41) reproduisant la maquette avec la **typo FAME** :

- Titre-question : `font-serif` (Roboto Slab) bold.
- Sous-titre (`titre`) & accroche : `font-serif` italique.
- Numéro `014` : `font-serif` light, grand.
- Domaine (`kicker`), période, statut, tags : `font-mono` (IBM Plex Mono) uppercase tracking.
- Bloc bas sur fond `fame-navy` (#15203f / maquette #16263f → token FAME).

Deux variantes :
- `variant="card"` : mini-vitrine pour la grille, non éditable, conserve le ratio, clic → page Paper. Réutilise les props actuelles de `SubjectCard` (members, editMode pour delete, badges transversal/done).
- `variant="full"` : A4 pleine taille, utilisée par la modale en lecture seule sous le rendu éditable (ou directement éditable, cf. C).

> Note : la grille reste responsive ; la carte vitrine garde un `min-width` raisonnable et le ratio A4. Le mode édition de la grille (drag-reorder, delete) est préservé.

### C. `VitrineEditor` — modale création + édition (remplace `AddSubjectModal`)

`src/components/lab/VitrineEditor.tsx` — overlay plein écran (réutilise la primitive `Modal` ou un overlay dédié si l'A4 dépasse). Sert **création** (vierge) **et édition** (pré-rempli).

Contenu :
- La vitrine A4 **éditable inline** : chaque élément est un input/textarea contrôlé, stylé pour matcher le texte du poster (fond transparent, même police/taille/couleur). Clic sur l'élément = focus.
- **Aide par champ** (sur les champs rédactionnels : `question`, `titre`, `accroche`, `kicker`, `context`, `method`, `results`, et chaque `dimensions.*`) :
  - bouton **✨ Générer** → POST `/api/subjects/assist`, insère le texte renvoyé (remplaçable/éditable ensuite) ;
  - lien **« voir le prompt »** → révèle le prompt-template (depuis le module partagé) avec bouton copier.
- Champs structurés sans IA : `statut`, `difficulte`, `periode`, `keywords` (tags), `auteurs` (sélecteur de membres), `is_transversal`, `confidentiel`.
- Section repliable **« Détails complets »** (sous le poster) : `context`, `method`, `results`, `dimensions` (4 sous-champs), `difficulte`, bascules `transversal`/`confidentiel`.
- Footer : **Annuler** / **Enregistrer**.
- Création → POST `/api/subjects` ; édition → PATCH `/api/subjects/[id]`. Validation : `titre` requis (compat existant) ; `question` recommandé.

### D. Génération par champ — `POST /api/subjects/assist`

`src/app/api/subjects/assist/route.ts` (membre requis via `requireMember()`) :

- Body : `{ field: string, draft: Partial<Subject>, labo: Lab, locale: 'en'|'fr' }`.
- Respecte `ASSISTANT_DISABLED` (renvoie 503 si coupé).
- Construit `system` + `user` à partir du **prompt-template** du champ (module partagé) en injectant `draft`.
- Appelle `getChatProvider().complete([...])` (OpenAI, non-streaming), enregistre l'usage (`src/lib/rag/usage.ts`).
- Renvoie `{ text }`.

**Module partagé** : `src/lib/subjects/field-prompts.ts` — registre `{ [field]: (draft, locale) => { system, user, displayPrompt } }`. Importé **par le serveur** (génération) **et par le client** (affichage « voir le prompt ») → source unique, aucune divergence. Templates non secrets.

### E. Grille — carte pointillée d'ajout

Dans `SubjectGrid` : pour les membres, après la dernière carte, une **carte fantôme** (`SubjectVitrine`-shaped, bordure `dashed`, « + Ajouter un sujet » centré, animation `fameFade`). Clic → ouvre `VitrineEditor` en création. Le **bouton de la barre d'outils reste** (les deux entrées coexistent). Visiteurs : ni carte ni bouton (lien propose inchangé).

### F. API / types / RAG

- `Subject` (`src/types/index.ts`) : ajout `question`, `accroche`, `periode` (string).
- POST `src/app/api/subjects/route.ts` + PATCH `src/app/api/subjects/[id]/route.ts` : ajouter les 3 champs à la whitelist / au payload de création (défauts `''`).
- `chunkSubject` (`src/lib/rag/chunk.ts`) : inclure `question`, `accroche`, `periode` pour qu'Astra connaisse ces contenus.

### G. i18n (`messages/en.json` + `messages/fr.json`)

Nouvelles clés sous `lab` (et un sous-bloc dédié, ex. `lab.vitrine.*`, `lab.editor.*`) :
- labels vitrine (domaine, période, statut, « La question », « Lire le sujet → », auteur…),
- UI éditeur (« Détails complets », ✨ Générer, « voir le prompt », « copier », génération en cours, erreurs),
- libellé carte pointillée.
Toujours **en + fr** simultanément.

## Découpage en unités

- `migration 007` — schéma.
- `src/types/index.ts` — type (+ tout ce qui type un `Subject`).
- `src/lib/subjects/field-prompts.ts` — registre de prompts partagé.
- `src/app/api/subjects/assist/route.ts` — endpoint génération.
- API subjects (POST/PATCH) — accepter les nouveaux champs.
- `SubjectVitrine` — affichage (card + full).
- `VitrineEditor` — modale création/édition + aides champ.
- `SubjectGrid` — branchement vitrine + carte pointillée + ouverture éditeur (remplace `AddSubjectModal`, supprime l'ancien).
- `chunkSubject` — RAG.
- i18n en/fr.

## Tests / vérification

- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- Manuel : création via bouton **et** via carte pointillée ; édition inline de chaque élément ; **✨ Générer** sur un champ ; **« voir le prompt »** + copier ; édition d'un sujet existant (pré-rempli, PATCH) ; filtres grille (statut/difficulté/personnes/date) toujours fonctionnels ; clic carte → page Paper ; bascules transversal/confidentiel ; `ASSISTANT_DISABLED` → ✨ désactivé proprement.

## Hors périmètre

- Refonte de la page **Paper** (gardée telle quelle ; éventuellement adaptée plus tard).
- Changement de fournisseur LLM (on reste sur l'existant OpenAI).
- Page **propose** des visiteurs (inchangée).
