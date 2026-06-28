# Design — Traduction bilingue du contenu des fiches (auto à l'enregistrement)

> Date : 2026-06-28
> Branche : `feat/vitrine-subject-editor` (suite directe de la fiche vitrine)
> Statut : design validé (approche + décisions tranchées), en attente de relecture spec avant plan

## Problème

Le contenu d'une fiche (`titre`, `question`, `accroche`, `context`, `method`, `results`, `keywords`, `dimensions`) est stocké en **une seule chaîne**, dans la langue de saisie. La vitrine et la page Paper l'affichent tel quel quelle que soit la locale → une fiche écrite en FR reste en FR sur le site EN. Seuls les libellés d'UI sont i18n.

## Décisions (validées)

| # | Décision | Choix |
|---|---|---|
| 1 | Mécanisme | **Bilingue, traduction auto à l'enregistrement** (IA déjà branchée, OpenAI via `getChatProvider`) |
| 2 | Fiches existantes | **Fallback seulement** — pas de backfill ; affichées en langue d'origine jusqu'à ré-enregistrement |
| 3 | Saisie | Éditeur **mono-langue** (locale courante) ; pas de double saisie |
| 4 | Branche | Même branche `feat/vitrine-subject-editor` |

## Architecture

### A. Stockage — migration `009`

```sql
ALTER TABLE subjects ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Forme :
```jsonc
{
  "en": { "titre": "...", "question": "...", "accroche": "...",
          "context": "...", "method": "...", "results": "...",
          "keywords": ["...","..."],
          "dimensions": { "method": "...", "data": "...", "theory": "...", "writing": "..." } },
  "fr": { /* mêmes champs */ }
}
```

Les **colonnes plates existantes** (`titre`, `context`, …) restent et portent la **langue source** (= fallback). Additif, zéro casse. Legacy = `i18n` vide `{}` → fallback.

**Champs traduits** : `titre`, `question`, `accroche`, `context`, `method`, `results`, `keywords`, `dimensions{4}`.
**Non traduits** :
- `kicker` (domaine) → mappé via `DOMAIN_OPTIONS` (options EN/FR alignées par index), fallback valeur stockée. **Pas d'IA.**
- `periode`, `statut`, `difficulte` → chiffres/enums (déjà i18n via labels).

### B. Types (`src/types/index.ts`)

```ts
export interface SubjectI18nFields {
  titre: string
  question: string
  accroche: string
  context: string
  method: string
  results: string
  keywords: string[]
  dimensions: { method: string; data: string; theory: string; writing: string }
}
export type Locale2 = 'en' | 'fr'
export type SubjectI18n = Partial<Record<Locale2, Partial<SubjectI18nFields>>>
```
`Subject` gagne `i18n: SubjectI18n`.

### C. Module de traduction (serveur) — `src/lib/subjects/translate.ts`

```ts
export async function translateSubjectFields(
  source: SubjectI18nFields,
  to: Locale2,
  deps?: { provider?: ChatProvider; record?: (i:number,o:number)=>Promise<void> },
): Promise<SubjectI18nFields>
```
- **Un seul appel LLM groupé** : prompt « traduis cet objet JSON vers `<to>` ; si un champ est déjà dans la langue cible, renvoie-le inchangé ; réponds UNIQUEMENT par un objet JSON avec les mêmes clés ».
- Parse défensif (strip fences ```), `try/catch` → **en cas d'échec, renvoie `source` inchangé** (donc les deux langues = source = fallback gracieux).
- `keywords` (array) et `dimensions` (objet) inclus dans le JSON.
- Enregistre l'usage (`recordUsage`). Server-only (jamais importé côté client).

### D. API — `POST /api/subjects` + `PATCH /api/subjects/[id]`

- Le payload de l'éditeur inclut désormais `locale` (langue source = locale de l'éditeur).
- À la création/màj :
  1. construire `srcFields: SubjectI18nFields` depuis le payload ;
  2. `i18n[source] = srcFields` ;
  3. si `ASSISTANT_DISABLED!=1` **et** `!isOverBudget()` → `i18n[other] = await translateSubjectFields(srcFields, other)` ; sinon `i18n[other] = srcFields` (fallback) ;
  4. persister `i18n` + les colonnes plates (= source, comme aujourd'hui).
- La traduction est **synchrone** (contenu court, 1 appel ~1-2 s). Si elle échoue, l'enregistrement réussit quand même (fallback).

### E. Affichage — `src/lib/subjects/localized.ts`

```ts
export interface LocalizedSubject {
  titre: string; question: string; accroche: string
  context: string; method: string; results: string
  keywords: string[]; dimensions: Subject['dimensions']; kicker: string
}
export function localizedSubject(s: Subject, locale: Locale2): LocalizedSubject
```
- Chaque champ = `s.i18n?.[locale]?.champ ?? s.<champ>` (fallback plat).
- `kicker` : index dans `DOMAIN_OPTIONS.en`/`.fr`, renvoyer `DOMAIN_OPTIONS[locale][idx]` ; sinon `s.kicker`.
- Consommé par `SubjectVitrine` (reçoit `locale`, calcule en interne ; `vitrineHeadline/Subtitle` opèrent sur les valeurs localisées) **et** la page Paper (`PaperView`/`PaperSheet`, server, calcule la version localisée).

### F. Recherche & RAG

- **Recherche** (`SubjectGrid.passesFilters`) : matche `q` sur `titre`/`question` dans **les deux langues** (flat + `i18n.en` + `i18n.fr`).
- **RAG** (`chunkSubject`) : indexer les deux langues présentes dans `i18n` (fallback flat) → Astra répond dans la langue demandée.

### G. Éditeur (`VitrineEditor`)

- Reste mono-langue (locale courante).
- Ajout d'une **mention** sous l'en-tête : « Le contenu sera traduit automatiquement dans l'autre langue à l'enregistrement. » (clé i18n `editor.autoTranslateNote`, EN+FR).
- Ajoute `locale` au payload de `save()`.

## Découpage en unités

- `migration 009` + type `Subject`/`SubjectI18n`.
- `src/lib/subjects/translate.ts` (+ test : provider factice).
- API POST/PATCH : remplir `i18n` + traduction.
- `src/lib/subjects/localized.ts` (+ test : fallback, mapping kicker).
- `SubjectVitrine` + `vitrine` helpers : afficher localisé.
- Page Paper (`PaperView`/`PaperSheet`) : afficher localisé.
- `SubjectGrid` : recherche bi-langue + passer `locale` à la vitrine.
- `chunkSubject` : indexer les deux langues.
- `VitrineEditor` : `locale` au payload + mention.
- i18n : `editor.autoTranslateNote` (en+fr).

## Tests / vérification

- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test` (parité i18n incluse).
- Unitaires : `translateSubjectFields` (succès + fallback sur échec/JSON invalide) ; `localizedSubject` (fallback plat, mapping kicker EN↔FR, langue manquante).
- Manuel : créer une fiche en FR → la voir traduite sur le site EN ; idem EN→FR ; fiche legacy (sans i18n) → fallback langue d'origine ; `ASSISTANT_DISABLED=1` → enregistrement OK sans traduction ; recherche trouve une fiche via un terme dans l'autre langue ; Astra répond dans la langue posée.

## Hors périmètre

- Traduction du contenu des **autres** entités (publications, prompts, commentaires, tasks) — même patron, à faire plus tard si voulu.
- Backfill des fiches existantes (décision : fallback only).
- Édition manuelle des deux langues / verrou « ne pas écraser ma traduction » (YAGNI ; la sauvegarde régénère la langue non-source).
