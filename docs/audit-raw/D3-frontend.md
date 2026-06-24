# Audit Frontend D3 — FAME Website

> Branche auditée : `feat/p4-pre-prod`  
> Date : 2026-06-24  
> Périmètre : `src/components/**` + `src/app/[locale]/**`  
> Auditeur : Claude Sonnet 4.6 (lecture seule)

---

## Findings

---

### F01 — `computeSize()` appelé côté serveur au rendu initial du RSC parent

**[🟠] Hydratation : `window` lu pendant le rendu initial du composant client Globe**

- **Fichier :** `src/components/globe/Globe.tsx:272`
- **Impact :** La ligne `const size = typeof window !== 'undefined' ? computeSize() : 400` est exécutée au corps du composant (pas dans un `useEffect`). Lors du premier rendu côté serveur (SSR), `window` est absent → `size = 400`. Lors de la première hydratation côté client, `computeSize()` calcule une valeur réelle qui peut différer de `400`. React compare le VDOM hydraté avec le HTML streamé et génère un avertissement de mismatch. Le wrapper `<div style={{ width: size, height: size }}>` diverge entre serveur et client.  
- **Reproduction :** Ouvrir la page `/en` sur un écran où `computeSize()` retourne ≠ 400.  
- **Fix suggéré :** Initialiser `size` à `400` (constante) pour le rendu initial, puis le mettre à jour dans un `useEffect(() => { setSize(computeSize()) }, [])` avec un state dédié. Alternativement, rendre le `<div>` wrapper sans dimension fixe côté serveur et laisser le canvas se dimensionner lui-même dans `setupCanvas()`.

---

### F02 — `useEffect` du drag global sans dépendances déclarées → stale closure sur `canDrag` et `subjects`

**[🟠] Stale closure dans le handler `onPointerMove` du drag-to-reorder**

