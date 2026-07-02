# D4 — Qualité & Dette (Sonnet, lecture seule)

Aucun 🔴, aucune régression sécurité. Périmètre : delta post-28/06.

## 🟡 Medium
- **Triple duplication subjects/tasks** (~390 lignes) : `field-prompts.ts`, `generate-field.ts`, `translate.ts` quasi identiques ; `MAX_OUT` de `tasks/translate.ts` (1200) n'a pas bénéficié du calibrage de `subjects` (900→2000). Fix : extraire une base générique paramétrée.
- **Type `Locale` redéfini** localement au lieu de `Locale2` de `@/types` (`field-prompts.ts` ×2).
- **`as never` en prod** (`admin/assistant/page.tsx:34-35`) : masque tout futur mismatch de schéma. Fix : `as unknown as T[]` a minima.
- **RelationsPanel : échecs silencieux** (pas de toast) sur suppression de lien / changement d'héritage (incohérent avec handleAdd).
- **`DELETE …/relations/[relId]` : `id` jamais vérifié** vs `relId` (incohérent avec `files/[fileId]`).
- **`RelationGraph.tsx` 703 lignes multi-responsabilités**, sans test composant ; `FilesPanel` sans test (toggle confidentiel sensible).

## ⚪ Low
- Styles hex inline plutôt que tokens `fame-*` (nouveau `RelationsPanel` perpétue la dette de `paper/`).

Sains : `resolveInheritance`/anti-cycle testés (diamant/cycle), extraction texte testée par MIME, confidentialité par doc testée (fail-closed), parité i18n 0/0, pas de code mort résiduel, pas de console.log/TODO dans le delta.
