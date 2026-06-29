# FAME — Lot de modifs, Plan 2 : UI / Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton retour sur la page RGPD, rendre la grille des cartes vitrine responsive selon l'appareil, corriger la troncature des mots-clés, et combler le vide de la page sujet en ajustant l'existant.

**Architecture:** Modifications de présentation uniquement (CSS inline + un lien i18n) — aucune migration, aucun changement de données. On réutilise le composant `FitText` existant et les conventions de style en place.

**Tech Stack:** Next.js 16 (App Router, RSC + client components), React 19, Tailwind CSS v4, next-intl.

## Global Constraints

- i18n **EN + FR à parité stricte** (test `src/messages-parity.test.ts`) — ajouter chaque clé dans `messages/en.json` **et** `messages/fr.json`. Zéro chaîne UI hardcodée.
- Tokens couleur via `fame-*` quand on touche des classes Tailwind ; ne jamais retirer `@config` de `globals.css`.
- Ne pas régresser : `npx tsc --noEmit`, `npm run lint`, `npm run build`, suite de tests verte. Commits atomiques.
- Présentation seule : pas de nouvelle dépendance, pas de changement d'API/DB.

---

## File Structure

**Modifiés**
- `src/app/[locale]/privacy/page.tsx` — lien retour en tête.
- `messages/en.json` + `messages/fr.json` — clé `privacy.back`.
- `src/components/lab/SubjectGrid.tsx:391-398` — grille adaptative.
- `src/components/lab/SubjectVitrine.tsx:84-88` — mots-clés sans troncature.
- `src/components/paper/PaperSheet.tsx:27-32,100-102` — fiche élargie + placeholder figure retiré.
- `src/components/paper/TasksPanel.tsx:39` — cap de hauteur assoupli.
- `src/components/paper/CommentsPanel.tsx:77` — cap de hauteur assoupli.

**Créés (tests)**
- `src/app/[locale]/privacy/privacy-back.test.tsx`
- `src/components/lab/SubjectVitrine.test.tsx` (cas mots-clés)

---

## B1 — Bouton retour sur la page RGPD

### Task 1: Lien retour localisé sur `/privacy`

**Files:**
- Modify: `src/app/[locale]/privacy/page.tsx`
- Modify: `messages/en.json` + `messages/fr.json`
- Test: `src/app/[locale]/privacy/privacy-back.test.tsx`

**Interfaces:**
- Consumes: `getTranslations({ locale, namespace: 'privacy' })` (déjà en place), `Link` de `next/link`.
- Produces: un `<a>`/`<Link>` vers `/${locale}` avec le libellé `t('back')`.

- [ ] **Step 1: Ajouter la clé i18n** (parité)

Dans `messages/en.json`, dans l'objet `"privacy"`, ajouter :

```json
"back": "← Back to site"
```

Dans `messages/fr.json`, dans l'objet `"privacy"`, ajouter :

```json
"back": "← Retour au site"
```

- [ ] **Step 2: Écrire le test (échoue)**

Create `src/app/[locale]/privacy/privacy-back.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPage from './page'

describe('Privacy back link', () => {
  it('rend un lien retour localisé vers l’accueil', async () => {
    // La page est un Server Component async : on l'await pour obtenir l'arbre.
    const ui = await PrivacyPage({ params: Promise.resolve({ locale: 'fr' }) })
    render(ui)
    const link = screen.getByRole('link', { name: /Retour au site/i })
    expect(link.getAttribute('href')).toBe('/fr')
  })
})
```

> Si le rendu d'un RSC async échoue dans l'environnement de test (next-intl `getTranslations` nécessite un contexte de requête), remplacer ce test par un test de présence de la clé i18n : `expect(fr.privacy.back).toMatch(/Retour/)`. Documenter le choix dans le commit.

- [ ] **Step 3: Vérifier l'échec**

Run: `npx vitest run src/app/[locale]/privacy/privacy-back.test.tsx`
Expected: FAIL (pas de lien).

- [ ] **Step 4: Implémenter**

In `src/app/[locale]/privacy/page.tsx` :
- Ajouter l'import : `import Link from 'next/link'`.
- Juste après l'ouverture de `<div className="max-w-2xl mx-auto py-16 px-6">` (ligne ~21), avant le `<h1>`, insérer :

