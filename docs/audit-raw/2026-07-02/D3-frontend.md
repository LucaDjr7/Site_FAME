# D3 — Frontend / React (Sonnet, lecture seule)

Aucune fuite confidentielle côté client, aucune mutation Supabase directe. Gate `confidentiel` cohérente (graphe/relations/fichiers).

## 🟠 High
- **CommentsPanel : `toLocaleDateString()` sans locale** (`CommentsPanel.tsx:84`) → mismatch d'hydratation SSR/client dès qu'un sujet a un commentaire. Fix : passer `locale` (cf. PaperSheet.tsx:40). *(Adjudiqué Medium en consolidation : warning + flash de format, pas de casse.)*

## 🟡 Medium
- `RelationGraph.deleteLink` : pas de `res.ok` → suppression d'arête sans feedback d'échec.
- Filtre du graphe réinitialise pan/zoom + relance toute la simulation à chaque changement.
- `useAssistantChat` : pas d'`AbortController` → stream SSE continue après démontage (coût LLM).
- `FilesPanel` : message d'erreur générique masque le stade d'échec ; orphelin Storage possible si register échoue.
- Admin : `window.confirm()` au lieu de `ConfirmDialog` ; `toggle()`/`reindex()` sans garde double-clic.

## ⚪ Low
- Props mortes `logsHref`/`backHref` (+`<a>` interne latent) ; ref callback recréé chaque rendu ; heuristique `router.back()` (limite connue) ; `AuthButton.signOut` sans try/catch.
