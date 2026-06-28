# Agentic Rules — FAME Website

Lis ce fichier **avant d'écrire la moindre ligne de code**.

---

## Next.js 16 — Breaking Changes

Version : **16.2.9** avec React 19. Les APIs ont changé depuis Next.js 14/15 :

- `params` et `searchParams` dans les props de pages/layouts sont **`Promise<{...}>`** — toujours `await params`
- En cas de doute sur un pattern Next.js, lire `node_modules/next/dist/docs/` avant d'implémenter
- Respecter les avertissements de dépréciation

---

## Stack Technique

| Couche | Choix | Version |
|---|---|---|
| Framework | Next.js App Router + TypeScript | 16.2.9 |
| UI | React | 19.2.4 |
| Styles | Tailwind CSS v4 | ^4 |
| BDD + Auth | Supabase (`@supabase/ssr`) | ^0.12.0 |
| i18n | next-intl | ^4.13.0 |
| Email | Resend | ^6.14.0 |
| Fichiers | Dropbox JS SDK (server-only) | — |

---

## Conventions Obligatoires

### Routing

- Toutes les pages : `src/app/[locale]/[lab]/[page]/page.tsx`
- Locales : `en` (défaut) | `fr`
- Lab slug : `paris` | `montreal` — **toujours en minuscules** dans le code, les URLs et la BDD
- Valider le lab slug dans **chaque** route handler — lab invalide → 404
- Layouts : `src/app/[locale]/layout.tsx` (locale) + `src/app/[locale]/[lab]/layout.tsx` (TopBar)

### i18n

- **Zéro chaîne hardcodée dans l'UI** — toute chaîne visible utilise `useTranslations()` (client) ou `getTranslations()` (server)
- Clés dans `messages/en.json` **et** `messages/fr.json` — ajouter les deux systématiquement
- Ne jamais omettre la traduction FR en se disant "on le fera plus tard"

### Base de Données

- Tous les **writes** passent par des routes `/api/` utilisant le **service-role client** (`createServiceClient()` de `src/lib/supabase/server.ts`)
- Les pages read-heavy utilisent des React Server Components avec le client serveur standard
- RLS activée sur toutes les tables — le service role la contourne côté API, c'est intentionnel
- Jamais d'appel Supabase direct depuis un composant client pour les mutations
- **Fichiers de sujet** (`subject_files` + bucket privé Storage `subject-files`) : upload en **3 temps signés** — `POST …/files/sign` (membre, valide type/taille via `validateUpload`) → le navigateur uploade **directement** à Storage via URL signée (contourne la limite ~4,5 Mo de Vercel) → `POST …/files` enregistre la métadonnée. Download via `GET …/files/[fileId]` (URL signée 60 s, **revérifie le gate `confidentiel`** → 404 visiteur). Helper + liste blanche MIME dans `src/lib/subjects/file-upload.ts`. Complète les liens Dropbox, ne les remplace pas.

### Auth

- Sessions via `@supabase/ssr` avec cookies httpOnly
- Helpers dans `src/lib/auth.ts` :
  - `getSession()` — identifie le caller (nullable)
  - `requireMember()` — lève 401 si non connecté
  - `requireAdmin()` — lève 403 si pas admin
  - `authErrorResponse(err)` — formate les erreurs auth en NextResponse