- **Fichier :** `src/components/lab/SubjectGrid.tsx:164-237`
- **Impact :** Le `useEffect` qui attache `onPointerMove`/`onPointerUp` sur `window` a `[]` comme tableau de dépendances. `onPointerMove` utilise `dragIdRef` (ref, OK) mais son corps referme aussi `orderRef` (ref, OK). En revanche, `onPointerUp` appelle `fetch(...)` directement — OK car sans state capturé. **La vraie fuite** : `canDrag` et `subjects` sont capturés dans `handlePointerDown` (défini hors de l'effet), mais `handlePointerDown` est mémorisé par `useCallback` avec `[canDrag, editMode, subjects]` (ligne 162). Si `canDrag` ou `subjects` change, le handler de l'`onPointerDown` React est mis à jour, mais les listeners `window.pointermove/pointerup` ne sont pas ré-enregistrés. Scénario : l'utilisateur modifie les filtres (sujets changent), puis drag → l'`orderRef` initialisé dans `handlePointerDown` avec les anciens `subjects` est incohérent avec le nouveau render.  
  En pratique, `canDrag = false` quand des filtres sont actifs (ligne 82), donc le bug est latent plutôt que systématique. Il reste un code fragile.  
- **Reproduction :** Activer un filtre (rendant `canDrag = false`), désactiver le filtre, puis immédiatement effectuer un drag avant le prochain render complet.  
- **Fix suggéré :** Ajouter `[canDrag, editMode, subjects]` comme dépendances du `useEffect` (et renommer les fonctions internes pour éviter de capturer des valeurs périmées), ou utiliser une ref pour `canDrag`.

---

### F03 — `SubjectCard` n'a pas de directive `'use client'` mais est importé dans un composant client

**[⚪] Nit — non `"use client"` mais pas de RSC**

- **Fichier :** `src/components/lab/SubjectCard.tsx`
- **Impact :** `SubjectCard` ne déclare pas `'use client'`. Il est importé depuis `SubjectGrid.tsx` qui est `'use client'`. Dans Next.js App Router, les imports d'un module client héritent automatiquement du boundary client : le composant fonctionnera. Cependant, si `SubjectCard` est un jour importé depuis un RSC, il échouera car il contient des gestionnaires d'événements (`onClick`, `onDelete`). L'absence de directive est trompeuse.  
- **Reproduction :** N/A (actuellement sans conséquence).  
- **Fix suggéré :** Ajouter `'use client'` en tête de fichier pour expliciter le boundary.

---

### F04 — `FilterSidebar` n'a pas de directive `'use client'` mais utilise `useTranslations` (hook)

**[🟠] Frontière client/serveur : hook client dans un composant sans `'use client'`**

- **Fichier :** `src/components/lab/FilterSidebar.tsx:1-10`
- **Impact :** `FilterSidebar` appelle `useTranslations('lab')` (hook next-intl, client-only) sans déclarer `'use client'`. Il est importé depuis `SubjectGrid.tsx` (client) donc il hérite du boundary. Si Next.js venait à traiter ce fichier comme RSC (ce qui ne peut pas arriver actuellement mais est une bombe à retardement à la refactorisation), l'erreur serait silencieuse jusqu'à runtime. De plus, la règle de projet impose `'use client'` explicite pour tout composant interactif.  
- **Reproduction :** N/A (héritage boundary client implicite).  
- **Fix suggéré :** Ajouter `'use client'` en tête du fichier.

---

### F05 — `CommentsPanel` : pas de gestion d'échec sur `addComment` si `res.ok` est faux

**[🟠] Fetch sans gestion d'erreur visible côté UI**

- **Fichier :** `src/components/paper/CommentsPanel.tsx:29-39`
- **Impact :** Si `fetch('/api/comments', { method: 'POST' })` retourne un statut d'erreur (`res.ok === false`), le bloc `if (res.ok)` est ignoré silencieusement. L'utilisateur ne reçoit aucun feedback : le commentaire n'apparaît pas, le champ n'est pas réinitialisé, aucun message d'erreur n'est affiché. Idem pour `remove()` : `if (res.ok) setComments(...)` — en cas d'échec, silence total.  
- **Reproduction :** Déconnecter le réseau ou couper la route API, poster un commentaire.  
- **Fix suggéré :** Ajouter un état d'erreur local + afficher un message si `!res.ok`. Exemple : `else { setError(tc('errorGeneric')) }`.

---

### F06 — `PublicationList` : fetch sans vérification `res.ok`

**[🟠] Fetch sans vérification `res.ok` → JSON parsing d'une réponse d'erreur**

- **Fichier :** `src/components/publications/PublicationList.tsx:95`
- **Impact :** `const data: Publication[] = await r.json()` est appelé sans vérifier `r.ok`. Si l'API retourne une erreur 4xx/5xx, `.json()` parse le corps d'erreur (`{ error: "..." }`) et `setPublications` reçoit un objet non-array. Les filtres et `visible.length` planteront avec une `TypeError` non rattrapée.  
- **Reproduction :** Provoquer une erreur sur `/api/publications?lab=paris` (ex. casser la clé Supabase temporairement).  
- **Fix suggéré :** `if (!r.ok) return` (ou throw) avant `.json()`.

---

### F07 — `AdminProposalsClient` : `load()` sans gestion d'erreur et fire-and-forget

**[🟠] Fetch sans gestion d'erreur et sans état de chargement**

- **Fichier :** `src/components/admin/AdminProposalsClient.tsx:44-48`
- **Impact :** `load()` est défini avec une chaîne de `.then()`. Si `fetch()` échoue (réseau coupé), la promesse rejetée est ignorée sans `.catch()`. Le composant reste figé sur la liste vide sans message d'erreur. De plus, il n'y a pas d'état `loading` : pendant la récupération initiale, la zone de contenu est vide, ce qui peut induire en erreur l'admin.  
- **Reproduction :** Couper le réseau et naviguer vers `/fr/admin/proposals`.  
- **Fix suggéré :** Ajouter `.catch(console.error)` (ou un état d'erreur) et un état `loading`.

---

### F08 — `ProposalTracker` : lecture de `localStorage` dans un `useEffect` mais avec un `Promise.resolve(url)` inutilement complexe

**[🟡] Code mort / style : enchaînement Promise.resolve inutile**

- **Fichier :** `src/components/propose/ProposalTracker.tsx:45-49`
- **Impact :** `Promise.resolve(url).then(u => u ? fetch(u)... : []).then(data => setProposals(data))` — le `Promise.resolve(url)` est redondant : `url` est déjà une valeur synchrone. Le code fonctionne mais est inutilement difficile à lire et masque le cas `url === null`. Pas d'erreur mais code mort/confus.  
- **Reproduction :** N/A.  
- **Fix suggéré :** `if (!url) { setProposals([]); return } ; fetch(url).then(...).then(setProposals)`.

---

### F09 — `AddPublicationModal` : `new Date().getFullYear()` comme valeur initiale de state

**[🟡] Hydratation : valeur dynamique utilisée comme état initial**

- **Fichier :** `src/components/publications/AddPublicationModal.tsx:45,54`
- **Impact :** `useState<number>(new Date().getFullYear())` et `setAnnee(new Date().getFullYear())` dans `reset()`. L'appel `new Date()` lors du rendu SSR utilise l'heure serveur ; côté client, l'hydratation pourrait diverger en théorie (changer d'année à minuit). En pratique, la modal est un composant client `'use client'` qui n'est pas pré-rendu SSR de façon meaningful (elle n'est rendue que quand `open=true`), donc le risque est très faible. Mais c'est un anti-pattern à signaler.  
- **Reproduction :** Très improbable (changement à minuit exactement).  
- **Fix suggéré :** Calculer la valeur dans un `useEffect` ou la passer en prop depuis le RSC parent.

