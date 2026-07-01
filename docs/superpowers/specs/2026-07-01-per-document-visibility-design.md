# Visibilité par document sur une fiche — Design

_Date : 2026-07-01 · Statut : approuvé_

## Problème

Aujourd'hui, la confidentialité d'un document déposé sur une fiche (`subject_files`) est
**entièrement héritée du sujet** (`subjects.confidentiel`). Impossible d'avoir un document
confidentiel sur une fiche par ailleurs publique.

Besoin : chaque membre peut marquer un document comme **confidentiel** ou **public**,
indépendamment du statut de la fiche. Une fiche publique peut ainsi porter des documents
confidentiels.

## Décisions produit

1. **Statut par document, unique, modifiable par n'importe quel membre** — pas de statut
   par-membre-par-doc (cohérent avec le modèle de l'app : les membres agissent librement).
2. **Nouveau document → confidentiel par défaut** (fail-closed). Le membre le rend public
   explicitement.
3. **Doc confidentiel sur fiche publique → invisible au visiteur** — absent de la liste,
   ne fuite même pas le nom du fichier (cohérent avec les fiches confi qui « n'existent
   pas » = 404). Filtrage côté serveur.
4. **Hors périmètre** : les liens Dropbox (pas de visibilité par-lien). La demande porte
   sur les documents déposés.

## Règle de visibilité effective

Un document est **effectivement confidentiel** si :

```
subject.confidentiel  OU  file.confidentiel
```

Restriction additive : un sujet confidentiel cache déjà tout ; un document confidentiel
restreint en plus sur une fiche publique. Un sujet confidentiel ne peut pas rendre un
document « plus public » que la fiche.

## 1. Modèle de données

Migration `014_subject_file_confidentiel.sql` :

```sql
alter table subject_files
  add column confidentiel boolean not null default true;
-- Préserver l'existant : les docs déjà déposés gardent leur visibilité actuelle
-- (publics sur fiche publique) — pas de masquage rétroactif.
update subject_files set confidentiel = false;
```

- Nouveaux uploads : `true` (default DB + écrit explicitement par le register).
- Type `SubjectFile` (`src/types/index.ts`) → ajout `confidentiel: boolean`.

## 2. Backend — gate & API

- **Download gate** (`GET /api/subjects/[id]/files/[fileId]`) : charge aussi
  `file.confidentiel`, gate sur `(subject.confidentiel || file.confidentiel) && !isMember → 404`.
- **Liste (page serveur)** `src/app/[locale]/[lab]/paper/[id]/page.tsx` : pour un visiteur
  (`!isMember`), la requête `subject_files` reçoit `.eq('confidentiel', false)` → les docs
  confidentiels sont absents de la liste rendue.
- **Nouvelle route** `PATCH /api/subjects/[id]/files/[fileId]` : `requireMember`, body
  `{ confidentiel: boolean }`, valide l'appartenance du fichier au sujet (`404` sinon),
  met à jour la colonne, planifie un **re-tier RAG** du fichier.
- **Register** (`POST /api/subjects/[id]/files`) : insère `confidentiel: true` explicitement.

## 3. RAG

- `indexSubjectFile` (`src/lib/rag/index-file.ts`) :
  `confidentiel = (subject ? !!subject.confidentiel : true) || !!file.confidentiel`
  → `visibility = confidentiel ? 'member' : 'public'`. Un doc confidentiel sur fiche
  publique est indexé en tier `member`.
- **Re-tier léger** : nouveau helper `retierFile(fileId)` qui recalcule la visibilité
  effective (charge `file.confidentiel` + `subject.confidentiel`) et met à jour
  `rag_chunks` (`source_id = fileId`, `source_type = 'subject_file'`) **sans ré-extraire
  ni ré-embarquer**. Appelé au toggle via `schedule.ts`.
- `syncSubjectFileVisibility` (appelé quand un **sujet** est réindexé,
  `src/lib/rag/index-source.ts`) corrigé pour **ne plus écraser** le flag par-fichier :
  - `labo` / `is_transversal` : restent en blanket (viennent du sujet).
  - visibilité : `member` en blanket si le sujet est confidentiel ; sinon **par fichier**
    selon le `confidentiel` propre de chaque `subject_files` du sujet.
- `match_subject_files` : **inchangé** — utilisé uniquement en contexte membre (génération
  assistée `POST /api/subjects/[id]/assist`, `requireMember`), donc servir un chunk
  confidentiel y est légitime.
- `match_rag_chunks` : **inchangé** — filtre déjà par tier ; verra le doc confidentiel en
  `member` grâce au point ci-dessus. Aucun changement SQL sur les fonctions.

## 4. UI — `FilesPanel` (`src/components/paper/FilesPanel.tsx`, membres)

- Sur chaque document déposé, un **bouton cadenas** (🔒 confidentiel / 🔓 public) placé
  avant le ✕ suppression → toggle → `PATCH .../files/[fileId]` → `router.refresh()`.
- Un document confidentiel porte un **badge/teinte discret** pour que le membre voie le
  statut d'un coup d'œil.
- Erreur → toast (`paper.updateFailed` ou clé dédiée).
- Visiteur : documents confidentiels déjà filtrés côté serveur → ne voit ni cadenas ni badge.
- i18n : clés `paper.fileConfidential`, `paper.makeFilePublic`, `paper.makeFileConfidential`
  (+ toast d'échec si besoin) — ajoutées dans `messages/en.json` **et** `messages/fr.json`.

## 5. Tests (TDD)

- **Download gate** : confi + visiteur → 404 ; public sur sujet public + visiteur → 302 ;
  confi + membre → 302 ; sujet confi (doc public) + visiteur → 404 (inchangé).
- **Route PATCH** : membre OK (colonne mise à jour) ; non-membre → 401 ; fichier
  n'appartenant pas au sujet → 404 ; corps invalide → 400.
- **`indexSubjectFile`** : doc confidentiel sur sujet public → chunks en `visibility: 'member'`.
- **`retierFile`** : toggle met à jour la visibilité des chunks sans ré-embed (l'extraction
  n'est pas appelée).
- **`syncSubjectFileVisibility`** : sujet reste public, un doc confi → ses chunks restent
  `member` (non écrasés en `public`).

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `supabase/migrations/014_subject_file_confidentiel.sql` | nouveau — colonne + backfill |
| `src/types/index.ts` | `SubjectFile.confidentiel` |
| `src/app/api/subjects/[id]/files/route.ts` | register écrit `confidentiel: true` |
| `src/app/api/subjects/[id]/files/[fileId]/route.ts` | gate OR + nouveau `PATCH` |
| `src/app/[locale]/[lab]/paper/[id]/page.tsx` | filtre `.eq('confidentiel', false)` visiteur |
| `src/lib/rag/index-file.ts` | `indexSubjectFile` OR + `retierFile` + `syncSubjectFileVisibility` |
| `src/lib/rag/schedule.ts` | `scheduleRetierFile` |
| `src/components/paper/FilesPanel.tsx` | bouton cadenas + badge |
| `messages/{en,fr}.json` | clés i18n |
