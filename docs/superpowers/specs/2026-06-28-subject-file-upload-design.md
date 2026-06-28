# Upload de fichiers sur une fiche sujet — Design

**Date** : 2026-06-28
**Statut** : approuvé (brainstorming), prêt pour le plan d'implémentation
**Branche** : `feat/subject-file-upload`

## Contexte & objectif

Aujourd'hui, le panneau **Fichiers** d'une fiche sujet (`FilesPanel.tsx`) n'affiche que des **liens Dropbox** (`dropbox_links`) : on ne peut rattacher qu'un fichier déjà présent dans le Dropbox du labo. Il n'existe aucun stockage de fichiers côté application.

**But** : permettre aux membres de **déposer un fichier directement** (PDF, image, doc Office, csv/txt) sur une fiche, **en complément** des liens Dropbox (Dropbox reste inchangé).

## Décisions produit (validées)

1. **Accès en lecture** : sur un sujet **public**, **tout le monde** (visiteurs inclus) peut voir la liste et **télécharger**. Sur un sujet **confidentiel**, rien n'est visible au visiteur (la fiche entière l'est déjà — cf. audit B1) ; seuls les membres accèdent.
2. **Dépôt / suppression** : **membres uniquement**.
3. **Types autorisés** : PDF, images (`png`, `jpg/jpeg`), Office (`docx`, `xlsx`, `pptx`), `csv`, `txt`. **Taille max : 50 Mo**.
4. **Rattachement** : au **sujet uniquement** (pas aux tâches dans cette itération).

### Non-objectifs (YAGNI)

- Pas de rattachement aux tâches (les liens Dropbox le permettent déjà ; on ne le reproduit pas ici).
- Pas de prévisualisation in-app (le téléchargement suffit).
- Pas de versioning de fichiers.
- Pas d'indexation RAG du contenu des fichiers.

## Contrainte technique décisive

Sur Vercel, le corps d'une requête vers une fonction serverless est limité (~4,5 Mo). Faire transiter un fichier de 50 Mo **par** une route API ne fonctionnerait pas. → **Upload direct navigateur → Supabase Storage via URL signée** (le fichier ne passe pas par l'API).

## Architecture

### Stockage

- **Bucket privé** Supabase Storage `subject-files` (jamais public). Tout accès passe par des **URLs signées générées côté serveur** (service-role).
- Chemin de l'objet : `${subject_id}/${file_uuid}` (le nom original n'est pas dans le chemin → pas d'injection ni de collision ; le nom affiché vit en BDD).
- Bucket configuré avec `file_size_limit = 52428800` (50 Mo) et `allowed_mime_types` = liste blanche (défense supplémentaire au niveau Storage).

### Table `subject_files`

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `subject_id` | uuid FK → `subjects(id) on delete cascade` | |
| `labo` | text | hérité du sujet (cohérence avec `dropbox_links`) |
| `storage_path` | text | chemin dans le bucket |
| `file_name` | text | nom original affiché |
| `mime_type` | text | |
| `size_bytes` | bigint | |
| `uploaded_by` | uuid (member id, nullable) | traçabilité |
| `created_at` | timestamptz default now() | |

- Index sur `subject_id`. **RLS activée**, **aucune policy publique** : tout l'accès passe par l'API service-role (cohérent avec le reste du projet).
- **Migration `010_subject_files.sql`** : table + `insert into storage.buckets (...)` (bucket privé, limites). Appliquée manuellement en BDD (comme `001`–`009`).

### Flux d'upload (3 temps)

1. **Signer** — `POST /api/subjects/[id]/files/sign`
   - `requireMember` (aucune dépendance LLM/assistant ici).
   - Valide : le sujet existe ; `mime_type` ∈ liste blanche ; `size_bytes` ≤ 50 Mo ; `file_name` non vide.
   - Génère `storage_path = "${id}/${uuid}"` puis une **URL d'upload signée** via le service-role (`createSignedUploadUrl`).
   - Réponse : `{ path, token }` (ou URL signée).
