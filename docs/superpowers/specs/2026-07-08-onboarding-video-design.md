# Vidéo d'onboarding « Visite guidée par Astra » — Design

Date : 2026-07-08
Statut : validé en brainstorming (diffusion, contenu, style, narration, langues, données, pipeline)

## Objectif

Produire une vidéo d'onboarding (~5 min 30) montrant les bons usages du site FAME aux futurs membres des labos Paris/Montréal, pour que l'outil soit utilisé au mieux. La mascotte **Astra** (dérivée de l'étoile 4 branches existante de la bulle de chat) guide la visite en voix off.

## Décisions actées (brainstorming 2026-07-08)

| Question | Décision |
|---|---|
| Diffusion | **Les deux** : MP4 partageable (email/Dropbox) **et** page du site avec sommaire chapitré |
| Découpage | **Vidéo unique + chapitres** (timecodes cliquables sur la page du site) |
| Style | **Screencast réel** du site (piloté Playwright) **+ mascotte Astra animée** en overlay |
| Narration | **Voix off synthétique** (TTS) + sous-titres |
| Langues | **FR + EN dès le départ** (deux rendus complets : UI et voix dans chaque langue) |
| Données | **Jeu de données démo dédié** seedé (fictif, réaliste, zéro confidentiel à l'écran, purgeable) |
| Pipeline | **A — Remotion** (compositing React → MP4) |
| Mascotte | **Directement en code** (pas de maquette Claude Design) |

## Scénario (~5 min 30)

Fil conducteur : Astra fait visiter « son » labo à la nouvelle recrue. Chaque chapitre s'ouvre sur une carte de titre (~2 s, tokens FAME : fond navy, or, Roboto Slab) qui sert d'ancre de timecode.

| # | Chapitre | Durée cible | Contenu à l'écran |
|---|---|---|---|
| 0 | Bienvenue | ~20 s | Carte titre FAME (fond navy étoilé), Astra se présente, arrivée sur le globe d'accueil (pins Paris/Montréal) |
| 1 | Tour d'horizon | ~60 s | Survol de chaque page : grille des fiches, fiche détaillée, kanban, publications, équipe, données (Dropbox), prompts, graphe des relations, chat Astra |
| 2 | La vie d'une fiche | ~90 s | Créer une fiche vitrine, génération ✨, auto-traduction FR/EN, fiche fille (héritage), statut, cadenas 🔒 confidentiel + explication visiteur vs membre |
| 3 | Le quotidien | ~90 s | Kanban : créer une tâche, claim, sous-tâches ; commenter une fiche ; déposer un document (+ cadenas par-doc) ; lier un dossier Dropbox |
| 4 | Les bons réflexes | ~60 s | Checklist animée : ① tout doc déposé nourrit Astra (RAG) ② cadenas en cas de doute ③ écrivez dans votre langue, l'auto-traduction gère l'autre ④ proposez des sujets ⑤ signalez les problèmes via le bouton d'Astra |
| 5 | À bientôt | ~15 s | Récap des chapitres, « si vous êtes perdu, cliquez sur mon étoile en bas de page » |

La narration exacte (ligne par ligne, FR et EN) est écrite dans des fichiers scénario versionnés (voir Architecture) — c'est la source de vérité du montage : durées TTS → timing des actions Playwright → timeline Remotion.

## Mascotte Astra

- Base : l'étoile 4 branches `#9fb6ff` de `ChatBubble.tsx` (path SVG existant), enrichie d'**yeux** (clignements périodiques) et d'un léger halo.
- Animations : flottement sinusoïdal permanent, petite rotation « contente » aux moments clés, déplacement d'un coin à l'autre pour pointer des zones de l'écran (avec trait/flèche de pointage optionnel).
- Bulles de sous-titres : cartouche arrondi style FAME (fond `fame-sand`, texte `fame-text-body`, mono pour les raccourcis), synchronisé sur l'audio.
- Implémentée en **composant React Remotion** (`AstraMascot`), paramétrée par la timeline (position, humeur, texte).

## Architecture du pipeline

Nouveau dossier **`video/`** à la racine du repo, **workspace npm indépendant** (son propre `package.json` : `remotion`, `@remotion/cli`, `playwright`, `openai`) — n'entre pas dans le build Next ni dans ses dépendances.

```
video/
  package.json               ← deps isolées (remotion, playwright, openai, tsx)
  scenario/
    scenario.ts              ← structure : chapitres, actions, lignes de narration (ids)
    narration.fr.ts          ← texte FR par ligne (source de vérité voix + sous-titres)
    narration.en.ts          ← texte EN par ligne
  scripts/
    tts.ts                   ← OpenAI TTS (gpt-4o-mini-tts) par ligne → audio/<locale>/<id>.mp3 + durations.json
    capture.ts               ← Playwright pilote http://localhost:3000 (locale param), curseur virtuel injecté,
                               actions calées sur durations.json, enregistre 1920×1080 → recordings/<locale>/
                               + timeline.json (timestamps réels de chaque action/chapitre)
  src/
    Root.tsx                 ← 2 compositions (fr, en) paramétrées par locale
    GuideVideo.tsx           ← composition principale : piste screencast + overlays + audio
    AstraMascot.tsx          ← mascotte animée
    ChapterCard.tsx          ← cartes de titre (ancres de chapitres)
    Captions.tsx             ← sous-titres synchronisés
    Highlight.tsx            ← surlignage/zoom de zones de l'écran
  out/                       ← fame-guide-fr.mp4, fame-guide-en.mp4, chapters.<locale>.json (non commité)
```

Étapes (ordonnées, rejouables individuellement) :

1. **Seed démo** : `npm run seed:demo` (racine, `src/scripts/seed-demo.ts` sur le modèle de `seed-admin.ts`) — 3–4 fiches réalistes fictives (dont 1 confidentielle pour la démo du cadenas), tâches kanban, commentaires, 1–2 publications, membres factices avec avatars. Toutes les lignes démo portent un marqueur identifiable (préfixe de slug/email `demo-`) ; `npm run seed:demo -- --purge` les supprime. S'exécute sur la BDD de dev locale uniquement.
2. **TTS** : génère les MP3 par ligne de narration et `durations.json`. Voix : `gpt-4o-mini-tts` (une voix FR, une EN). Relançable par ligne (cache par hash du texte).
3. **Capture** : Playwright (chromium, 1920×1080) se connecte en membre démo, déroule le scénario chapitre par chapitre en se calant sur les durées audio (les actions d'un chapitre tiennent dans la durée de sa narration, sinon la timeline insère des pauses), enregistre la vidéo et écrit `timeline.json`. Un **curseur virtuel** (élément DOM injecté, style FAME) rend les clics visibles. Une capture par locale (l'UI change de langue).
4. **Rendu Remotion** : composite screencast + cartes de chapitres + mascotte + sous-titres + audio → `fame-guide-<locale>.mp4` + `chapters.<locale>.json` (timecodes réels des chapitres).
5. **Publication** : upload des 2 MP4 + JSON chapitres dans un **bucket Supabase Storage public `guide-videos`** (script `video/scripts/publish.ts`, service role). Pas de MP4 dans le repo ni dans le déploiement Vercel.

## Intégration au site

- **Page `/[locale]/guide`** (hors `[lab]`, comme `/graph` et `/assistant`) : lecteur vidéo HTML5 (`<video>` pointant vers le bucket public) + **sommaire chapitré** (lu depuis `chapters.<locale>.json`, clic → `currentTime`). Accès **public** (la vidéo ne montre que des données démo fictives ; les futurs membres n'ont pas encore de compte).
- **Entrée de navigation** : lien « Guide » dans le NavMenu (uniquement — pas de bloc dédié sur l'accueil).
- **i18n** : namespace `guide` dans `messages/en.json` + `messages/fr.json` (titre, sommaire, libellés chapitres, fallback si vidéo indisponible). La page charge le MP4 de la locale courante.
- URL des vidéos : construite depuis `NEXT_PUBLIC_SUPABASE_URL` (bucket public) — pas de nouvelle variable d'env.

## Maintenance / régénération

- L'UI change → relancer capture (3) + rendu (4) + publication (5) : le scénario et les audios restent valides.
- La narration change → relancer TTS (2) puis 3-4-5 (le cache TTS ne régénère que les lignes modifiées).
- Tout est versionné sauf les artefacts (`audio/`, `recordings/`, `out/` dans `.gitignore`).

## Hors périmètre (YAGNI)

- Pas de motion design au-delà des cartes de titre et de la mascotte.
- Pas d'autres langues que FR/EN.
- Pas de player custom avancé (vitesse, pistes de sous-titres séparées) : sous-titres incrustés dans la vidéo, sommaire = simple liste de timecodes.
- Pas d'hébergement vidéo tiers (YouTube/Vimeo).
- Pas de tests automatisés du rendu vidéo lui-même (vérification humaine) ; les scripts (seed, scénario, page guide) sont testés normalement.

## Vérification

- `seed:demo` idempotent + purge vérifiée (aucune ligne `demo-` restante).
- Vidéos FR et EN relues par un humain (synchro voix/écran, sous-titres, aucune donnée réelle à l'écran).
- Page `/guide` : navigation par chapitres, les deux locales, lien NavMenu, `tsc`/`lint`/tests verts.
- Le build Next et la suite de tests existante restent verts (le workspace `video/` ne doit rien casser).
