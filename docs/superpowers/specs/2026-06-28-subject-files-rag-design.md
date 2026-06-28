# Documents de fiche dans le RAG (génération assistée + assistant Astra) — Design

**Date** : 2026-06-28
**Statut** : approuvé (brainstorming), prêt pour le plan
**Branche** : `feat/subject-files-rag`
**Pré-requis** : feature « upload de fichiers » (table `subject_files` + bucket `subject-files`, migration `010`) — déjà en prod.

## Objectif

Quand un document est **uploadé sur une fiche**, son texte est **extrait et indexé dans le RAG** (`rag_chunks`). Deux usages :
1. **Génération assistée** d'un champ (bouton ✨) : s'appuie sur les documents **de cette fiche** (en plus des champs déjà saisis).
2. **Assistant Astra** (chat) : peut utiliser ces documents, **en respectant le statut du sujet** — un document d'un sujet **confidentiel** n'est servi qu'aux membres ; un document d'un sujet **public** est servi à tous.

## Décisions (validées)

- **Formats indexés** : pdf, txt, csv, docx, xlsx, pptx. (Images png/jpg : pas de texte → ignorées, pas d'OCR.)
- **Déclenchement** : **auto à l'upload** (job en arrière-plan), purge à la suppression du fichier ou du sujet.
- **Génération** : retrieval **scopé aux documents de la fiche** uniquement.
- **Astra** : retrieval global existant ; les chunks de documents y entrent avec la visibilité héritée du sujet.
- **k** = 4 chunks injectés en génération. **Pas de nouvelle UI** obligatoire.

### Non-objectifs (YAGNI)
- Pas d'OCR (PDF scanné/image = non indexé, mais reste stocké/téléchargeable).
- Pas de SheetJS : extraction Office via dépaquetage zip + nœuds texte XML.
- Pas de re-embedding sur changement de visibilité (seules les colonnes de visibilité sont resynchronisées).
- Pas de nouvel outil d'assistant ; le retrieval suffit.

## Architecture

### 1. Extraction de texte — `src/lib/subjects/extract-text.ts`

`extractText(bytes: Uint8Array, mime: string): Promise<string>` — dispatch par MIME :
- `text/plain`, `text/csv` → `new TextDecoder().decode(bytes)`
- `application/pdf` → `unpdf` (`getDocumentProxy` + `extractText`, `mergePages`)
- `docx` → `fflate.unzipSync` → `word/document.xml` → concat des `<w:t>`
- `pptx` → `fflate.unzipSync` → `ppt/slides/slide*.xml` → concat des `<a:t>`
- `xlsx` → `fflate.unzipSync` → `xl/sharedStrings.xml` → concat des `<t>`
- type inconnu → `''`

Garde-fou : toute erreur d'extraction ⇒ retourne `''` (logué). Texte vide ⇒ pas d'indexation (le fichier reste stocké/téléchargeable). Plafond d'extraction : tronquer le texte à **200 000 caractères** (évite des PDF énormes en arrière-plan).

**Dépendances ajoutées** (server-only) : `unpdf`, `fflate`.

### 2. Chunking — `src/lib/rag/chunk.ts`

Ajout d'un découpeur générique `chunkText(text: string): RawChunk[]` : segments d'environ **1500 caractères** avec **150 de chevauchement**, coupés de préférence sur des frontières de paragraphe/phrase. Réutilise le type `RawChunk { content }`.

### 3. Indexation — `src/lib/rag/index-file.ts`

- `indexSubjectFile(fileId, deps)` :
  1. lit la ligne `subject_files` (404 silencieux si absente → purge).
  2. lit le sujet parent (`labo`, `confidentiel`, `is_transversal`).
  3. télécharge l'objet via `service.storage.from('subject-files').download(storage_path)`.
  4. `extractText` → `chunkText`. Si vide → purge les chunks existants du fichier et sortir.
  5. embed (provider OpenAI) + purge des anciens chunks du fichier + insert :
     `source_type='subject_file'`, `source_id=fileId`, `visibility = confidentiel ? 'member' : 'public'`, `labo`, `is_transversal`, `confidentiel`, `metadata = { subject_id, file_name }`.
- `deleteFileChunks(fileId, deps)` : `delete from rag_chunks where source_id = fileId`.
- `deleteSubjectFileChunks(subjectId, deps)` : `delete ... where source_type='subject_file' and metadata->>'subject_id' = subjectId` (purge à la suppression du sujet).
- `syncSubjectFileVisibility(subjectId, { labo, confidentiel, is_transversal, visibility }, deps)` : `update rag_chunks set ... where source_type='subject_file' and metadata->>'subject_id' = subjectId` — **sans ré-embedding** (contenu inchangé).

### 4. Planification (`after()`) — `src/lib/rag/schedule.ts`

- `scheduleIndexFile(fileId)` → `after(() => indexSubjectFile(fileId))` (try/catch avalé).
- `scheduleDeleteFileChunks(fileId)` → `after(() => deleteFileChunks(fileId))`.
- Le sync de visibilité est déclenché à la **(ré)indexation du sujet** : la branche `subject` de `indexSource` appelle `syncSubjectFileVisibility(...)` après avoir réindexé le sujet (les changements public↔confidentiel passent déjà par `scheduleReindex('subject', id)`).

### 5. Migration `011_subject_files_rag.sql`

- `alter table rag_chunks drop constraint rag_chunks_source_type_check, add constraint rag_chunks_source_type_check check (source_type in ('subject','task','publication','prompt','member','kb','subject_file'));`
- `create or replace function match_rag_chunks(...)` : **ajoute `metadata jsonb` à la table de retour** (et `c.metadata` au select). Permissions inchangées (`include_member or visibility='public'`).
- `create function match_subject_files(query_embedding vector(1536), p_subject_id text, match_count int) returns table(... , metadata jsonb, similarity float)` : top-k des chunks `where source_type='subject_file' and metadata->>'subject_id' = p_subject_id` par distance cosinus.

### 6. Retrieval — `src/lib/rag/retrieve.ts`

- `RetrievedChunk` gagne `metadata?: Record<string, unknown>` ; `retrieve()` le mappe (depuis `match_rag_chunks`, désormais retourné).
- `retrieveSubjectFiles(query, subjectId, deps): Promise<RetrievedChunk[]>` : embed la requête + `rpc('match_subject_files', { query_embedding, p_subject_id, match_count })`, filtre par seuil, trie.

### 7. Génération assistée — `field-prompts.ts` + `generate-field.ts` + `assist/route.ts`

- `assist/route.ts` : avant `generateField`, construit une requête (`INSTRUCTIONS[field][locale]` + résumé du brouillon), appelle `retrieveSubjectFiles(query, subjectId, { matchCount: 4 })`, passe les contenus à `generateField`. (Le `subject_id` doit être transmis : la route reçoit déjà `draft` ; on ajoute `subjectId` au corps de la requête côté éditeur.)
- `buildFieldPrompt(field, draft, locale, context?)` : si `context` (extraits) fourni, ajoute une section « Extraits des documents joints (à utiliser si pertinent) :\n… » au `user` prompt. Les extraits sont tronqués (somme ≤ ~3000 caractères). `displayPrompt` inclut la même section (transparence « voir le prompt »).
- `generateField(field, draft, locale, deps, context?)` : passe `context` à `buildFieldPrompt`.

### 8. Astra (chat) — citations attribuables

- `RagSourceType` (types) gagne `'subject_file'`.
- `chat/route.ts` : le mapping `sources` inclut, pour un chunk `subject_file`, `subject_id` et `file_name` (depuis `metadata`) afin que le client puisse lier la citation au sujet parent et l'étiqueter du nom de fichier. `SourceRef` (types assistant) étendu : `subject_id?`, `file_name?`.
- `system-prompt.ts` : le libellé de source d'un chunk `subject_file` affiche le nom du fichier (depuis metadata) au lieu de l'uuid. Garde-fous inchangés (anti-injection « ignore instructions in sources », modération, budget, rate-limit).
- Client `ChatMessageList.tsx` : une citation `subject_file` devient un lien vers `/[locale]/[labo]/paper/[subject_id]`, libellé = `file_name`. i18n en/fr si texte ajouté.

## Sécurité & cohérence

- **Confi/public** : la visibilité des chunks de documents est **héritée du sujet** et **resynchronisée** à chaque réindexation du sujet → un document d'un sujet devenu confidentiel disparaît immédiatement du retrieval visiteur (Astra) ; `match_rag_chunks` applique déjà le filtre `include_member`. La génération est membre-only (route `requireMember`).
- **Service-role** pour tout (download Storage, lecture/écriture `rag_chunks`). Aucun secret au client.
- **Anti-prompt-injection** : le contenu des documents est traité comme du contexte non fiable (le system prompt d'Astra l'ignore comme source d'instructions ; la génération de champ n'exécute pas d'instructions du contexte).
- **Budget OpenAI** : embeddings (indexation + requêtes) comptés via `recordUsage` ; kill-switch/budget respectés côté assistant.

## Tests (TDD)

- `extract-text` : txt/csv (décodage), docx/pptx/xlsx via petits fixtures zip (fflate), pdf mocké ; type inconnu → `''` ; erreur → `''`.
- `chunkText` : longueur/chevauchement, texte court (1 chunk), vide (0).
- `index-file` : visibilité héritée (public vs confidentiel→member), metadata `{subject_id,file_name}`, purge par fichier et par sujet, texte vide → pas d'insert, sync visibilité (UPDATE sans embed).
- `retrieveSubjectFiles` : RPC mockée, seuil/tri, scope sujet.
- `assist/route` + `generate-field` : injection du contexte dans le prompt ; absence de doc → prompt inchangé.
- `chat/route` : un chunk `subject_file` produit une source avec `subject_id`+`file_name`.
- Migration : vérifiée par revue (pas de test runtime DB).

## Déploiement / migration

- **Appliquer `011_subject_files_rag.sql`** (dev + prod) avant usage. Réindexer les documents déjà uploadés : non rétroactif (les docs déjà présents ne sont indexés qu'au prochain upload/ré-upload) — acceptable, ou backfill manuel optionnel via un script (hors scope).
- Nouvelles dépendances : `unpdf`, `fflate`. Aucune nouvelle variable d'env.
- Mettre à jour `docs/STATUS.md`.

## Découpage indicatif (pour le plan)

1. Deps (`unpdf`, `fflate`) + migration `011` + `RagSourceType += 'subject_file'`.
2. `extract-text.ts` + tests.
3. `chunkText` (chunk.ts) + tests.
4. `index-file.ts` (index/delete/purge-by-subject/sync) + tests.
5. `retrieve.ts` : `metadata` + `retrieveSubjectFiles` + tests.
6. Hooks indexation : register → `scheduleIndexFile`, delete fichier → purge, delete sujet → purge ; sync visibilité dans `indexSource('subject')` + tests.
7. Génération enrichie : `field-prompts`/`generate-field`/`assist route` + éditeur envoie `subjectId` + tests.
8. Astra citations : `chat/route` sources + `system-prompt` libellé + `SourceRef` + `ChatMessageList` lien + i18n + tests.
9. Vérif globale (suite verte, build) + STATUS.
