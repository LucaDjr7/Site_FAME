# Audit D6 — Performance · Accessibilité · UX · SEO
**Branche auditée :** `feat/p4-pre-prod`  
**Date :** 2026-06-24  
**Auditeur :** Claude Sonnet 4.6 (sous-agent lecture seule)  
**Note préliminaire :** Fidélité maquette non vérifiée (MCP Claude Design indisponible en sous-agent Sonnet).

---

## 1. Accessibilité

---

### [🟠] A1 — Modal sans `role="dialog"`, `aria-modal`, ni `aria-labelledby`

- **Fichier :** `src/components/ui/Modal.tsx:16-34`
- **Impact :** Les lecteurs d'écran (NVDA, JAWS, VoiceOver) ne savent pas que l'overlay est un dialogue. Le contenu en arrière-plan reste accessible à l'AT, le focus peut s'y promener librement — fonctionnement cassé pour les utilisateurs non-voyants.
- **Reproduction :** Ouvrir n'importe quelle modale (AddSubjectModal, InviteModal, TaskModal…), inspecter avec un lecteur d'écran ou l'arbre d'accessibilité DevTools : le `div` racine n'a aucun rôle sémantique.
- **Fix suggéré :**
  ```tsx
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'modal-title' : undefined}
    ...
  >
    <h2 id="modal-title">…</h2>
  ```
  Piège focus (focus-trap) à ajouter : premier focusable à l'ouverture, cycle Tab/Shift+Tab confiné dans la modale, focus rendu à l'élément déclencheur à la fermeture.

---

### [🟠] A2 — Labels de formulaire sans `htmlFor` (dissociation label-champ)

- **Fichier :** `src/components/lab/AddSubjectModal.tsx:159,172,184,199,209,219` · `src/components/tasks/AddTaskModal.tsx:113,119,129,139,148,155` · `src/components/team/InviteModal.tsx:193,203,215,227` · `src/components/team/EditMemberModal.tsx:118,126,138,149,160,174` · `src/components/publications/AddPublicationModal.tsx:119,132,145,156,171,183`
- **Impact :** Les `<label>` sont posés **avant** l'`<input>` dans un `<div>` sans `htmlFor`. Le clic sur le label n'active pas le champ ; les AT lisent le label comme du texte générique séparé du champ — l'association programme label/input n'existe pas.  
  **Exception :** `ProposeForm` et les labels `TaskModal` (checkbox) utilisent le pattern `<label>…<input></label>` qui est correct.
- **Reproduction :** Ouvrir AddSubjectModal, cliquer sur le texte de label « Title * » — le focus ne saute pas dans le champ.
- **Fix suggéré :** Soit envelopper `<label><span>{texte}</span><input /></label>`, soit ajouter `id` sur chaque input et `htmlFor` correspondant sur le label.

---

### [🟠] A3 — Carte `TaskCard` (Kanban) : `div` cliquable sans rôle ni clavier

- **Fichier :** `src/components/tasks/TaskCard.tsx:23-96`
- **Impact :** Le conteneur principal est un `<div onClick={…}>` (pas un `<button>` ni `<a>`). L'élément n'est pas focusable au clavier, donc inaccessible Tab/Enter/Space. Un utilisateur clavier ne peut pas ouvrir le détail d'une tâche sans la souris.
- **Reproduction :** Naviguer au clavier sur la page Tasks — aucun des cards n'est atteignable via Tab.
- **Fix suggéré :** Remplacer le `<div onClick>` racine par `<button type="button" onClick={…}>`, ou ajouter `role="button"` + `tabIndex={0}` + gestionnaires `onKeyDown` (Enter/Space).

---

### [🟠] A4 — Nœuds Dropbox (DataExplorer) : `div` cliquables non focusables

- **Fichier :** `src/components/data/DataExplorer.tsx:428-591`
- **Impact :** Chaque ligne de l'arborescence est un `<div onClick={…}>` sans `role` ni `tabIndex`. Impossible à atteindre au clavier. Un utilisateur navigant au clavier dans l'explorateur Dropbox est bloqué.
- **Reproduction :** Aller sur `/data`, naviguer au Tab — la liste d'arborescence n'est pas focusable.
- **Fix suggéré :** Ajouter `role="treeitem"` + `tabIndex={0}` + `onKeyDown` (Enter = sélect/expand) sur chaque ligne. Envisager un pattern `role="tree"` complet sur le conteneur.