```tsx
      <Link
        href={`/${locale}`}
        className="font-mono inline-block mb-6 text-sm text-fame-blue hover:underline"
      >
        {t('back')}
      </Link>
```

- [ ] **Step 5: Vérifier le test + parité**

Run: `npx vitest run src/app/[locale]/privacy/privacy-back.test.tsx && npx vitest run src/messages-parity.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/privacy/page.tsx src/app/[locale]/privacy/privacy-back.test.tsx messages/en.json messages/fr.json
git commit -m "feat(privacy): bouton retour localisé sur la page RGPD"
```

---

## B3 — Cartes vitrine responsive + mots-clés non tronqués

### Task 2: Grille adaptative à la largeur de l'appareil

**Files:**
- Modify: `src/components/lab/SubjectGrid.tsx:391-398`

**Interfaces:**
- Aucune signature changée — uniquement la valeur `gridTemplateColumns`.

> Cause du problème : `repeat(5, minmax(0, 1fr))` impose **toujours 5 colonnes**, donc sur un écran plus petit chaque carte rétrécit et le texte se tasse. `repeat(auto-fill, minmax(190px, 1fr))` laisse le navigateur poser autant de colonnes que la largeur le permet (≈190px mini), tombant naturellement à 4/3/2/1 colonnes sur les petits écrans. Les cartes gardent un format A4 lisible partout.

- [ ] **Step 1: Modifier la grille**

In `src/components/lab/SubjectGrid.tsx`, dans le bloc `style` de la grille (lignes ~393-398), remplacer :

```tsx
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: '30px 26px',
                  paddingBottom: 16,
```

par :

```tsx
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                  gap: '30px 26px',
                  paddingBottom: 16,
```

- [ ] **Step 2: Vérifier visuellement le comportement**

Run: `npm run dev` puis ouvrir `http://localhost:3000/fr/paris` et réduire la largeur de la fenêtre.
Expected: le nombre de colonnes diminue progressivement (5 → 4 → 3 → 2 → 1) ; les cartes ne sont plus écrasées sur écran étroit.

- [ ] **Step 3: Non-régression + commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

```bash
git add src/components/lab/SubjectGrid.tsx
git commit -m "feat(vitrine): grille de cartes adaptative selon la largeur d'écran"
```

---

### Task 3: Mots-clés sans troncature sur la carte vitrine

**Files:**
- Modify: `src/components/lab/SubjectVitrine.tsx:84-88`
- Test: `src/components/lab/SubjectVitrine.test.tsx`

**Interfaces:**
- Aucune signature changée.

> Cause : le bloc mots-clés a `maxHeight: 24` (≈ 1 ligne) + `overflow: 'hidden'` + `.slice(0, 3)` → les mots-clés au-delà d'une ligne sont coupés silencieusement. Correctif : laisser le bloc **passer à la ligne** (retirer `maxHeight`/`overflow`), montrer jusqu'à 4 mots-clés, réduire un peu le `gap`. La section navy est en `flex column` avec l'accroche en `flex: 1`, qui absorbe l'espace : une 2ᵉ ligne de mots-clés ne casse pas la mise en page.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/components/lab/SubjectVitrine.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SubjectVitrine } from './SubjectVitrine'
import type { Subject } from '@/types'

const subject = {
  id: '1', labo: 'paris', titre: 'T', kicker: 'AI', question: 'Q?', accroche: 'A', periode: '2025',
  statut: 'active', context: '', method: '', results: '',
  keywords: ['alpha', 'beta', 'gamma', 'delta'], auteurs: [], difficulte: 'easy',
  dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 1,
  is_transversal: false, confidentiel: false, i18n: {}, created_at: '', updated_at: '',
} as unknown as Subject

