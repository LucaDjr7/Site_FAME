# D4 — Audit Qualité de Code

**Branche auditée :** `feat/p4-pre-prod`
**Date :** 2026-06-24
**Périmètre :** `src/` complet (composants, API routes, lib, types)
**Références :** `CLAUDE.md` + `AGENTS.md` à la racine

---

## 1. TypeScript — Typage

### [🟠] TS-01 — `any` sur les données Supabase retournées par les jointures (duplication de logique)

- **Fichiers :**
  - `src/app/[locale]/[lab]/paper/[id]/page.tsx:34`
  - `src/components/tasks/kanban-shared.tsx:70–72`
- **Impact :** Les données brutes de Supabase (`task_assignees(members(...))`) ne possèdent pas de type généré, forçant l'utilisation de `any[]` pour le mapping. La logique de flatten est dupliquée à deux endroits. Si Supabase change le shape de la jointure, une des deux copies pourrait être oubliée.
- **Reproduction :** La page `paper/[id]/page.tsx` contient un mapping identique à `flattenTasks()` dans `kanban-shared.tsx` (commentaire ligne 68 de `kanban-shared` le reconnaît explicitement).
- **Fix suggéré :** Supprimer le mapping inline dans `paper/[id]/page.tsx` et appeler directement `flattenTasks(tasksRaw ?? [])`. Le commentaire "Mirrors the flatten in…" dans `kanban-shared` est une dette documentée — la consolider en un seul endroit.

---

### [🟡] TS-02 — Callbacks typés `unknown` au lieu d'utiliser les types de `src/types/index.ts`

- **Fichiers :**
  - `src/components/lab/AddSubjectModal.tsx:42` — `onAdded: (subject: unknown) => void`
  - `src/components/publications/AddPublicationModal.tsx:11` — `onCreated: (pub: unknown) => void`
- **Impact :** Le site de l'appel (ex. `SubjectGrid.tsx:127`) fait `subject as Subject` après réception. On perd la sécurité du typage end-to-end pour un refactoring nul. Les types `Subject` et `Publication` existent dans `src/types/index.ts`.
- **Reproduction :** `AddSubjectModal.tsx` ligne 100 appelle `onAdded(created)` où `created` vient d'un `await res.json()` sans cast.
- **Fix suggéré :** Typer les callbacks avec `(subject: Subject) => void` et `(pub: Publication) => void`, en castant le résultat JSON à la seule frontière `as Subject` dans `handleSubmit`.

---

### [🟡] TS-03 — Casts `as Lab` sur des valeurs non validées dans les routes API

- **Fichiers :**
  - `src/app/api/publications/route.ts:9` — `const lab = req.nextUrl.searchParams.get('lab') as Lab`
  - `src/app/api/members/route.ts:8` — idem
  - `src/app/api/dropbox/links/route.ts:10` — idem
  - `src/app/api/prompts/route.ts:11` — idem
  - `src/app/api/proposals/route.ts:14` — `as Lab | null`
- **Impact :** Le cast `as Lab` est appliqué _avant_ la validation `if (!LABS.includes(lab))`. TypeScript croit que `lab` est de type `Lab` entre le cast et la vérification, ce qui est un mensonge. Si quelqu'un réordonne le code ou ajoute un early return, la validation peut disparaître sans erreur de compilation.
- **Reproduction :** `publications/route.ts` ligne 9 : le cast précède immédiatement la validation ligne 10, donc aucun bug runtime aujourd'hui, mais l'ordre est fragile.
- **Fix suggéré :** Garder `lab` comme `string | null`, valider avec `LABS.includes(lab as Lab)`, et n'assigner `const validLab = lab as Lab` qu'_après_ la vérification (comme fait correctement dans `tasks/route.ts:15`).

---

### [🟡] TS-04 — Non-null assertions (`!`) sans filet dans `auth.ts` et `server.ts`

- **Fichiers :**
  - `src/lib/auth.ts:17` — `user.email!`
  - `src/lib/supabase/server.ts:8,9,32,33` — `process.env.NEXT_PUBLIC_SUPABASE_URL!` etc.
  - `src/components/globe/Globe.tsx:86,100` — `canvas.getContext('2d')!`