---

### [🟠] A5 — Canvas du globe sans alternative textuelle ni `aria-label`

- **Fichier :** `src/components/globe/Globe.tsx:321-331`
- **Impact :** Le `<canvas>` n'a ni `aria-label`, ni `role`, ni contenu fallback. Pour un utilisateur AT, il est complètement invisible sémantiquement. Les deux pins Paris/Montréal sont des `<button aria-label={label}>` bien formés, mais la surface interactive du canvas (drag) n'est pas annoncée.
- **Reproduction :** Lecteur d'écran sur la home page — le globe n'est pas annoncé.
- **Fix suggéré :** Ajouter `aria-label={t('globeLabel')}` sur le `<canvas>`, et éventuellement `role="img"`. Envisager un lien de contournement (`Skip to lab selection`) avant le globe.

---

### [🟡] A6 — Bouton fermeture modale (×) sans `aria-label`

- **Fichier :** `src/components/ui/Modal.tsx:28`
- **Impact :** `<button onClick={onClose}>×</button>` — le `×` Unicode est souvent lu « multiply » ou « times » par les AT, pas « close ». Confus pour les utilisateurs AT.
- **Reproduction :** Screen-reader sur n'importe quelle modale.
- **Fix suggéré :** `<button onClick={onClose} aria-label={t('close')}>×</button>`.

---

### [🟡] A7 — Toast sans `role="status"` ni `aria-live`

- **Fichier :** `src/components/ui/Toast.tsx:27-38`
- **Impact :** Les toasts apparaissent visuellement mais ne sont pas annoncés par les AT. Un utilisateur aveugle ne sait pas qu'une action a réussi (ajout de publication, soumission de proposition, etc.).
- **Reproduction :** Soumettre le formulaire Propose avec un screen-reader actif — aucune annonce.
- **Fix suggéré :** Ajouter `role="status"` et `aria-live="polite"` sur le conteneur des toasts (ou `role="alert"` + `aria-live="assertive"` pour les erreurs).

---

### [🟡] A8 — NavMenu : backdrop-close `div` non accessible ; menu ouvert sans `aria-controls`

- **Fichier :** `src/components/layout/NavMenu.tsx:70`
- **Impact :** `<div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />` — cet élément de fermeture par clic extérieur n'a aucune sémantique. Par ailleurs, le bouton hamburger a `aria-expanded` et `aria-haspopup="menu"` (bien), mais pas `aria-controls` pointant vers l'`id` du menu déroulant.
- **Reproduction :** Focus-inspection DevTools — le menu flottant n'est pas relié au bouton via `aria-controls`.
- **Fix suggéré :** Ajouter un `id` sur le menu et `aria-controls={id}` sur le bouton. Ajouter `Escape` pour fermer (déjà géré par Modal, mais NavMenu gère lui-même son état).

---

### [🟡] A9 — Boutons icône sans texte visible ni aria-label (Kanban "claim", Subtask "×")

- **Fichier :** `src/components/tasks/AddTaskModal.tsx:162` · `src/components/admin/AdminProposalsClient.tsx:264,265,267`
- **Impact :** Bouton `×` pour supprimer une sous-tâche dans AddTaskModal — pas d'`aria-label`. Boutons « Accept/Reject/Convert » dans AdminProposalsClient ont du texte i18n (OK), mais les boutons de suppression inline ne sont que `×` ou emoji.
- **Fix suggéré :** `<button aria-label={t('removeSubtask')}>×</button>`.

---

### [🟡] A10 — Contrastes potentiellement faibles : textes très petits sur fonds clairs