describe('SubjectVitrine keywords', () => {
  it('affiche plusieurs mots-clés sans conteneur tronqué (pas de maxHeight 24)', () => {
    const { container } = render(
      <SubjectVitrine subject={subject} locale="en" members={[]} editMode={false}
        statusLabel="Active" doneLabel="Done" ficheLabel="Sheet" questionLabel="Question" readLabel="Read" />)
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.getByText('delta')).toBeInTheDocument()
    // Le conteneur des mots-clés ne doit plus imposer une hauteur d'une ligne.
    const kw = screen.getByText('alpha').parentElement as HTMLElement
    expect(kw.style.maxHeight).toBe('')
    expect(kw.style.overflow).not.toBe('hidden')
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/components/lab/SubjectVitrine.test.tsx`
Expected: FAIL (`delta` absent — slice(0,3) ; `maxHeight` = `24px`).

- [ ] **Step 3: Implémenter**

In `src/components/lab/SubjectVitrine.tsx`, remplacer le bloc mots-clés (lignes 84-88) :

```tsx
            {L.keywords.length > 0 && (
              <div className="font-mono" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', fontSize: 8.5, color: '#7fa3d4', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 7, maxHeight: 24, overflow: 'hidden' }}>
                {L.keywords.slice(0, 3).map((k, i) => <span key={i}>{k}</span>)}
              </div>
            )}
```

par :

```tsx
            {L.keywords.length > 0 && (
              <div className="font-mono" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 8.5, color: '#7fa3d4', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 7, rowGap: 4 }}>
                {L.keywords.slice(0, 4).map((k, i) => <span key={i}>{k}</span>)}
              </div>
            )}
```

(Retrait de `maxHeight: 24` et `overflow: 'hidden'` ; `.slice(0, 4)` ; `rowGap` pour aérer la 2ᵉ ligne.)

- [ ] **Step 4: Vérifier le test**

Run: `npx vitest run src/components/lab/SubjectVitrine.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/lab/SubjectVitrine.tsx src/components/lab/SubjectVitrine.test.tsx
git commit -m "fix(vitrine): mots-clés multi-lignes sans troncature sur la carte"
```

---

## B2 — Page sujet : combler le vide (ajustement de l'existant)

### Task 4: Élargir la fiche, retirer le placeholder figure, assouplir les panneaux

**Files:**
- Modify: `src/components/paper/PaperSheet.tsx:27-32` (largeur) + `100-102` (placeholder)
- Modify: `src/components/paper/TasksPanel.tsx:39` (maxHeight)
- Modify: `src/components/paper/CommentsPanel.tsx:77` (maxHeight)
- Test: `src/components/paper/PaperSheet.test.tsx`

**Interfaces:**
- Aucune signature changée — présentation seule.

> Sources du vide : (1) la fiche centrale est plafonnée à `740px` → larges gouttières latérales sur grands écrans ; (2) le **placeholder figure** strié (hauteur fixe 150px) est **toujours** affiché et se lit comme une zone vide/manquante ; (3) les panneaux latéraux ont des `maxHeight` serrés (300/210) qui bornent le contenu trop tôt.
> Sécurité de la largeur : on relève seulement le **max** du `clamp` (740 → 880) sans toucher la soustraction `calc(100vw - 700px)`. La fiche ne dépasse 740px qu'au-delà de ~1440px de large, et 880px qu'au-delà de ~1580px ; les panneaux (300px + marges, ≈628px réservés) restent toujours logés dans les 700px réservés. Pas de collision.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/components/paper/PaperSheet.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { PaperSheet } from './PaperSheet'
import en from '../../../messages/en.json'
import type { Subject } from '@/types'

const subject = {
  id: '1', labo: 'paris', titre: 'T', kicker: 'AI', question: 'Q?', accroche: 'A hook', periode: '2025',
  statut: 'active', context: 'Some context', method: '', results: '',
  keywords: ['a'], auteurs: [], difficulte: 'easy',
  dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 1,
  is_transversal: false, confidentiel: false, i18n: {}, created_at: '2025-01-01', updated_at: '',
} as unknown as Subject

function wrap() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PaperSheet subject={subject} members={[]} labName="Paris" locale="en" />
    </NextIntlClientProvider>)
}

describe('PaperSheet layout', () => {
  it('élargit la fiche (clamp max 880px)', () => {
    const { container } = wrap()
    const article = container.querySelector('article') as HTMLElement
    expect(article.style.width).toContain('880px')
  })
  it('ne rend plus le placeholder figure greeké', () => {
    const { container } = wrap()
    // L'ancien placeholder utilisait un fond repeating-linear-gradient strié + caption.
    const greeked = Array.from(container.querySelectorAll('div')).find(d => d.style.background.includes('repeating-linear-gradient'))
    expect(greeked).toBeUndefined()
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/components/paper/PaperSheet.test.tsx`
Expected: FAIL (width contient `740px` ; placeholder présent).

- [ ] **Step 3: Élargir la fiche**

In `src/components/paper/PaperSheet.tsx`, ligne 29, remplacer :

```tsx
      width: 'clamp(420px, calc(100vw - 700px), 740px)', pointerEvents: 'auto', overflowY: 'auto',
```

par :

```tsx
      width: 'clamp(420px, calc(100vw - 700px), 880px)', pointerEvents: 'auto', overflowY: 'auto',
```

- [ ] **Step 4: Retirer le placeholder figure**

In `src/components/paper/PaperSheet.tsx`, supprimer les lignes 100-102 :

```tsx
        {/* Figure placeholder */}
        <div style={{ borderRadius: 6, background: 'repeating-linear-gradient(135deg,#e4e2d6 0 9px,#eceadf 9px 18px)', height: 150, position: 'relative', marginBottom: 8 }} />
        <p className="font-mono" style={{ margin: '0 0 22px', fontSize: 9.5, color: '#9a9684' }}>{t('figurePlaceholder')}</p>
```

(La clé i18n `paper.figurePlaceholder` devient inutilisée — la laisser en place ne casse pas la parité ; ne pas la retirer pour éviter de toucher les deux fichiers messages.)

- [ ] **Step 5: Assouplir les panneaux**

In `src/components/paper/TasksPanel.tsx`, ligne 39, remplacer `maxHeight: 300` par `maxHeight: 'min(60vh, 520px)'` :

```tsx
        <div className="fame-scroll" style={{ maxHeight: 'min(60vh, 520px)', overflowY: 'auto', padding: '2px 12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
```

In `src/components/paper/CommentsPanel.tsx`, ligne 77, remplacer `maxHeight: 210` par `maxHeight: 'min(48vh, 420px)'` :

```tsx
          <div className="fame-scroll" style={{ maxHeight: 'min(48vh, 420px)', overflowY: 'auto', padding: '2px 14px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
```

- [ ] **Step 6: Vérifier le test + non-régression**

Run: `npx vitest run src/components/paper/PaperSheet.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 7: Vérification visuelle**

Run: `npm run dev` puis ouvrir une fiche sujet (`/fr/paris/paper/<id>`).
Expected: fiche centrale plus large sur grand écran, plus de bande striée « figure » vide, panneaux latéraux qui montrent davantage de contenu avant de scroller.

- [ ] **Step 8: Commit**

```bash
git add src/components/paper/PaperSheet.tsx src/components/paper/PaperSheet.test.tsx src/components/paper/TasksPanel.tsx src/components/paper/CommentsPanel.tsx
git commit -m "feat(paper): fiche élargie, placeholder figure retiré, panneaux assouplis"
```

---

## Clôture du Plan 2

- [ ] **Step 1: Vérification globale**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: tout vert.

- [ ] **Step 2: Mettre à jour `docs/STATUS.md`**

Ajouter une entrée : bouton retour RGPD, grille vitrine adaptative, mots-clés non tronqués, page sujet élargie / placeholder retiré / panneaux assouplis. Mentionner branche/PR.

- [ ] **Step 3: Commit**

```bash
git add docs/STATUS.md
git commit -m "docs: STATUS — lot modifs UI (P2)"
```

---

## Self-Review (rempli par l'auteur du plan)

- **Couverture spec** : B1 (Task 1), B3 (Tasks 2 + 3), B2 (Task 4). ✓
- **Placeholders** : aucun ; chaque modification cite le code actuel (lignes + valeurs) et le remplacement exact.
- **Cohérence** : valeurs de largeur cohérentes (clamp max 880, soustracteur 700 inchangé → pas de collision panneaux, raisonnement explicité) ; clé i18n `privacy.back` ajoutée aux deux fichiers ; tests ciblent le comportement observable (lien, mots-clés, largeur, placeholder).
- **Indépendance** : les 4 tâches sont indépendantes entre elles et indépendantes du Plan 1 ; peuvent être exécutées dans n'importe quel ordre ou en parallèle (fichiers disjoints, sauf `messages/*.json` partagé avec le Plan 1 → exécuter sur des branches/séquences distinctes pour éviter les conflits JSON).
```