- **Impact :**
  - `user.email!` : Supabase peut retourner un user sans email dans des scénarios edge (ex. OAuth). Crash runtime silencieux sur `{ id, email: undefined }` passé en session.
  - Les `process.env.XXX!` dans `server.ts` ne lèvent pas d'erreur explicite en cas de variable manquante — le crash arrive profondément dans le code Supabase avec un message cryptique. Le script `seed-admin.ts` valide correctement ces vars (lignes 18–23) mais `server.ts` ne le fait pas.
  - `getContext('2d')!` : risque faible sur Canvas mais non nul sur certains environnements.
- **Reproduction :** Supprimer `NEXT_PUBLIC_SUPABASE_URL` de `.env.local` → crash sans message d'erreur clair.
- **Fix suggéré :** Ajouter des guards explicites dans `createClient()` / `createServiceClient()` similaires à ce que fait `seed-admin.ts`. Pour `user.email`, utiliser `user.email ?? ''` ou lever une `AuthError`.

---

### [🟡] TS-05 — `land: null as any` et `borders: null as any` dans Globe.tsx

- **Fichiers :** `src/components/globe/Globe.tsx:49,51`
- **Impact :** Ces propriétés représentent des objets GeoJSON (`FeatureCollection` / `MultiLineString`) fournis par `topojson`. Des types précis existent dans `topojson-specification`.
- **Reproduction :** Aucun bug actuel, mais refuser TypeScript pour des types disponibles dans le projet.
- **Fix suggéré :** Typer avec `topojson.FeatureCollection | null` et `topojson.MultiLineString | null` (types déjà importés via `topojson-specification`).

---

### [⚪] TS-06 — `void task_assignees` après destructuring (idiome inhabituel)

- **Fichiers :**
  - `src/app/[locale]/[lab]/paper/[id]/page.tsx:38`
  - `src/components/tasks/kanban-shared.tsx:76`
- **Impact :** `void task_assignees` supprime le warning ESLint `no-unused-vars` sur la variable extraite par destructuring. C'est idiomatique mais surprenant pour un lecteur. La convention habituelle est le préfixe `_`.
- **Fix suggéré :** `const { task_assignees: _ta, ...rest } = t` ou simplement restructurer le mapping.

---

## 2. Code Mort

### [🟡] MORT-01 — Prop `isSelf` déclarée dans `Props` de `EditMemberModal` mais jamais utilisée dans le composant