- Pas d'auto-inscription : l'admin invite manuellement (email d'activation)

### Sécurité

- `SUPABASE_SERVICE_ROLE_KEY` : **server-only**, jamais dans le bundle client
- `DROPBOX_ACCESS_TOKEN` : **server-only**, jamais dans le bundle client
- Seuls `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` peuvent utiliser le préfixe `NEXT_PUBLIC_`
- Route Dropbox : `GET /api/dropbox/tree` — membre authentifié requis

### Tailwind CSS v4

- PostCSS plugin : `@tailwindcss/postcss` (dans `postcss.config.mjs`)
- Tokens couleur + polices définis dans `tailwind.config.ts` (à la racine) — **ne pas supprimer ce fichier**
- Import dans globals.css : `@import "tailwindcss"`

### Tokens Couleur FAME

Définis dans `tailwind.config.ts` sous `theme.extend.colors.fame` — utiliser `bg-fame-*`, `text-fame-*`, etc. :

| Token | Valeur hex | Usage principal |
|---|---|---|
| `fame-navy` | `#15203f` | Fond sombre (globe, header) |
| `fame-navy-light` | `#18244c` | Variante fond sombre |
| `fame-blue` | `#2f4486` | Bleu principal, pays globe |
| `fame-blue-dark` | `#1d2b56` | Bleu foncé, hover |
| `fame-blue-mid` | `#1f2e5c` | Intermédiaire |
| `fame-slate` | `#5768ac` | Bordures globe, accents |
| `fame-teal` | `#1e9b7e` | Accent succès, statut actif |
| `fame-gold` | `#e8b149` | Pins globe, highlights |
| `fame-coral` | `#ff6f61` | Accents secondaires |
| `fame-red` | `#c0473b` | Danger, suppression |
| `fame-sand` | `#fbf9f3` | Fond clair des cartes |
| `fame-sand-bg` | `#F9F9FA` | Fond page Lab/Paper |
| `fame-sand-sidebar` | `rgba(244,243,236,0.92)` | Sidebar translucide |
| `fame-ecru` | `#eceadf` | Bordures, séparateurs |
| `fame-text-light` | `#eef3ff` | Texte clair (sur fond sombre) |
| `fame-text-muted` | `#7e95d6` | Texte atténué bleuté |
| `fame-text-dim` | `#9fb2e6` | Texte très atténué |
| `fame-text-body` | `#2a3457` | Texte corps (sur fond clair) |
| `fame-text-dark` | `#15203f` | Texte sombre |

Gradient de fond disponible via `bg-fame-gradient` (défini dans `theme.backgroundImage`).

### Typographie

- **Serif** : `font-serif` → Roboto Slab (titres, noms de fiches)
- **Mono** : `font-mono` → IBM Plex Mono (labels, badges, code, nav)
- Chargées dans `src/app/globals.css` via Google Fonts

### Animations CSS

Définies dans globals.css — utiliser ces keyframes plutôt qu'en créer de nouvelles :

- `fameFade` — apparition douce (fade + slide up)
- `famePulse` — pulsation des pins sur le globe
- `fameTwinkle` — clignotement des étoiles
- `modalIn` — ouverture de modal
- `toastIn` — apparition de toast

### Maquettes

Avant d'écrire tout composant UI ou page, lire la maquette correspondante **via le MCP Claude Design** (projet « Site FAME projet », `5bd688a8-2928-4c09-8d94-63f35b89ec74`). Les maquettes ne sont **pas** dans le repo — ne pas créer `docs/mockups/`.

> **Opus obligatoire** : seule une session **Opus 4.8** peut se connecter à claude.ai/design (outil `DesignSync`). Un sous-agent Sonnet n'y a pas accès → l'orchestrateur Opus lit la maquette via le MCP et **injecte le markup dans le prompt** du sous-agent.

Outil : `DesignSync` méthode `get_file`, `projectId = 5bd688a8-2928-4c09-8d94-63f35b89ec74`, `path = <fichier>` (format `.dc.html`).

| Page | `path` |
|---|---|
| home (globe) | `FAME Accueil.dc.html` |
| lab (grille de fiches) | `FAME Laboratoire.dc.html` |
| paper (fiche détaillée) | `FAME Paper.dc.html` |
| tasks (kanban) | `FAME Tasks.dc.html` |
| propose (formulaire) | `FAME Proposer.dc.html` |
| publications | `FAME Publications.dc.html` |
| team (trombinoscope) | `FAME Trombinoscope.dc.html` |
| data (explorateur Dropbox) | `FAME Données.dc.html` |
| prompts | `FAME Prompts.dc.html` |

Si le MCP Claude Design n'est pas connecté → demander à l'utilisateur de lancer `/design-login`.

### Composants Partagés

Avant de créer un composant UI, vérifier s'il existe dans `src/components/ui/` :

- `Avatar` — avatar initiales coloré ou photo
- `StatusBadge` — pill de statut coloré
- `SegmentedBar` — barre de progression segmentée (N segments = N tâches)
- `Modal` — overlay générique avec Escape + clic extérieur
- `Toast` / `useToast` — notifications top-center
- `ConfirmDialog` — confirmation destructive
- `EditModeToggle` — bouton crayon pour le mode édition

### Structure des Fichiers

```
src/
  app/
    layout.tsx                     ← root layout (returns children only)
    page.tsx                       ← redirect to /en
    globals.css                    ← FAME tokens + animations
    [locale]/
      layout.tsx                   ← html/body + NextIntlClientProvider + ToastProvider
      page.tsx                     ← Home globe
      auth/login/page.tsx
      auth/activate/[token]/page.tsx
      privacy/page.tsx               ← page RGPD (hors TopBar, contenu i18n namespace `privacy`, lien footer)
      [lab]/
        layout.tsx                 ← TopBar + pt-12
        page.tsx                   ← Lab grid
        paper/[id]/page.tsx
        tasks/page.tsx
        publications/page.tsx
        team/page.tsx
        data/page.tsx              ← membres uniquement
        prompts/page.tsx           ← membres uniquement
        propose/page.tsx
      admin/proposals/page.tsx
    api/
      auth/{sign-in,sign-out,activate}/route.ts
      subjects/route.ts + [id]/{route,order,assist}.ts + [id]/files/{route,sign,[fileId]}.ts
      tasks/route.ts + [id]/{route,subtasks,claim}.ts
      comments/route.ts + [id]/route.ts
      publications/route.ts + [id]/route.ts
      members/route.ts + [id]/route.ts + invite/route.ts
      prompts/route.ts + [id]/route.ts
      proposals/route.ts + [id]/{route,convert}.ts
      dropbox/{tree,links}/route.ts
  components/
    ui/          ← primitives partagés (voir liste ci-dessus)
    layout/      ← TopBar, NavMenu, LanguageSwitcher, AuthButton
    globe/       ← Globe, StarField, LabPin
    lab/         ← SubjectCard, SubjectGrid, FilterSidebar, AddSubjectModal
    paper/       ← PaperSheet, TasksPanel, FilesPanel, CommentsPanel, PaperNav
    tasks/       ← KanbanBoard, KanbanColumn, TaskCard, TaskModal, SubtaskList...
    publications/
    team/
    data/
    prompts/
    propose/
    admin/
  lib/
    supabase/client.ts             ← browser client
    supabase/server.ts             ← createServerClient() + createServiceClient()
    auth.ts                        ← getSession, requireMember, requireAdmin
    resend/
    dropbox/
  types/index.ts                   ← tous les types TypeScript partagés
  i18n/routing.ts
  i18n/request.ts
  middleware.ts
  scripts/seed-admin.ts
```

---

## Règles de Versioning

- Chaque tâche complétée → commit atomique avec message `feat:`, `fix:` ou `chore:`
- Mettre à jour `docs/STATUS.md` après chaque tâche complétée
- Ne jamais commiter `.env.local`