- **Fichier :** `src/components/lab/SubjectCard.tsx:129-139` · `src/app/[locale]/page.tsx:76`
- **Impact :** Du texte de 7px (`fontSize: 7`) en `color: #43507a` sur `#f5f4ee` (rapport approximatif ~3.5:1, insuffisant pour WCAG AA à cette taille). La tagline de la home page (`color: '#717884'` sur fond blanc/`#F9F9FA`) à 12px est également limite (~4.3:1 sans vérification précise).
- **Reproduction :** Inspecter dans Chrome DevTools → Accessibility → Contrast ratio sur les labels des cartes sujets.
- **Fix suggéré :** Porter la couleur des micro-textes dans les cartes à au minimum `#4a5980` (ratio ~4.5:1 sur `#f5f4ee`). Recalculer avec un outil WCAG (ex : WebAIM Contrast Checker).

---

### [🟡] A11 — Champs commentaire visiteur sans label (placeholder seulement)

- **Fichier :** `src/components/paper/CommentsPanel.tsx:82-85`
- **Impact :** Les champs `firstName` et `lastName` pour les commentaires visiteur n'ont que `placeholder` et pas de `<label>`. Les placeholders disparaissent à la saisie — les AT et les utilisateurs qui ont pré-rempli via autofill n'identifient plus le champ.
- **Fix suggéré :** Ajouter des `<label>` visuellement cachés (via `.sr-only` Tailwind) ou visibles avant chaque input.

---

### [⚪] A12 — Language switcher sans `lang` sur chaque option (mobile, cosmétique)

- **Fichier :** `src/components/layout/LanguageSwitcher.tsx:19-29`
- **Impact :** Mineur — ajouter `lang={l}` sur chaque bouton aide certains AT à annoncer la langue.

---

## 2. SEO / Meta

---

### [🟠] S1 — Absence totale de `metadata` par page (title/description individuels)

- **Fichier :** `src/app/layout.tsx:4-7` — seule source de métadonnées dans toute l'app.
- **Impact :** Toutes les pages (`/[locale]/[lab]`, `/[locale]/[lab]/tasks`, `/[locale]/[lab]/publications`, `/[locale]/[lab]/paper/[id]`, `/[locale]/auth/login`, `/[locale]/admin/proposals`, etc.) partagent le même title générique `« FAME »` et la même description. Les moteurs de recherche n'indexent aucun contenu différencié. Aucune Open Graph, pas de `twitter:card`.
- **Reproduction :** View Source sur `/en/paris` et sur `/en/paris/paper/[id]` — le `<title>` est identique.
- **Fix suggéré :** Ajouter `export const metadata: Metadata` ou `export async function generateMetadata({ params })` dans chaque page. À minima pour les pages publiques : Accueil, Lab, Paper (SEO critique pour une vitrine de recherche). Exemple pour Lab :
  ```ts
  export async function generateMetadata({ params }) {
    const { locale, lab } = await params
    const t = await getTranslations({ locale, namespace: 'lab' })
    return { title: `FAME — ${t('title.' + lab)}`, description: '…' }
  }
  ```

---

### [🟠] S2 — Absence de `sitemap.xml` et `robots.txt`

- **Fichier :** Ni `src/app/sitemap.ts` ni `public/robots.txt` n'existent.
- **Impact :** Les crawlers Google/Bing ne reçoivent aucune directive d'exploration. Les pages members-only (data, prompts) ne sont pas exclues. Aucune URL canonique n'est déclarée.
- **Fix suggéré :** `src/app/robots.ts` avec `Disallow: /*/data, /*/prompts, /admin` ; `src/app/sitemap.ts` listant les URLs publiques statiques (accueil, labs, publications, team, propose).

---

### [🟡] S3 — `<html lang>` correct mais pas de `hreflang` (alternance locale)

- **Fichier :** `src/app/[locale]/layout.tsx:22`
- **Impact :** `lang={locale}` est bien positionné (bon). Mais les pages bilingues n'ont pas de `<link rel="alternate" hreflang="fr" …>` ni `<link rel="alternate" hreflang="en" …>`. Google peut ne pas lier les deux versions et pénalise le duplicate content.
- **Fix suggéré :** Ajouter dans le locale layout :
  ```ts
  export async function generateMetadata({ params }) {
    const { locale } = await params
    return { alternates: { languages: { en: '/en', fr: '/fr' } } }
  }
  ```