- **Fichier :** `src/components/team/EditMemberModal.tsx:11`
- **Impact :** `isSelf: boolean` est dans l'interface `Props` (ligne 11), puis `Omit<Props, 'isSelf'> & { isSelf?: boolean }` est l'export final (ligne 265). La prop est acceptée et optionnalisée à l'export mais ignorée dans le rendu — aucun comportement ne change selon `isSelf`. `MemberGrid.tsx` passe la valeur (lignes 285, 314) pour rien.
- **Reproduction :** Passer `isSelf={true}` ou `isSelf={false}` → aucune différence visible.
- **Fix suggéré :** Supprimer `isSelf` de `Props` et de la signature d'export, ou l'utiliser pour conditionner un comportement (ex. cacher le champ `is_admin` quand on s'édite soi-même).

---

### [⚪] MORT-02 — `TARGET_META` et `TARGET_ORDER` définis deux fois identiquement

- **Fichiers :**
  - `src/components/prompts/PromptLibrary.tsx:8–16`
  - `src/components/prompts/PromptCard.tsx:7–15`
- **Impact :** Duplication pure, pas de bug (les valeurs sont identiques). Si une couleur ou un `i18nKey` doit changer, il faut penser à modifier les deux fichiers.
- **Fix suggéré :** Exporter `TARGET_META` et `TARGET_ORDER` depuis un module partagé (ex. `src/components/prompts/prompt-shared.ts`).

---

### [⚪] MORT-03 — `labLabel` recalculé localement dans plusieurs composants

- **Fichiers :**
  - `src/components/prompts/PromptLibrary.tsx:36` — `const labLabel = lab === 'paris' ? 'Paris' : 'Montréal'`
  - `src/components/paper/PaperView.tsx:60` — idem
  - `src/components/data/DataExplorer.tsx:89` — idem
- **Impact :** Si un troisième lab est ajouté (peu probable mais documenté dans les specs), 3 endroits à modifier. La logique de capitalisation n'est pas centralisée.
- **Fix suggéré :** Ajouter dans `src/lib/constants.ts` : `export const LAB_LABELS: Record<Lab, string> = { paris: 'Paris', montreal: 'Montréal' }`.

---

## 3. Duplication

### [🟠] DUP-01 — `DiffDots` défini 3 fois avec des signatures légèrement différentes

- **Fichiers :**
  - `src/components/tasks/kanban-shared.tsx:31` — `DiffDots({ level: number })`
  - `src/components/lab/FilterSidebar.tsx:50` — `DiffDots({ level: number })` (idem mais local)
  - `src/components/lab/SubjectCard.tsx:18` — `DiffDots({ difficulty: Difficulty })` (signature différente !)
- **Impact :** Trois implémentations du même widget visuel (3 points colorés représentant la difficulté). `SubjectCard` utilise `difficulty: Difficulty` alors que les deux autres utilisent `level: number`. Cela signifie qu'un bug de rendu (ex. couleur, taille des points) doit être corrigé en 3 endroits. `kanban-shared.tsx` est déjà partagé entre les composants tasks — `FilterSidebar` et `SubjectCard` devraient soit importer de là, soit un composant UI central.
- **Reproduction :** Modifier la taille des points dans `kanban-shared.tsx:35` n'affecte pas `SubjectCard` ni `FilterSidebar`.
- **Fix suggéré :** Déplacer `DiffDots` dans `src/components/ui/` (ou `src/components/shared/`) avec signature unifiée `{ level: number }`, et importer depuis les trois usages. `SubjectCard` fait un `diffLevel(difficulty)` localement — cette conversion peut être dans le composant partagé.

---

### [🟠] DUP-02 — `PAGE_BG` (gradient de fond) dupliqué dans 5 composants avec variations mineures

- **Fichiers :**
  - `src/components/data/DataExplorer.tsx:7–11`
  - `src/components/admin/AdminProposalsClient.tsx:12–17`
  - `src/components/publications/PublicationList.tsx:207–215`
  - `src/components/prompts/PromptLibrary.tsx:18–23`
  - `src/components/team/MemberGrid.tsx:26–32`
  - (+ variantes inline dans `KanbanBoard.tsx:132–137`, `ProposePageClient.tsx:28–34`, `PaperView.tsx:69–74`)
- **Impact :** Le même motif `radial-gradient(110% 80% at XX% YY%, rgba(181,157,135,0.28)…) + #F9F9FA` est répété ~8 fois avec des variations d'angle et de pourcentage qui ne sont jamais documentées. Toute modification de la charte visuelle de fond nécessite de retrouver tous les sites.
- **Reproduction :** Grep `rgba(181,157,135` sur `src/` → 20 occurrences.
- **Fix suggéré :** Extraire une constante `FAME_PAGE_BG` dans `src/lib/constants.ts` (valeur canonique) et dériver les variantes minuscules via une fonction ou des overrides locaux documentés. La `bg-fame-gradient` Tailwind ne couvre pas les cas `style={{background: …}}`.

---

### [🟡] DUP-03 — `DateBucket` type + logique de bucketing dupliqués dans 4 fichiers

- **Fichiers :**
  - `src/components/lab/SubjectGrid.tsx:13,15`
  - `src/components/lab/FilterSidebar.tsx:6,8`
  - `src/components/tasks/KanbanBoard.tsx:14,104`
  - `src/components/tasks/TaskFilterSidebar.tsx:7,9`
- **Impact :** Le type `type DateBucket = '2025' | '2024' | 'older'` et la fonction de bucketing (slicing les 4 premiers chars de la date) sont re-déclarés 4 fois. Les années hardcodées `'2025'` et `'2024'` deviendront stale.
- **Fix suggéré :** Déplacer vers `src/types/index.ts` (type) et `src/lib/utils.ts` (fonction) — ou à minima dans `kanban-shared.tsx` pour les tasks et un fichier `lab-shared.ts` pour les subjects.

---

### [🟡] DUP-04 — `LABS: Lab[] = ['paris', 'montreal']` déclaré dans ~17 fichiers

- **Fichiers :** Tous les pages routes et API routes (17 occurrences trouvées).
- **Impact :** La liste des labs valides est une constante métier fondamentale définie dans `src/types/index.ts` via le type union `Lab`. Pourtant, chaque fichier redéclare son propre tableau de validation. L'ajout d'un troisième lab exigerait 17+ modifications.
- **Reproduction :** `grep -rn "LABS.*=.*\['paris'.*'montreal'\]" src` → 17 résultats.
- **Fix suggéré :** Exporter `export const VALID_LABS: Lab[] = ['paris', 'montreal']` depuis `src/lib/constants.ts` (déjà utilisé pour `PROPOSAL_DOMAINS`) et l'importer partout.

---

### [🟡] DUP-05 — Pattern `inputStyle` / `labelStyle` / `btnGroupStyle` redéfini dans chaque modale

- **Fichiers :**
  - `src/components/lab/AddSubjectModal.tsx:110–137`
  - `src/components/tasks/AddTaskModal.tsx:35–42`
  - `src/components/team/EditMemberModal.tsx:89–111`
  - `src/components/team/InviteModal.tsx:89–111`
  - `src/components/publications/AddPublicationModal.tsx:16–38`
- **Impact :** Les styles `inputStyle` et `labelStyle` sont identiques (même padding, même fontFamily, même couleurs) dans toutes les modales. ~50 lignes de CSS-in-JS dupliquées.
- **Fix suggéré :** Extraire dans `src/components/ui/form-styles.ts` des constantes réutilisables `FORM_INPUT_STYLE`, `FORM_LABEL_STYLE`, `FORM_BTN_CANCEL_STYLE`, `FORM_BTN_SUBMIT_STYLE`.

---

### [🟡] DUP-06 — Pattern fetch+toast (load, error, toast) répété sans abstraction

- **Fichiers :**
  - `src/components/tasks/KanbanBoard.tsx:44–90` (refresh, handleClaim, handlePatch, handleToggleSubtask, handleDelete)
  - `src/components/lab/SubjectGrid.tsx:135–147`
  - `src/components/data/DataExplorer.tsx:205–238`
  - `src/components/prompts/PromptCard.tsx:54–68`
- **Impact :** Le pattern `const res = await fetch(url, opts); if (!res.ok) { addToast(t('error'), 'error'); return }` est répété ~15 fois avec des variations mineures. Pas de gestion centralisée des erreurs réseau.
- **Fix suggéré :** Un hook `useApiFetch` ou une fonction `apiFetch(url, opts): Promise<T | null>` qui gère le toast d'erreur et retourne `null` en cas d'échec.

---

### [⚪] DUP-07 — `ROLE_KEY` déclaré dans `EditMemberModal` et `InviteModal` identiquement

- **Fichiers :**
  - `src/components/team/EditMemberModal.tsx:17–22`
  - `src/components/team/InviteModal.tsx:15–20`
- **Impact :** Même record `Record<Role, string>` copié-collé.
- **Fix suggéré :** Extraire dans `src/components/team/team-shared.ts`.

---

## 4. Respect des Conventions

### [🟠] CONV-01 — Couleurs hex hardcodées dans les composants non-immersifs (~350 occurrences)

- **Fichiers :** La quasi-totalité des composants `src/components/` (hors `globe/`)
- **Impact :** AGENTS.md prescrit : « utiliser `bg-fame-*`, `text-fame-*` ». L'audit recense **355** occurrences de `color: '#` ou `background: '#` dans des fichiers `.tsx`, dont **351** hors du globe et de la page d'accueil. Les tokens `fame-*` sont définis dans `tailwind.config.ts` mais systématiquement court-circuités par des styles inline. Conséquences :
  1. Refonte de couleur impossible sans cherche/remplace manuel.
  2. Incohérences potentielles : `#fbf8f1` (TaskCard) vs `#fbf9f3` (fame-sand) — valeurs proches mais pas identiques.
  3. Tailwind CSS v4 ne peut pas purger les classes inutilisées si les couleurs sont en inline style.
- **Reproduction :** `grep -rn "color.*'#" src --include="*.tsx" | wc -l` → 355
- **Fix suggéré :** Migration progressive vers les classes `fame-*` pour les couleurs sémantiques (navy, blue, teal, sand, ecru, text-*). Accepter les hex inline seulement pour les valeurs sans correspondance dans la charte (ex. valeurs rgba avec opacité custom). Créer un issue de tracking.

---

### [🟠] CONV-02 — `fontFamily` hardcodé 246 fois au lieu de `font-serif` / `font-mono`

- **Fichiers :** Tous les composants UI (modales, cards, sidebars…)
- **Impact :** AGENTS.md précise : `font-serif` → Roboto Slab, `font-mono` → IBM Plex Mono. Or `fontFamily: 'Roboto Slab, Georgia, serif'` et `fontFamily: 'IBM Plex Mono, monospace'` apparaissent ~246 fois dans des `style={{}}` inline au lieu des classes Tailwind. Cela double la payload CSS et rend les changements de police impossibles sans recherche globale.
- **Reproduction :** `grep -rn "fontFamily.*Roboto Slab\|fontFamily.*IBM Plex" src --include="*.tsx" | wc -l` → 246
- **Fix suggéré :** Remplacer par `className="font-serif"` / `className="font-mono"` dans les composants non-immersifs. Les composants immersifs (globe, paper view) peuvent conserver les inline styles pour leur précision pixel.

---

### [🟡] CONV-03 — `GET /api/members` non protégé par `requireMember()`

- **Fichier :** `src/app/api/members/route.ts:7–16`
- **Impact :** La route GET membres retourne emails, rôles, statut admin, `activated_at` de tous les membres d'un lab sans aucune auth. Seul un `lab` valide est requis. AGENTS.md stipule que les données sensibles (email des membres) ne devraient pas être exposées publiquement.
- **Reproduction :** `curl https://domain/api/members?lab=paris` → liste complète avec emails.
- **Fix suggéré :** Ajouter `try { await requireMember() } catch (e) { return authErrorResponse(e) }` en tête du GET. Les composants publics (ex. `SubjectCard` qui affiche les auteurs) peuvent fonctionner avec uniquement `id, prenom, nom, photo_url` — le select peut être réduit pour la lecture publique ou une route séparée `/api/members/public` créée.

---

### [🟡] CONV-04 — L'activation (auth/activate) ne valide pas la complexité du mot de passe

- **Fichier :** `src/app/api/auth/activate/route.ts:7`
- **Impact :** La validation se limite à `password.length < 8`. Aucune exigence de complexité. Un mot de passe `aaaaaaaa` passe. Le risque est limité car c'est un espace interne, mais non conforme aux bonnes pratiques minimales.
- **Fix suggéré :** Ajouter une regex basique (au moins 1 majuscule, 1 chiffre) ou déléguer à Supabase en laissant sa politique de mot de passe s'appliquer.

---

### [🟡] CONV-05 — URL d'activation hardcodée sur `/en/` dans `invite/route.ts`

- **Fichier :** `src/app/api/members/invite/route.ts:35`
- **Impact :** `const activationUrl = \`${base}/en/auth/activate/${token}\`` hardcode la locale `en`. Si un membre francophone reçoit ce lien, il arrive sur la page en anglais. La locale devrait être passée depuis le client (disponible dans `locale` via le caller) ou détectée.
- **Reproduction :** Inviter un membre depuis l'interface française → URL d'activation en `/en/`.
- **Fix suggéré :** Passer `locale` dans le body de la requête depuis `InviteModal` et construire `/${locale}/auth/activate/${token}`.

---

### [⚪] CONV-06 — `privacy/page.tsx` non prévu dans AGENTS.md mais présent

- **Fichier :** `src/app/[locale]/privacy/page.tsx`
- **Impact :** Fichier hors de la structure définie dans AGENTS.md. Non bloquant, mais devrait être documenté.

---

### [⚪] CONV-07 — `getContext('2d')!` dans Globe.tsx utilise une assertion non-null hasardeuse

- **Fichier :** `src/components/globe/Globe.tsx:86,100`
- **Impact :** `canvas.getContext('2d')` peut théoriquement retourner `null` (autre contexte déjà acquis, environnement limité). Les lignes 86 et 100 utilisent `!` sans vérification.
- **Fix suggéré :** `const ctx = canvas.getContext('2d'); if (!ctx) return;`

---

## 5. Configuration

### [🟡] CFG-01 — ESLint : règles `react-hooks/exhaustive-deps` contournées par commentaire

- **Fichier :** `src/components/globe/Globe.tsx:269`
- **Impact :** `// eslint-disable-next-line react-hooks/exhaustive-deps` sur le `useEffect` principal du Globe. Le tableau de deps est `[]` mais l'effet utilise `addToast`, `t`, `tHome`, `locale`, `router` — toutes des fonctions stables en pratique, mais pas attestées comme stables (non issues de `useCallback`/`useRef`).
- **Reproduction :** Ce pattern est acceptable pour un canvas d'animation (remontage = reset globe), mais le commentaire ne documente pas _pourquoi_ les deps sont omises.
- **Fix suggéré :** Déplacer les callbacks stable (`handlePinClick`) dans un `useRef` ou `useCallback`, puis documenter le commentaire ESLint avec la raison.

---

### [🟡] CFG-02 — `tsconfig` ne déclare pas `noUncheckedIndexedAccess`

- **Fichier :** `tsconfig.json` (hors périmètre `src/` mais impactant)
- **Impact :** Sans cette option, `array[0]` retourne `T` au lieu de `T | undefined`. Dans `SubjectCard.tsx:58`, `subject.auteurs[0]` est utilisé sans vérification de undefined (corrigé par `subject.auteurs[0]` puis `firstAuteurId ?` — ok dans ce cas). Mais dans `TasksPanel.tsx:63` : `const assignee = task.assignees[0]` est utilisé directement avec `assignee &&` au render, ce qui est safe. Le risque est latent pour les futurs développeurs.
- **Fix suggéré :** Ajouter `"noUncheckedIndexedAccess": true` dans `tsconfig.json` et traiter les ~10 sites d'accès indexé non gardé qui en résulteront (niveau d'effort limité).