---

### F10 — `Globe.tsx` : `fameSpin` / `fameSpinRev` animations utilisées mais non définies dans `globals.css`

**[🟠] Animations CSS inconnues → globe orbitaux invisibles / comportement indéfini**

- **Fichier :** `src/components/globe/Globe.tsx:304,307,310,314`
- **Impact :** Les anneaux orbitaux du globe utilisent `animation: 'fameSpin 64s linear infinite'` et `fameSpinRev`. Ces keyframes ne sont pas définies dans `src/app/globals.css` (qui liste `fameFade`, `famePulse`, `fameTwinkle`, `modalIn`, `toastIn`). Les anneaux orbitaux ne tourneront pas — les animations CSS seront silencieusement ignorées par le navigateur. Visuellement, les rings seront statiques.  
- **Reproduction :** Ouvrir la page d'accueil et inspecter les anneaux SVG.  
- **Fix suggéré :** Ajouter dans `globals.css` :
  ```css
  @keyframes fameSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes fameSpinRev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
  ```

---

### F11 — `Globe.tsx` : le `loadAtlas()` CDN fallback n'a pas de gestion d'échec explicite

**[🟡] Réseau : fallback CDN sans vérification `res.ok`**

- **Fichier :** `src/components/globe/Globe.tsx:249-251`
- **Impact :** Dans le fallback CDN, `const res = await fetch(cdnUrl)` suivi de `world = await res.json()` ne vérifie pas `res.ok`. Si le CDN est indisponible, `.json()` parse un body d'erreur HTML → exception JSON.parse rejetée, rattrapée par `.catch(console.error)` (ligne 257). La carte reste sans continents. Acceptable en dégradé mais peut être amélioré.  
- **Reproduction :** Bloquer `cdn.jsdelivr.net` et supprimer `/public/world-110m.json`.  
- **Fix suggéré :** Ajouter `if (!res.ok) throw new Error('CDN fetch failed')` avant `.json()`.

---

### F12 — `SubjectGrid.tsx` : liste de sujets rendus avec `key={s.id}` (stable ✓) mais `key={i}` dans `AddTaskModal` pour subtasks

**[🟡] Liste avec `key` index dans une liste mutable**