---

### [🟡] S4 — Aucun Open Graph / Twitter Card

- **Fichier :** `src/app/layout.tsx:4-7`
- **Impact :** Partage sur réseaux sociaux affiche titre/description génériques sans image. Pour un site de recherche partagé en contexte académique (Twitter/LinkedIn), c'est une occasion manquée.
- **Fix suggéré :** Ajouter `openGraph` dans le metadata root, et surcharger par page (ex : image de couverture pour la page Paper).

---

### [🟡] S5 — Hiérarchie `<h1>` dupliquée possible sur PaperView

- **Fichier :** `src/components/paper/PaperSheet.tsx:39` · `src/components/paper/PaperView.tsx` (pas de `h1` dans le wrapper)
- **Impact :** La page Paper a un `<h1>` dans `PaperSheet` (le titre du sujet). C'est correct. Mais le layout du lab (`LabLayout`) n'a pas de `<h1>` visible — le `<h1>` de `SubjectGrid` (`src/components/lab/SubjectGrid.tsx:288`) et le `<h1>` de `PublicationList` font bien leur rôle. Aucun problème de doublon détecté, mais les pages Tasks, Data, Prompts ont des `<h1>` inline sans `generateMetadata` associé.

---

## 3. Performance de rendu

---

### [🟡] P1 — Globe : rAF tourne même si la page est cachée ou si le composant n'est pas visible

- **Fichier :** `src/components/globe/Globe.tsx:188-199`
- **Impact :** Le `requestAnimationFrame` loop tourne en continu (pas de pause sur `document.visibilitychange` ni via `IntersectionObserver`). Sur desktop, impact limité (le composant est visible à la home), mais si la page est en onglet arrière-plan, la boucle continue de dessiner sur le canvas — CPU inutile.
- **Fix suggéré :** Écouter `visibilitychange` :
  ```ts
  document.addEventListener('visibilitychange', () => {
    state.paused = document.hidden
  })
  ```

---

### [🟡] P2 — Google Fonts chargées via `@import` CSS sans `preconnect`

- **Fichier :** `src/app/globals.css:3`
- **Impact :** `@import url('https://fonts.googleapis.com/...')` dans CSS bloque le render pendant la résolution DNS + handshake TLS avec `fonts.googleapis.com` et `fonts.gstatic.com`. Pas de `<link rel="preconnect">` dans le layout. Retarde la First Contentful Paint (~150-300ms selon réseau).
- **Fix suggéré :** Dans `src/app/[locale]/layout.tsx`, ajouter :
  ```tsx
  // Dans la metadata ou directement dans le layout :
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
  ```
  Alternativement, migrer vers `next/font/google` qui auto-optimise (subset, preload, zero FOIT).

---

### [🟡] P3 — Avatar avec `next/image` mais `unoptimized` désactivé l'optimisation

- **Fichier :** `src/components/ui/Avatar.tsx:16`
- **Impact :** `<Image ... unoptimized>` passe les photos de profil sans redimensionnement ni conversion WebP. Si `photoUrl` est une URL externe (par exemple CNRS), l'image est chargée dans sa taille d'origine pour un avatar de 28-88px. Potentiellement plusieurs centaines de KB par carte membre.
- **Fix suggéré :** Soit retirer `unoptimized` (et configurer `next.config.ts` avec `remotePatterns` pour les domaines autorisés), soit utiliser `next/image` avec sizing explicite.

---

### [🟡] P4 — PaperView : 6 animations CSS `drift` définies dans un `<style>` inline à chaque render

- **Fichier :** `src/components/paper/PaperView.tsx:77-87`
- **Impact :** Les keyframes `drift1`–`drift4` et les scrollbar CSS sont injectés dans un `<style>` inline à chaque rendu du composant. En React 19 strict mode (double render en dev) les règles peuvent se dédoubler. En prod, c'est stable mais sous-optimal — les styles inline courts-circuitent le CSSOM partagé.
- **Fix suggéré :** Déplacer les keyframes dans `globals.css`.