---

### [⚪] CFG-03 — ESLint config minimale sans règles projet-spécifiques

- **Fichier :** `src/eslint.config.mjs`
- **Impact :** La config se limite à `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`. Aucune règle projet ajoutée : pas de `no-restricted-syntax` pour bannir les `style={{color: '#` inline, pas de règle `import/no-duplicates`. Correct pour un projet Next.js, mais opportunité manquée de valider les conventions via l'outillage.
- **Fix suggéré :** Ajouter une règle `no-restricted-properties` ou `no-restricted-syntax` pour signaler les hex inline hors composants immersifs (optionnel, niveau outil).

---

## 6. Lisibilité

### [🟡] LIS-01 — `SubjectGrid.tsx` — composant de 350+ lignes avec drag-and-drop, filtres, modales

- **Fichier :** `src/components/lab/SubjectGrid.tsx`
- **Impact :** Le composant gère la grille, les filtres, le drag-and-drop pointer-based (100+ lignes), les modales Add/Delete, et la navigation router. Il devrait être découpé : logique de drag dans un hook `useDragReorder`, logique de filtres extraite, et les handlers de mutation factorés.
- **Fix suggéré :** Extraire `useDragReorder(subjects, lab): { draggingId, onPointerDown, … }` dans un hook custom.

---