2. **Uploader** — le **navigateur** envoie le fichier directement à Storage (`uploadToSignedUrl(path, token, file)` via le client browser). Ne passe pas par l'API.
3. **Enregistrer** — `POST /api/subjects/[id]/files`
   - `requireMember` ; revalide type/taille/nom ; vérifie que l'objet existe à `storage_path` ; insère la ligne `subject_files`.
   - Réponse : la ligne créée. En cas d'échec d'insertion, supprime l'objet orphelin du bucket (compensation).

### Flux de téléchargement

- `GET /api/subjects/[id]/files/[fileId]`
  - Charge le sujet ; **si `confidentiel` && non-membre → 404** (revérification défense-en-profondeur ; aligné B1).
  - Charge la ligne `subject_files` (404 si absente ou `subject_id` ≠ `[id]`).
  - Génère une **URL de téléchargement signée courte (~60 s)** et **redirige** (302) dessus.
  - → un fichier de sujet confidentiel n'est jamais servi au visiteur, même par URL devinée.

### Flux de suppression

- `DELETE /api/subjects/[id]/files/[fileId]` — `requireMember` ; supprime l'objet Storage puis la ligne. Idempotent (404 si déjà supprimé).

## UI

- **Page sujet (RSC)** : charger `subject_files` du sujet (en plus de `dropbox_links`) et les passer à `PaperView` → `FilesPanel`. Pour un sujet public, la liste est servie à tous ; un confidentiel 404 déjà pour le visiteur, donc pas de fuite.
- **`FilesPanel`** : deux sections — *Liens Dropbox ↗* (existant, inchangé) et *Fichiers déposés ⬇* (nouveau). Chaque fichier déposé : nom + taille + lien de téléchargement (`/api/subjects/[id]/files/[fileId]`). Pour les **membres** : bouton **« Déposer un fichier »** (file picker → upload 3-temps → rafraîchit la liste) et une suppression par fichier via `ConfirmDialog`.
- **Validations client** (retour immédiat) : type non autorisé / > 50 Mo → toast d'erreur avant tout appel.
- **État** : pendant l'upload, indicateur + désactivation du bouton. Erreurs (sign/upload/register) → toast.
- **i18n** : nouvelles clés en/fr (bouton déposer, en cours, types/taille invalides, supprimer, confirmation, section « Fichiers déposés », téléchargement). Parité stricte.

## Sécurité (récap, cohérent avec l'audit)

- Bucket **privé** + URLs signées générées **serveur** → pas d'URL Storage publique devinable.
- **Confidentiel** revérifié à chaque download (404 visiteur).
- **Dépôt/suppression** = `requireMember`.
- Validation **type + taille côté serveur** (sign **et** register), pas seulement client ; liste blanche aussi au niveau bucket.
- Service-role pour toutes les ops Storage/DB (jamais de clé exposée au client ; le client n'a que le token d'upload signé, limité à un chemin précis).

## Tests (TDD)

Routes mockant Storage + Supabase :
- **sign** : 401 non-membre ; 400 type non autorisé ; 400 > 50 Mo ; 200 + path/token en succès.
- **register** : 401 non-membre ; 400 validations ; 201 insertion ; compensation si insert échoue.
- **download** : **404 visiteur sur sujet confidentiel** ; 404 file absent / mauvais sujet ; 302 redirection vers URL signée en succès (membre, ou visiteur sur sujet public).
- **delete** : 401 non-membre ; 200 succès.
- Helper de validation type/taille testé en isolation (liste blanche, borne 50 Mo).

## Déploiement / migration

- Appliquer **`010_subject_files.sql`** en BDD (dev + prod) — crée la table et le bucket privé.
- Aucune nouvelle variable d'environnement (réutilise `SUPABASE_SERVICE_ROLE_KEY` + le client browser anon existant).
- Mettre à jour `docs/STATUS.md`.

## Découpage indicatif (pour le plan)

1. Migration `010` (table + bucket) + type `SubjectFile` dans `src/types`.
2. Helper de validation (liste blanche MIME + borne taille) + tests.
3. Endpoint `sign` + tests.
4. Endpoint `register` (+ compensation) + tests.
5. Endpoint `download` (gate confidentiel + URL signée) + tests.
6. Endpoint `delete` + tests.
7. Page sujet RSC : charger `subject_files`.
8. `FilesPanel` : section fichiers déposés + upload + suppression + i18n.
9. Vérification (suite verte, build) + STATUS.