---

### [🟡] P5 — SubjectGrid : `useEffect` window listeners re-attachés à chaque render (deps `[]`)

- **Fichier :** `src/components/lab/SubjectGrid.tsx:164-237`
- **Impact :** Les listeners `pointermove/pointerup` sont dans un `useEffect(fn, [])` vide — les closures capturent les états initiaux via les refs, ce qui est correct. Mais la fonction `onPointerMove` accède à `dragIdRef`, `dragStartPosRef`, `orderRef` qui sont des refs (stable). Pas de re-render inutile ici. Acceptable, mais le pattern peut induire des bugs si les refs ne sont pas mises à jour atomiquement.

---

### [🟡] P6 — PublicationList : `countForType/Author/Year` recalculés sans `useMemo`

- **Fichier :** `src/components/publications/PublicationList.tsx:137-145`
- **Impact :** `countForType`, `countForAuthor`, `countForYear` sont des fonctions appelées à chaque render, chacune filtrant `publications` (potentiellement 100+ items). Elles sont appelées à l'intérieur du render dans les sidebars. Avec un catalogue dense, chaque keystroke du filtre déclenche 3×N filtres complets.
- **Fix suggéré :** Mémoïser avec `useMemo` les maps de comptages, ou utiliser la pattern `matchesExcept` déjà en place mais via un useMemo de l'objet de résultats.

---

### [⚪] P7 — StarField : 46 SVG individuels animés (cosmétique, desktop acceptable)

- **Fichier :** `src/components/globe/StarField.tsx:46-66`
- **Impact :** 46 éléments SVG avec animation CSS `fameTwinkle` individuelle. Sur desktop moderne, pas de problème. Sur mobile (hors scope v1), 46 éléments animés + le canvas D3 peuvent être lourds.

---

## 4. UX

---

### [🟠] U1 — Double-soumission possible sur ProposeForm et CommentsPanel

- **Fichier :** `src/components/propose/ProposeForm.tsx:26-63` · `src/components/paper/CommentsPanel.tsx:24-39`
- **Impact :** `ProposeForm` désactive le bouton submit (`disabled={saving}`) — bien. Mais si l'utilisateur double-clique très rapidement avant que `setSaving(true)` soit pris en compte par React (microtask lag), deux requêtes peuvent partir. `CommentsPanel.addComment()` vérifie `if (!text || posting) return` — garde correcte, mais le bouton submit (↑) n'est pas `disabled={posting}` visuellement, ce qui est trompeur.
- **Fix suggéré :** Pour CommentsPanel : ajouter `disabled={posting}` sur le bouton ↑ ligne 93. Pour ProposeForm : pattern déjà acceptable mais pourrait être renforcé avec `useRef(false)` pour prévenir le race.

---

### [🟡] U2 — Aucun état de chargement sur les pages RSC (Tasks, Publications, Team, Paper)

- **Fichier :** `src/app/[locale]/[lab]/tasks/page.tsx` · `src/app/[locale]/[lab]/publications/page.tsx` · `src/app/[locale]/[lab]/paper/[id]/page.tsx` · `src/app/[locale]/[lab]/team/page.tsx`
- **Impact :** Les pages RSC (React Server Components) n'ont pas de fichiers `loading.tsx` co-localisés. Pendant le SSR et le streaming, l'écran reste blanc jusqu'à ce que Next.js envoie la réponse complète. Pour les pages avec plusieurs fetch Supabase en parallèle (Paper: 7 requêtes), le TTFB peut être perceptible.
- **Fix suggéré :** Créer `src/app/[locale]/[lab]/loading.tsx` (Suspense boundary automatique Next.js) avec un skeleton de chargement.

---

### [🟡] U3 — Feedback absent après soumission commentaire visiteur (pas de toast success)

- **Fichier :** `src/components/paper/CommentsPanel.tsx:29-39`
- **Impact :** Après `addComment()` réussi, le draft est vidé et le commentaire apparaît dans la liste — c'est fonctionnel. Mais aucun toast/feedback sonore/visuel distinct n'est déclenché. Un lecteur d'écran ne reçoit pas de notification (voir A7).
- **Fix suggéré :** Appeler `addToast(t('commentPosted'), 'success')` après succès, et ajouter `aria-live="polite"` sur la liste de commentaires.