- **Fichier :** `src/components/tasks/AddTaskModal.tsx:159`
- **Impact :** `subtasks.map((s, i) => <div key={i}>` — l'index est utilisé comme clé d'une liste mutable (les sous-tâches peuvent être supprimées). Supprimer la 2e sous-tâche d'une liste de 3 forcera React à patcher les 2 nœuds restants plutôt que d'en supprimer un. Bug visuel potential (états d'input non synchronisés) si les éléments contenaient des champs controlled.  
- **Reproduction :** Ajouter 3 sous-tâches, supprimer la 2e, observer que les textes restent bien positionnés (actuellement OK car le span est stateless) — mais fragilité structurelle.  
- **Fix suggéré :** Générer un `id` unique par sous-tâche (`crypto.randomUUID()`) à l'ajout et l'utiliser comme key.

---

### F13 — `PaperView.tsx` : liste GHOSTS avec `key={i}` (index)

**[⚪] Nit — liste statique avec key index**

- **Fichier :** `src/components/paper/PaperView.tsx:96`
- **Impact :** `{GHOSTS.map((g, i) => <div key={i}` — la liste `GHOSTS` est constante et ne change jamais, donc la key index ne cause aucun bug. Mais c'est stylistiquement inconsistant avec les bonnes pratiques React.  
- **Reproduction :** N/A.  
- **Fix suggéré :** Ajouter un champ `id` dans `GHOSTS` ou utiliser un index préfixé : `key={`ghost-${i}`}`.

---

### F14 — `PaperSheet.tsx` : `new Date(subject.created_at).toLocaleDateString(locale, {...})` au rendu serveur

**[🟡] Hydratation : `new Date()` + `toLocaleDateString` dépend du fuseau horaire serveur**

- **Fichier :** `src/components/paper/PaperSheet.tsx:14`
- **Impact :** `const dateLabel = new Date(subject.created_at).toLocaleDateString(locale, { month: 'long', year: 'numeric' })` est calculé dans le rendu du composant. `PaperSheet` est marqué `'use client'` donc il s'hydrate côté client. La valeur calculée côté client peut différer du HTML SSR streamé si les fuseaux horaires divergent (serveur UTC, client UTC+N). En pratique, pour une date de type `YYYY-MM-DD`, le risque est faible mais réel (fin de mois à minuit UTC+12).  
- **Reproduction :** Visiter la fiche d'un sujet créé le 1er du mois depuis un client UTC+12.  
- **Fix suggéré :** Parser la date comme `subject.created_at.slice(0, 10)` (string ISO date sans TZ) et utiliser `new Intl.DateTimeFormat(locale, { ..., timeZone: 'UTC' })`.

---

### F15 — `CommentsPanel.tsx` : `new Date(c.created_at).toLocaleDateString()` sans locale ni timezone

**[🟡] Hydratation + i18n : format de date dépendant du contexte d'exécution**

- **Fichier :** `src/components/paper/CommentsPanel.tsx:68`
- **Impact :** `new Date(c.created_at).toLocaleDateString()` sans argument utilise la locale système du navigateur. Si la page SSR-streame cette valeur (elle est dans un composant `'use client'` donc non — elle est rendue uniquement côté client), ce n'est pas un problème de mismatch mais c'est incohérent avec le système i18n (la locale `fr`/`en` n'est pas respectée).  
- **Reproduction :** Passer d'une locale à l'autre (`en`/`fr`) et observer que les dates dans les commentaires ne changent pas de format.  
- **Fix suggéré :** Utiliser `useLocale()` et passer la locale : `new Date(c.created_at).toLocaleDateString(locale)`.

---

### F16 — `ProposalTracker.tsx` : `new Date(p.created_at).toLocaleDateString()` sans locale

**[🟡] i18n : format de date sans locale**

- **Fichier :** `src/components/propose/ProposalTracker.tsx:175`
- **Impact :** Identique à F15 — la date de la proposition est affichée sans respecter la locale `en`/`fr`.  
- **Reproduction :** Même que F15.  
- **Fix suggéré :** `new Date(p.created_at).toLocaleDateString(locale)` (la locale est déjà disponible via `useTranslations` — récupérer via `useLocale()`).

---

### F17 — `Globe.tsx` : `pinRefs` recréé à chaque render → référence instable

**[🟡] Référence : objet `pinRefs` recréé sans `useMemo`**

- **Fichier :** `src/components/globe/Globe.tsx:55-58`
- **Impact :** `const pinRefs: Record<LabKey, React.RefObject<...>> = { paris: parisRef, montreal: montRef }` est recréé à chaque render. L'objet lui-même n'est pas utilisé dans un `useEffect` (il est utilisé dans `updatePins()` défini à l'intérieur du `useEffect` principal, donc capturé au moment du montage uniquement). Comme `updatePins` est défini dans le closure de l'effet `[]`, `pinRefs` y est capturé une fois — et les refs elles-mêmes (`parisRef`, `montRef`) sont stables. Pas de bug réel mais objet inutilement alloué à chaque render.  
- **Reproduction :** N/A (perf micro, pas de bug).  
- **Fix suggéré :** `const pinRefs = useMemo(() => ({ paris: parisRef, montreal: montRef }), [])`.

---

### F18 — `MemberCard.tsx` et `PublicationList.tsx` : gestion hover inline via `onMouseEnter`/`onMouseLeave`

**[⚪] Nit — mutation directe du style via `e.currentTarget.style`**

- **Fichier :** `src/components/team/MemberCard.tsx:64-76,103-114`, `src/components/publications/PublicationList.tsx:424-434`
- **Impact :** Les effets hover sont implémentés avec `onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#c0473b'}`. Cette approche contourne React et mute le DOM directement. En mode développement strict (React 19 double-render), ces mutations peuvent se retrouver dans un état inconsistant. Visuellement fonctionnel, mais anti-pattern React.  
- **Reproduction :** N/A.  
- **Fix suggéré :** Utiliser un état `hovered` React ou des classes CSS (`:hover` via Tailwind).

---

### F19 — `SubjectGrid.tsx` : `dateBucket` dupliquée entre `SubjectGrid.tsx` et `FilterSidebar.tsx`

**[⚪] Nit — code mort dupliqué**

- **Fichier :** `src/components/lab/SubjectGrid.tsx:14-20`, `src/components/lab/FilterSidebar.tsx:8-13`
- **Impact :** La fonction `dateBucket(s: Subject): DateBucket` est définie identiquement dans les deux fichiers. Le type `DateBucket` également. Pas de bug, mais maintenance double.  
- **Reproduction :** N/A.  
- **Fix suggéré :** Extraire dans un fichier partagé `src/lib/subject-utils.ts`.

---

### F20 — `KanbanBoard.tsx` : `bucket()` (fn interne) utilise `t2` comme paramètre pour éviter conflit avec `t` (i18n) — nommage fragile

**[⚪] Nit — nommage potentiellement confus**

- **Fichier :** `src/components/tasks/KanbanBoard.tsx:104`
- **Impact :** `function bucket(t2: TaskWithRelations)` — renommé `t2` pour éviter le conflit avec `const t = useTranslations('tasks')`. Si quelqu'un rename `t` en `tBoard` ou similar, `t2` devient confus. Pas de bug.  
- **Reproduction :** N/A.  
- **Fix suggéré :** Renommer le paramètre `task` ou `tk` (cohérent avec le reste du composant).

---

### F21 — `PromptCard.tsx` : `handleDelete` appelle `fetch` sans vérifier `res.ok`, puis `onDeleted` systématiquement

**[🟠] Mutation sans gestion d'erreur côté client**

- **Fichier :** `src/components/prompts/PromptCard.tsx:72-74`
- **Impact :** 
  ```typescript
  async function handleDelete() {
    setConfirmOpen(false)
    await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' })
    onDeleted(prompt.id)
  }
  ```
  `onDeleted` est appelé **même si la suppression a échoué** (réseau coupé, 500 serveur). Le prompt disparaît du state local mais reste en base — désynchronisation silencieuse.  
- **Reproduction :** Couper le réseau, supprimer un prompt → il disparaît de l'UI mais est toujours en BDD.  
- **Fix suggéré :** Vérifier `res.ok` avant d'appeler `onDeleted` :
  ```typescript
  const res = await fetch(...)
  if (res.ok) onDeleted(prompt.id)
  else { /* show error */ }
  ```

---

### F22 — `Globe.tsx` : `loadAtlas()` sans cleanup → si le composant se démonte pendant le fetch, setState sur composant démonté

**[🟠] Fuite mémoire potentielle / setState sur composant démonté**

- **Fichier :** `src/components/globe/Globe.tsx:242-257`
- **Impact :** `loadAtlas()` est une fonction async appelée via `loadAtlas().catch(console.error)`. Si le composant se démonte avant la résolution du fetch (navigation rapide), `state.mounted` est mis à `false` (ligne 261), et la vérification `if (!state.mounted) return` (ligne 252) protège l'assignation à `state.land`/`state.borders` mais pas l'appel à `draw()` ligne 255 qui accède au `canvas` (déjà démonté). Cela peut provoquer une exception silencieuse dans `getContext('2d')` si le canvas a été GC-ed.  
- **Reproduction :** Naviguer très rapidement vers et depuis la page d'accueil.  
- **Fix suggéré :** La vérification `if (!state.mounted) return` avant `draw()` ligne 255 (déplacer le `return` avant le `draw()`).

---

### F23 — `DataExplorer.tsx` : `toggleExpand` mémorisé avec `[expanded, childrenById]` → recréé à chaque expansion

**[🟡] Performance : `useCallback` avec dépendances lourdes recréé à chaque interaction**

- **Fichier :** `src/components/data/DataExplorer.tsx:140-164`
- **Impact :** `toggleExpand` est `useCallback(async (...) => { ... }, [expanded, childrenById])`. À chaque expansion d'un dossier, `expanded` et `childrenById` changent → `toggleExpand` est recréé → tous les composants enfants qui reçoivent cette prop sont re-rendus. Avec des arborescences Dropbox larges, cela peut causer des stutters.  
- **Reproduction :** Ouvrir une arborescence Dropbox profonde avec de nombreux dossiers.  
- **Fix suggéré :** Utiliser des refs pour `expanded` et `childrenById` dans la logique de toggle, ou reconstruire la logique via des fonctions setter `setState(prev => ...)` qui n'ont pas besoin de refermer sur l'état courant.

---

### F24 — `PaperNav.tsx` : `<Link href="#">` quand `prev`/`next` est null

**[🟡] Pattern Next 16 : lien `#` sur flèche de nav**

- **Fichier :** `src/components/paper/PaperNav.tsx:29,44`
- **Impact :** `<Link href={prev ? href(prev.id) : '#'}` — quand `subjects` est vide ou a un seul élément, la flèche est un lien vers `#` qui ne fait rien visuellement. Mais si l'utilisateur clique, Next.js `<Link>` navigue vers `#` (scroll en haut de page). Ce n'est pas un crash mais une UX incorrecte.  
- **Reproduction :** Afficher la fiche d'un sujet quand il est le seul sujet du labo. Cliquer sur les flèches.  
- **Fix suggéré :** Rendre les boutons non-cliquables (`aria-disabled`, `pointer-events: none`) quand `prev`/`next` est null. Ou utiliser `<button>` à la place de `<Link>` pour les cas null.

---

### F25 — `PromptLibrary.tsx` : `reloadKey` utilisé pour forcer re-fetch mais `handleDeleted` appelle aussi `reload()` en plus de mettre à jour le state local

**[⚪] Nit — double mise à jour state inutile**

- **Fichier :** `src/components/prompts/PromptLibrary.tsx:86-90`
- **Impact :** `handleDeleted` fait `setPrompts(prev => prev.filter(...))` (mise à jour optimiste locale) ET `reload()` (incrémente `reloadKey` → refetch). Le refetch est redondant puisque l'état local est déjà synchronisé. Cela cause un render supplémentaire et un appel API inutile.  
- **Reproduction :** Supprimer un prompt — deux re-renders observables.  
- **Fix suggéré :** Retirer `reload()` de `handleDeleted`, car `setPrompts` suffit.

---

### F26 — `SubjectGrid.tsx` : `'use client'` présent, `FilterSidebar` importé sans `'use client'`

**[⚪] Nit (voir aussi F04) — propagation implicite du boundary**

(Voir F04 pour détail complet — même finding, redondance mentionnée ici pour compléter la piste.)

---

### F27 — `locale` déduit via `useParams()` dans `SubjectGrid.tsx` au lieu d'être passé en prop

**[🟡] Couplage implicite au routing**

- **Fichier :** `src/components/lab/SubjectGrid.tsx:57-58`
- **Impact :** `const params = useParams()` et `const locale = (params?.locale as string) ?? 'en'` — le composant est couplé à la structure URL `[locale]/[lab]`. Si la structure de route change, le composant se brisera silencieusement avec `locale = 'en'` par défaut. La locale est déjà disponible dans le parent (`LabPage` → `layout.tsx`) — elle pourrait être passée en prop.  
- **Reproduction :** Déplacer `SubjectGrid` dans un contexte sans segment `[locale]`.  
- **Fix suggéré :** Ajouter `locale: string` aux props de `SubjectGrid` et le passer depuis `LabPage`.

---

## Tableau récapitulatif

| ID | Sévérité | Titre court | Fichier |
|----|----------|-------------|---------|
| F01 | 🟠 | `window` au rendu initial → hydratation mismatch | `Globe.tsx:272` |
| F02 | 🟠 | Stale closure drag `useEffect` `[]` | `SubjectGrid.tsx:164` |
| F03 | ⚪ | `SubjectCard` sans `'use client'` (héritage) | `SubjectCard.tsx` |
| F04 | 🟠 | `FilterSidebar` hook sans `'use client'` | `FilterSidebar.tsx:1` |
| F05 | 🟠 | `CommentsPanel` : pas de feedback si fetch échoue | `CommentsPanel.tsx:29` |
| F06 | 🟠 | `PublicationList` : `fetch` sans vérif `res.ok` | `PublicationList.tsx:95` |
| F07 | 🟠 | `AdminProposalsClient` : `load()` sans `.catch` ni état loading | `AdminProposalsClient.tsx:44` |
| F08 | 🟡 | `ProposalTracker` : `Promise.resolve` redondant | `ProposalTracker.tsx:47` |
| F09 | 🟡 | `new Date().getFullYear()` comme état initial | `AddPublicationModal.tsx:45` |
| F10 | 🟠 | Keyframes `fameSpin`/`fameSpinRev` non définies | `Globe.tsx:304`, `globals.css` |
| F11 | 🟡 | Fallback CDN sans vérif `res.ok` | `Globe.tsx:249` |
| F12 | 🟡 | `key={i}` index sur liste mutable de sous-tâches | `AddTaskModal.tsx:159` |
| F13 | ⚪ | `key={i}` sur liste statique GHOSTS | `PaperView.tsx:96` |
| F14 | 🟡 | `toLocaleDateString` dépend du TZ serveur | `PaperSheet.tsx:14` |
| F15 | 🟡 | `toLocaleDateString()` sans locale dans commentaires | `CommentsPanel.tsx:68` |
| F16 | 🟡 | `toLocaleDateString()` sans locale dans ProposalTracker | `ProposalTracker.tsx:175` |
| F17 | 🟡 | `pinRefs` recréé sans `useMemo` | `Globe.tsx:55` |
| F18 | ⚪ | Mutation DOM directe via `onMouseEnter` style | `MemberCard.tsx:64`, `PublicationList.tsx:424` |
| F19 | ⚪ | `dateBucket` dupliquée | `SubjectGrid.tsx:14`, `FilterSidebar.tsx:8` |
| F20 | ⚪ | Paramètre `t2` nommage fragile | `KanbanBoard.tsx:104` |
| F21 | 🟠 | `PromptCard.handleDelete` appelle `onDeleted` même si échec | `PromptCard.tsx:72` |
| F22 | 🟠 | `loadAtlas` : `draw()` après démontage composant | `Globe.tsx:255` |
| F23 | 🟡 | `toggleExpand` useCallback dépend de states lourds | `DataExplorer.tsx:140` |
| F24 | 🟡 | `<Link href="#">` pour flèches nav null | `PaperNav.tsx:29,44` |
| F25 | ⚪ | `handleDeleted` appelle `reload()` inutile | `PromptLibrary.tsx:87` |
| F27 | 🟡 | `locale` via `useParams()` au lieu de prop | `SubjectGrid.tsx:57` |

---

## Résumé par sévérité

| Sévérité | Nombre |
|----------|--------|
| 🔴 Critique (casse / secret exposé) | **0** |
| 🟠 Bug fonctionnel / fuite mémoire / mutation hors API | **9** |
| 🟡 Edge case / re-render / UX dégradée | **10** |
| ⚪ Nit / code mort / style | **7** |
| **Total** | **26** |

---

*Aucun fichier source n'a été modifié. Rapport généré en lecture seule.*
