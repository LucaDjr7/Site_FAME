# D6 — Perf · a11y · UX · SEO (Sonnet, lecture seule)

## 🟠 High (a11y — aucun ne bloque le lancement d'un outil interne desktop-first)
- **VitrineEditor : `role="dialog"` sans focus-trap / Escape / restauration de focus** (`VitrineEditor.tsx:314`, aucun useEffect). Le plus gros formulaire du site. Fix : reposer sur le composant `Modal` partagé.
- **linkChooser du graphe : overlay sans sémantique modale ni clavier** (`RelationGraph.tsx:592`).
- **Boutons ✕/✎ de SubjectVitrine : nom accessible ambigu** (`title` seul, pas `aria-label`) sur action destructive (`SubjectVitrine.tsx:47-52`).

## 🟡 Medium
- Pas d'`aria-expanded`/`aria-pressed` (FilesPanel/RelationsPanel/filtres graphe).
- Nœuds du graphe : pan/zoom sans équivalent clavier, focus hors écran sans scrollIntoView.
- ChatComposer `<textarea>` sans label/aria-label.
- Réponses SSE assistant non annoncées (pas d'`aria-live`/`role=log`).
- `/graph` absent du sitemap + sans meta description ; `/assistant` sans `generateMetadata` (hérite du titre home).
- `import * as d3 from 'd3'` (bundle complet) dans RelationGraph + Globe.
- Simulation d3-force ignore `prefers-reduced-motion`.
- Génération ✨ silencieuse si `text` vide (pas de toast) — VitrineEditor / TaskModal.

## ⚪ Low
- Pas de `loading.tsx` pour `/graph` ; toggle cadenas/suppression fichier sans loading state ni toast succès ; `deleteLink` confirm non désactivé pendant la requête.

Non re-signalé (statu quo documenté) : badge Confidentiel dans l'ancre de download ; rognage zoom en bord de scrollport.