### [🟡] LIS-02 — `DataExplorer.tsx` — 930 lignes, tout-en-un

- **Fichier :** `src/components/data/DataExplorer.tsx`
- **Impact :** Le composant contient le tree Dropbox, le panneau de détail, la logique de linking, les effets de chargement, et 5+ fonctions de dérivation d'état. La lisibilité souffre et les tests seraient impossibles à écrire.
- **Fix suggéré :** Extraire `<DropboxTree>` et `<NodeDetail>` comme sous-composants, et la logique de loading/linking dans un hook `useDropboxExplorer`.

---

### [🟡] LIS-03 — `KanbanBoard.tsx` — logique de filtres complexe avec `bucket()` définie inline

- **Fichier :** `src/components/tasks/KanbanBoard.tsx:104`
- **Impact :** La fonction `bucket(t2: TaskWithRelations): DateBucket` est définie à l'intérieur du composant bien qu'elle soit pure et identique à `dateBucket` dans `TaskFilterSidebar.tsx:9`. En étant dans le composant, elle est recréée à chaque render.
- **Fix suggéré :** Déplacer dans `kanban-shared.tsx` et importer (cohérent avec `DiffDots`, `ProgressBar`, etc. déjà centralisés là).

---

### [⚪] LIS-04 — Nommage : `tc` et `ts` comme variables `useTranslations` dans `AdminProposalsClient`