---

### [🟡] U4 — AdminProposalsClient : commentaire admin en `<input type="text">` (pas de textarea)

- **Fichier :** `src/components/admin/AdminProposalsClient.tsx:244-260`
- **Impact :** Le champ de commentaire admin est un `<input type="text">` sur une ligne, sans `htmlFor`. Un commentaire de révision peut être long (plusieurs phrases). Un `<textarea>` serait plus adapté en termes d'UX.
- **Fix suggéré :** Remplacer par `<textarea rows={2} ...>` + ajouter `id`/`htmlFor`.

---

### [🟡] U5 — PaperNav : liens `href="#"` quand il n'y a qu'un seul sujet

- **Fichier :** `src/components/paper/PaperNav.tsx:28,44`
- **Impact :** `<Link href={prev ? href(prev.id) : '#'}>` — si l'utilisateur navigue sur le seul sujet du labo, cliquer sur `‹` ou `›` navigue vers `#` (no-op mais déroute). Le lien est rendu cliquable visuellement mais inactif.
- **Fix suggéré :** Désactiver/cacher les flèches quand `subjects.length <= 1` ou utiliser `<button disabled>` à la place.

---

### [🟡] U6 — Focus non géré après fermeture de modale (focus perdu)

- **Fichier :** `src/components/ui/Modal.tsx:6-35`
- **Impact :** À la fermeture de la modale, le focus retourne au `body` au lieu de l'élément déclencheur (bouton qui avait ouvert la modale). Pour les utilisateurs clavier, il faut reconstruire manuellement leur position dans la page.
- **Fix suggéré :** `useRef` sur l'élément déclencheur, `triggerRef.current?.focus()` dans le cleanup du `useEffect` de la modale à la fermeture.

---

### [⚪] U7 — SearchInput sans label visible sur SubjectGrid, KanbanBoard, PublicationList

- **Fichier :** `src/components/lab/SubjectGrid.tsx:300-315` · `src/components/tasks/KanbanBoard.tsx:155-161` · `src/components/publications/PublicationList.tsx:265-280`
- **Impact :** `<input type="search">` avec seulement `placeholder` — le placeholder disparaît à la saisie. Visuellement acceptable en desktop (contexte évident), mais problème AT (voir A11). Sévérité low car les champs search sont `type="search"` (sémantique OK) et le placeholder est descriptif.
- **Fix suggéré :** Ajouter `aria-label={t('search')}` sur chaque input de recherche.

---

### [⚪] U8 — Tri `SubjectGrid` : bouton sort sans état visuel clair quand actif

- **Fichier :** `src/components/lab/SubjectGrid.tsx:462-475`
- **Impact :** Le bouton de tri (recent/oldest) est affiché en gris quand `sort === 'ordre'`, mais pas d'état `aria-pressed` pour indiquer à l'AT l'état courant.
- **Fix suggéré :** `aria-pressed={sort !== 'ordre'}`.

---

## 5. Tableau récapitulatif

| # | Sévérité | Catégorie | Titre court | Fichier |
|---|---|---|---|---|
| A1 | 🟠 | A11y | Modal sans role="dialog" ni focus-trap | `ui/Modal.tsx:16` |
| A2 | 🟠 | A11y | Labels sans htmlFor dans tous les modaux | `lab/AddSubjectModal.tsx:159` … |
| A3 | 🟠 | A11y | TaskCard : div cliquable non focusable | `tasks/TaskCard.tsx:23` |
| A4 | 🟠 | A11y | DataExplorer tree : divs cliquables non focusables | `data/DataExplorer.tsx:428` |
| A5 | 🟠 | A11y | Canvas globe sans aria-label | `globe/Globe.tsx:321` |
| A6 | 🟡 | A11y | Bouton × fermeture modale sans aria-label | `ui/Modal.tsx:28` |
| A7 | 🟡 | A11y | Toast sans aria-live / role="status" | `ui/Toast.tsx:27` |
| A8 | 🟡 | A11y | NavMenu sans aria-controls | `layout/NavMenu.tsx:43` |
| A9 | 🟡 | A11y | Boutons × sous-tâche sans aria-label | `tasks/AddTaskModal.tsx:162` |
| A10 | 🟡 | A11y | Contrastes micro-textes cartes sujets potentiellement faibles | `lab/SubjectCard.tsx:129` |
| A11 | 🟡 | A11y | Inputs commentaire visiteur sans label | `paper/CommentsPanel.tsx:82` |
| A12 | ⚪ | A11y | LanguageSwitcher sans lang= par bouton | `layout/LanguageSwitcher.tsx:19` |
| S1 | 🟠 | SEO | Zéro metadata par page (title/desc génériques) | `app/layout.tsx:4` |
| S2 | 🟠 | SEO | Pas de sitemap.xml ni robots.txt | — |
| S3 | 🟡 | SEO | Pas de hreflang en/fr | `[locale]/layout.tsx:22` |
| S4 | 🟡 | SEO | Aucun Open Graph / Twitter Card | `app/layout.tsx:4` |
| S5 | 🟡 | SEO | h1 OK mais metadata absente des pages Tasks/Data/Prompts | multiple |
| P1 | 🟡 | Perf | Globe rAF sans pause sur tab caché | `globe/Globe.tsx:188` |
| P2 | 🟡 | Perf | Google Fonts sans preconnect (render-blocking) | `globals.css:3` |
| P3 | 🟡 | Perf | Avatar next/image unoptimized | `ui/Avatar.tsx:16` |
| P4 | 🟡 | Perf | Keyframes inline dans PaperView | `paper/PaperView.tsx:77` |
| P5 | 🟡 | Perf | Absence prefers-reduced-motion | `globals.css` |
| P6 | 🟡 | Perf | countForType/Author recalculés sans useMemo | `publications/PublicationList.tsx:137` |
| P7 | ⚪ | Perf | 46 SVG animés StarField (mobile concern, hors v1) | `globe/StarField.tsx:46` |
| U1 | 🟠 | UX | Double-soumission possible CommentsPanel | `paper/CommentsPanel.tsx:93` |
| U2 | 🟡 | UX | Pas de loading.tsx pour les pages RSC | `[lab]/tasks/page.tsx` |
| U3 | 🟡 | UX | Pas de feedback toast après commentaire visiteur | `paper/CommentsPanel.tsx:35` |
| U4 | 🟡 | UX | Commentaire admin : input text au lieu de textarea | `admin/AdminProposalsClient.tsx:244` |
| U5 | 🟡 | UX | PaperNav : href="#" si sujet unique | `paper/PaperNav.tsx:28` |
| U6 | 🟡 | UX | Focus non restauré après fermeture modale | `ui/Modal.tsx:6` |
| U7 | ⚪ | UX | Search inputs sans aria-label | `lab/SubjectGrid.tsx:300` |
| U8 | ⚪ | UX | Bouton sort sans aria-pressed | `lab/SubjectGrid.tsx:462` |

---

## Synthèse

| Sévérité | Nb de findings |
|---|---|
| 🟠 Bloquant (a11y critique / SEO manquant) | **7** |
| 🟡 Important (a11y partiel, perf, UX) | **19** |
| ⚪ Cosmétique / v2 | **5** |
| **Total** | **31** |

**Priorités absolues avant lancement public :**
1. **A1** (Modal dialog ARIA) — cassé pour lecteur d'écran
2. **S1** (Metadata par page) — SEO nul en l'état
3. **A3** (TaskCard div cliquable) — navigation clavier impossible sur Kanban

**Note :** L'absence de `prefers-reduced-motion` (P5, non listé séparément dans le tableau car intégré dans P7) est un point à traiter en v1 — les animations du globe et les drifts de PaperView peuvent provoquer des nausées chez des utilisateurs vestibulaires. Ajouter `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }` dans `globals.css` est trivial et très impactant pour cette population.