- **Fichier :** `src/components/admin/AdminProposalsClient.tsx:34–36`
- **Impact :** `const tdiff = useTranslations('tasks')` et `const ts = useTranslations('proposalStatus')` — `ts` est ambigu (ressemble à TypeScript), `tc` n'est pas utilisé dans ce fichier (variable locale `tc` apparaît dans un `setComments(c => …)` sur la ligne 249).
- **Fix suggéré :** Renommer en `tDiff`, `tStatus` pour clarté.

---

### [⚪] LIS-05 — Animation keyframes définis dans `<style>` inline dans `PaperView`

- **Fichier :** `src/components/paper/PaperView.tsx:77–87`
- **Impact :** Les keyframes `drift1–drift4` sont injectés via `<style>{…}</style>` directement dans le JSX. AGENTS.md demande d'utiliser les keyframes de `globals.css`. Ces 4 animations ne sont pas dans `globals.css`.
- **Reproduction :** Les animations `fameSpin` et `fameSpinRev` utilisées dans `Globe.tsx` ne sont pas non plus dans `globals.css` — elles sont dans les SVG inline du composant (classes `fameSpin/fameSpinRev`).
- **Fix suggéré :** Déplacer les keyframes `drift1–4` dans `globals.css` sous un bloc dédié `/* Paper view animations */`.

---

## Console.log et TODO restants

**Console.log :**
- `src/scripts/seed-admin.ts:73,95` — Dans un script CLI, acceptable.

**TODO/FIXME/XXX :** Aucun trouvé dans `src/`.

---

## Tableau Récapitulatif

| ID | Sévérité | Catégorie | Fichier(s) principal(aux) | Titre |
|---|---|---|---|---|
| TS-01 | 🟠 | TypeScript | `paper/[id]/page.tsx:34`, `kanban-shared.tsx:70` | `any` + flatten dupliqué sur données Supabase |
| DUP-01 | 🟠 | Duplication | `kanban-shared.tsx:31`, `FilterSidebar.tsx:50`, `SubjectCard.tsx:18` | `DiffDots` défini 3× avec signatures différentes |
| CONV-01 | 🟠 | Conventions | ~70 fichiers TSX | 355 couleurs hex inline hors page immersive |
| CONV-02 | 🟠 | Conventions | ~50 fichiers TSX | 246 `fontFamily` inline hors pages immersives |
| CONV-03 | 🟠 | Conventions / Sécurité | `api/members/route.ts:7` | GET membres sans auth (emails exposés publiquement) |
| TS-02 | 🟡 | TypeScript | `AddSubjectModal.tsx:42`, `AddPublicationModal.tsx:11` | Callbacks `unknown` au lieu des types de `types/index.ts` |
| TS-03 | 🟡 | TypeScript | 5 routes API | Casts `as Lab` avant validation |
| TS-04 | 🟡 | TypeScript | `auth.ts:17`, `server.ts:8–33` | Non-null assertions sans guard |
| TS-05 | 🟡 | TypeScript | `Globe.tsx:49,51` | `null as any` pour données GeoJSON typées |
| MORT-01 | 🟡 | Code mort | `EditMemberModal.tsx:11,265` | Prop `isSelf` déclarée mais jamais utilisée |
| DUP-02 | 🟠 | Duplication | 8 fichiers | `PAGE_BG` gradient dupliqué ~8× |
| DUP-03 | 🟡 | Duplication | 4 fichiers | `DateBucket` type + logic dupliqués |
| DUP-04 | 🟡 | Duplication | 17 fichiers | `LABS = ['paris','montreal']` dupliqué partout |
| DUP-05 | 🟡 | Duplication | 5 modales | `inputStyle`/`labelStyle` dupliqués |
| DUP-06 | 🟡 | Duplication | 4 composants | Pattern fetch+toast répété sans hook |
| CONV-04 | 🟡 | Conventions | `auth/activate/route.ts:7` | Validation mot de passe trop permissive |
| CONV-05 | 🟡 | Conventions | `invite/route.ts:35` | URL activation hardcodée sur locale `/en/` |
| CFG-01 | 🟡 | Config | `Globe.tsx:269` | ESLint exhaustive-deps contourné sans documentation |
| CFG-02 | 🟡 | Config | `tsconfig.json` | `noUncheckedIndexedAccess` manquant |
| LIS-01 | 🟡 | Lisibilité | `SubjectGrid.tsx` | Composant 350+ lignes (drag + filtres + CRUD) |
| LIS-02 | 🟡 | Lisibilité | `DataExplorer.tsx` | Composant 930 lignes tout-en-un |
| LIS-03 | 🟡 | Lisibilité | `KanbanBoard.tsx:104` | `bucket()` inline duplique la logique de `kanban-shared` |
| LIS-05 | ⚪ | Lisibilité | `PaperView.tsx:77` | Keyframes dans `<style>` inline hors `globals.css` |
| DUP-07 | ⚪ | Duplication | `EditMemberModal.tsx:17`, `InviteModal.tsx:15` | `ROLE_KEY` dupliqué |
| MORT-02 | ⚪ | Code mort | `PromptLibrary.tsx:8`, `PromptCard.tsx:7` | `TARGET_META`/`TARGET_ORDER` dupliqués |
| MORT-03 | ⚪ | Code mort | 3 fichiers | `labLabel` recalculé localement |
| CONV-06 | ⚪ | Conventions | `privacy/page.tsx` | Page hors structure AGENTS.md |
| CONV-07 | ⚪ | Conventions | `Globe.tsx:86,100` | `getContext('2d')!` sans guard |
| TS-06 | ⚪ | TypeScript | `paper/[id]/page.tsx:38`, `kanban-shared.tsx:76` | `void task_assignees` idiome inhabituel |
| LIS-04 | ⚪ | Lisibilité | `AdminProposalsClient.tsx:34–36` | Variables `ts`/`tc` ambiguës |
| CFG-03 | ⚪ | Config | `eslint.config.mjs` | Pas de règles projet ESLint |

---

## Synthèse par sévérité

| Sévérité | Nombre | Findings principaux |
|---|---|---|
| 🔴 Critique | 0 | — |
| 🟠 Bug latent réel | 6 | TS-01, DUP-01, DUP-02, CONV-01, CONV-02, CONV-03 |
| 🟡 Dette à traiter | 15 | TS-02 à TS-05, MORT-01, DUP-03 à DUP-06, CONV-04 à CFG-02, LIS-01 à LIS-03 |
| ⚪ Nit | 10 | TS-06, MORT-02 à MORT-03, CONV-06 à CONV-07, DUP-07, LIS-04 à LIS-05, CFG-03 |
