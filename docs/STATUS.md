# FAME Website — État d'avancement

_Mettre à jour après chaque tâche. Garder ce fichier **maigre** : l'historique terminé vit dans [`STATUS-archive.md`](./STATUS-archive.md), le détail ligne-à-ligne dans `git log`, les décisions durables dans les fichiers mémoire._

Dernière mise à jour : 2026-06-29

---

## Où on en est

- **Lot de modifs P2 — UI** (branche `feat/lot-modifs-ui`, plan `docs/superpowers/plans/2026-06-29-fame-modifs-p2-ui.md`) : (1) **bouton retour** localisé sur la page RGPD (`privacy.back`) ; (2) **grille des cartes vitrine adaptative** — `SubjectGrid` passe à `repeat(auto-fill, minmax(190px, 1fr))` (s'adapte à la largeur de l'écran : règle la troncature sur petit écran d'un collègue) ; (3) **mots-clés non tronqués** sur la carte (`SubjectVitrine` : retrait `maxHeight:24`/`overflow:hidden`, wrap multi-lignes, jusqu'à 4) ; (4) **page sujet — vide comblé** : fiche centrale élargie (`clamp … 740 → 880px`), **placeholder figure strié retiré**, panneaux Tasks/Comments assouplis (`maxHeight: min(60vh,520px)` / `min(48vh,420px)`). Présentation seule (aucune migration). Suite **351/351**, `tsc`/`lint`/`build` à 0. Revue finale = self-review (Ready to merge YES). NB interne : un sous-agent avait basculé l'env vitest global en `jsdom` → corrigé (retour `node` + directive per-file, conforme à la convention repo). Vérif navigateur = humain. ⚠️ STATUS.md diverge de la branche P1 (mêmes lignes éditées) → conflit probable au merge des deux branches, à résoudre en gardant les deux entrées.

- **Documents de fiche dans le RAG** (branche `feat/subject-files-rag`) : à l'upload, le texte d'un document (pdf/txt/csv/docx/xlsx/pptx, via `unpdf`+`fflate`) est extrait, chunké et indexé dans `rag_chunks` (`source_type='subject_file'`, visibilité **héritée du sujet** et resynchronisée à sa réindexation, `metadata={subject_id,file_name}`), en arrière-plan (`after()`). Génération assistée : RPC `match_subject_files` scopée au sujet (k=4, en plus des champs saisis). Assistant **Astra** : sert ces docs selon confi/public (filtre `match_rag_chunks`), citations liées au sujet parent + nom de fichier. **Migration `011` à appliquer en BDD** ; non rétroactif (réindexé au prochain upload). Spec/plan : `docs/superpowers/{specs,plans}/2026-06-28-subject-files-rag*.md`.

- **`main` est saine et complète.** Site v1 (Phases 1–3) + audit soldé (Vagues 0→4) + **Assistant RAG « Astra »** (PRs #11–16) + **Fiche Vitrine éditable + génération assistée + contenu des fiches bilingue** (PR #18) + **refonte visuelle page sujet & harmonisation des bleus** (PRs #20–32) + **audit complet pré-remplissage soldé** (PR #38) + **upload de fichiers sur fiche** (PR #39) + **traduction/génération non littérales** (PR #40) + **polish vitrine : stamp/rubans + auto-fit du texte** (PRs #41/#44) + **documents de fiche dans le RAG** (`feat/subject-files-rag`). Tests verts (**347/347**), `tsc`/`lint`/`build` à 0.
- **Audit complet 2026-06-28** : rapport `docs/AUDIT_2026-06-28.md`. Corrigés (tests) : fuite des sujets `confidentiel` au visiteur (B1, n'était filtré que dans le RAG), sujets transversaux en 404 (B2), tâches transversales perdues au refresh kanban (I2), rate-limit DB-backed sur routes publiques + /report (I3/I4), course proposal→convert (I5), gestion d'erreur SSE assistant (I6/M1), + minors (M4/M5/M6/M9/M12/M13/M14/HSTS). **Différés documentés** : config Vercel (B3/M18), compteurs atomiques (M2/M3, migration `010` à écrire), I1 = faux positif (publications partagées volontairement), décisions produit/cosmétique (M7/M10/M11/M15/M17/M19).
- **Upload de fichiers sur fiche sujet** — LIVRÉ (PR #39, branche `feat/subject-file-upload`) : dépôt direct (≤50 Mo, docs courants : pdf/png/jpg/docx/xlsx/pptx/csv/txt) **en complément** des liens Dropbox. Bucket privé Storage `subject-files` + table `subject_files`. Upload **3-temps signé** (`POST …/files/sign` → upload direct navigateur via URL signée → `POST …/files` register + compensation), download `GET …/files/[fileId]` (URL signée 60 s, **gate `confidentiel` revérifié → 404 visiteur**), suppression membres only. UI : `FilesPanel` affiche *Liens Dropbox* + *Fichiers déposés*. Helper/liste blanche MIME : `src/lib/subjects/file-upload.ts`. Construit en subagent-driven TDD (~22 tests ; revue finale a corrigé un path-traversal `..` dans register). Suite **319/319**. Spec/plan : `docs/superpowers/{specs,plans}/2026-06-28-subject-file-upload*.md`.
- ✅ **Migration `010_subject_files.sql` appliquée** en BDD (2026-06-28) — table + bucket privé. NB : `010` = subject_files ; les compteurs atomiques différés (audit M2/M3) prendront `011`. Reste : vérif navigateur (upload/download/delete réels, visiteur 404 sur confidentiel).
- **Branches non mergées** : `fix/translate-keep-technical-terms` (prompts traduction/génération idiomatiques, gardent termes techniques — à tester puis merger). `feat/subject-file-upload` = PR #39 ouverte. `fix/audit-2026-06-28` mergée (PR #38). Migrations `008`/`009`/`010` appliquées. Prochaine étape : vérif navigateur upload, remplir le site.

---

## Assistant RAG « Astra » — LIVRÉ (mergé sur `main`)

Chatbot RAG, **cible primaire = visiteur public**. Spec : `docs/superpowers/specs/2026-06-25-assistant-rag-design.md`. Ledger détaillé : `.superpowers/sdd/progress.md`.

**Ce qui est en prod (par PR) :**
- **#11** — Backend complet (P1 données/indexation pgvector, P2 retrieval + garde-fous + endpoint SSE, P3 outils lecture seule, P5 admin/RGPD) + UI P4 (bulle + mini-panneau partout, teaser accueil, page plein écran `/[locale]/assistant`). Revues finales Opus « Ready to merge: Yes ».
- **#12** — KB FAME complète (about/faq/using-the-platform) + fix `index:rag` (polyfill WebSocket Node < 22).
- **#13** — **Liberté contrôlée** : retrieval vide ne court-circuite plus (répond identité/usage/salutations sans sources, garde l'anti-hallucination) + system prompt réécrit (identité Astra, domaine Euronext) + seuil 0.30 + **outil `list_entities`** (lister sujets/membres/publications).
- **#14** — **Emails membres publics** (page Équipe + l'assistant peut les donner) + **bouton « Signaler un problème »** (modale → `POST /api/report` → Resend) + bulle bas-gauche/retour page précédente.
- **#15/#16** — Position de la bulle **adaptée par page** : suit le rail de filtres (Sujets/Tâches) via `--fame-rail-w`, au-dessus de la barre du bas via `--fame-bubble-bottom`, juste au-dessus du footer ailleurs. Accueil inchangé.

**Décisions produit durables :**
1. **Astra** = nom de l'assistant (badge Bêta). Domaine FAME = signaux IA du sentiment de l'actualité financière, périmètre **Euronext** (univers Oslo/Lisbonne actuellement).
2. **`confidentiel` (subjects)** : `true` → jamais visible au visiteur (ni bot, ni outils, ni navigation). Membres voient tout. Tâches/fichiers héritent.
3. ⚠️ **Emails membres = PUBLICS** (décision 2026-06-27) : affichés sur la page Équipe pour tous + communicables par l'assistant. **Renverse** l'omission B4. `password_hash` jamais exposé. Le texte RGPD `privacy.assistant.provider` a été ajusté en conséquence. → **ne pas “re-masquer” les emails en croyant à une fuite.**

**État runtime (vérifié 2026-06-27) :** `OPENAI_API_KEY` ✅, `ASSISTANT_IP_SALT` ✅ (en `.env.local`), migrations `006`+`007` appliquées ✅, RAG indexé ✅ (**140 chunks**, dont KB=136). ⏳ **`REPORT_EMAIL` à poser (dev + prod)** pour activer le formulaire de signalement — sinon le form affiche « envoyé » mais aucun mail ne part (mode dégradé loggé).

**KB** : `docs/kb/*.md` (en + fr, frontmatter `lang:`/`labo:`, sections `## `). Modifier → `npm run index:rag`. Le contenu BDD (sujets/publications/membres) est **auto-indexé** à l'écriture via l'app (embed-on-write). NB : la BDD ne contient encore que des **sujets de test** (`Test`/`deff`) → peupler de vrais sujets pour que l'assistant soit utile sur la recherche. Brouillons KB non encore promus : `docs/kb-drafts/_COMMENT-REMPLIR.md` (guide, non indexé).

---

## Fiche Vitrine éditable + génération assistée — LIVRÉ (mergé sur `main`, PR #18)

Composant `SubjectVitrine` (remplace `SubjectCard`) : format universel des cartes de la grille Lab, calqué sur la maquette Claude Design. Modale plein écran `VitrineEditor` (poster A4 éditable inline) remplace `AddSubjectModal`. Carte pointillée d'ajout en fin de grille pour les membres.

**Génération par champ :** bouton ✨ sur chaque champ rédactionnel → `POST /api/subjects/assist` (OpenAI via `getChatProvider`, budget + kill-switch `ASSISTANT_DISABLED`). Prompts centralisés dans `src/lib/subjects/field-prompts.ts`, lien « voir le prompt » par champ.

**DB :** migration `008_subject_vitrine.sql` — ajout de `question`, `accroche`, `periode` (text NOT NULL DEFAULT ''). Type `Subject`, API POST/PATCH et `chunkSubject` RAG mis à jour. Fallback : si `question` vide, la vitrine affiche `titre`.

**État :** implémenté et revu (SDD, 8 tâches + revue whole-branch « Ready to merge »). Suite **258/258** tests OK, build OK.

✅ **Migration `008` appliquée** (2026-06-28). La génération consomme le budget OpenAI de l'assistant. Reste : vérification manuelle navigateur (génération, édition, filtres, drag).

---

## Contenu des fiches bilingue (auto-traduction) — LIVRÉ (mergé sur `main`, PR #18)

Nouvelle colonne `i18n jsonb` sur `subjects` (`{en:{…},fr:{…}}`). Les colonnes plates existantes restent la source/fallback. À la création/màj d'une fiche via l'éditeur, les champs rédactionnels (titre, question, accroche, context, method, results, keywords, dimensions) sont traduits dans l'autre langue en **un seul appel LLM groupé** (`src/lib/subjects/translate.ts`, OpenAI via `getChatProvider`). **Fallback gracieux** : si l'assistant est coupé, budget dépassé ou JSON invalide, la sauvegarde réussit toujours (colonne `i18n` reste vide/partielle, affichage replie sur les colonnes plates). Le `kicker`/domaine est mappé via la liste de domaines (EN↔FR, sans IA).

**Affichage :** helper `localizedSubject` sert la bonne locale dans la grille, la page Paper, la recherche (bi-langue) et l'indexation RAG (les deux langues indexées). L'éditeur pré-remplit depuis la version localisée, envoie sa locale comme langue source, et affiche une mention d'auto-traduction.

**DB :** migration `009_subject_i18n.sql` — additive, défaut `'{}'`. Fiches existantes = **fallback** (langue d'origine affichée sur les deux locales jusqu'à ré-enregistrement ; pas de backfill).

**Limitation connue :** la conversion d'une proposition en sujet (`/api/proposals/[id]/convert`) ne déclenche **pas** l'auto-traduction (les propositions n'ont pas de langue source fiable) → le sujet créé s'affiche dans sa langue d'origine (fallback) jusqu'à ré-enregistrement via l'éditeur.

**État :** implémenté et revu (SDD, 8 tâches + revue finale whole-branch « Ready to merge »). Suite de tests verte, build OK. Complète la feature « fiche vitrine » (même branche/PR).

✅ **Migration `009` appliquée** (2026-06-28). La traduction consomme le budget OpenAI à chaque création/màj de fiche. Reste : vérification manuelle navigateur (FR→EN / EN→FR, fallback fiches existantes, recherche bi-langue).

---

## Refonte visuelle page sujet, bleus & bulle assistant — LIVRÉ (mergé, PRs #20–36)

Polish UI mergé sur `main` (CSS/présentation uniquement, aucune migration) :

- **Page sujet au visuel vitrine** (PR #20) — la fiche centrale `PaperSheet` adopte le look de la carte `SubjectVitrine` : héros clair (domaine, numéro, période + statut, « La question », titre-question serif, sous-titre italique) → bande navy (accroche) → corps clair (auteurs, Context/Method/Results, figure, mots-clés). Contenu localisé (`localizedSubject`), helpers `vitrine*` réutilisés. **Panneaux Tasks/Files/Comments + nav + barre de progression conservés.**
- **Équilibrage des dimensions** (PRs #21–22) — fiche centrale élargie puis rééquilibrée : `width: clamp(420px, calc(100vw − 700px), 740px)` ; panneaux latéraux `240 → 300px`.
- **Harmonisation des bleus** (PRs #23–25) — duo cohérent : **barres = navy `#15203f`** (`fame-navy` : TopBar universelle, nav du bas, barre de progression, bouton Tasks) ; **panneaux + boutons = bleu marque `#2f4486`** (`fame-blue`, plein).
- **Position de la bulle assistant** (PRs #26–32) — sur la page sujet, la bulle est remontée au-dessus de la barre de nav du bas. Dérivée de la hauteur de la barre : constante **`PAPER_NAV_HEIGHT`** exportée par `PaperNav` (= 102px), bulle = `PAPER_NAV_HEIGHT + 54` via `--fame-bubble-bottom` (même mécanisme que Sujets/Tâches).
- **Zone de saisie de l'assistant** (PRs #34–36) — `ChatComposer` resserré (bouton d'envoi 36→28px, paddings réduits → boîte ~34px au lieu de ~48px) et texte **centré verticalement** (`alignItems: center`). Le textarea s'agrandit toujours jusqu'à 110px en multi-lignes.

Fichiers touchés : `src/components/paper/{PaperSheet,PaperView,PaperNav,TasksPanel,FilesPanel,CommentsPanel}.tsx`, `src/components/layout/TopBar.tsx`, `src/components/assistant/ChatComposer.tsx`.

---

## Garde-fous permanents (ne pas casser)

- ⚠️ **Ne jamais retirer `@config "../../tailwind.config.ts"`** de `globals.css` (sinon tous les `fame-*` redeviennent morts). Mémoire `tailwind-fame-tokens-dead`.
- ⚠️ **`createServiceClient()` sans cookies** (sinon RLS s'applique aux users connectés). Mémoire `service-role-no-cookies`.
- ⚠️ **Emails membres publics** : c'est voulu (page Équipe + assistant). Ne pas les remasquer. Seul `confidentiel`/réservé-membres reste protégé du visiteur.
- Secrets server-only (`SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `ASSISTANT_IP_SALT`, `REPORT_EMAIL`) — jamais `NEXT_PUBLIC_`.
- i18n en/fr à parité stricte (test `src/messages-parity.test.ts`), zéro chaîne UI hardcodée.

---

## Déploiement (non démarré)

- ✅ Migrations appliquées en BDD : `001`–`010` (`008`/`009`/`010` appliquées le 2026-06-28 ; `010` = `subject_files` + bucket privé Storage). ⏳ **`011_subject_files_rag.sql` à appliquer** (`subject_file` dans le RAG : type, RPC `match_subject_files`, `metadata` sur `match_rag_chunks`).
- ⏳ **Env vars prod (Vercel)** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `DROPBOX_ACCESS_TOKEN`, `RESEND_API_KEY` + `EMAIL_FROM`, `OPENAI_API_KEY`, `ASSISTANT_IP_SALT`, `REPORT_EMAIL`. Domaine expéditeur à vérifier dans Resend.
- ⏳ `npm run seed:admin` une fois sur la prod.
- ⏳ `npm run index:rag` sur la prod (après migrations + `OPENAI_API_KEY`).
- ⏳ Plan superpowers déploiement dédié à rédiger.

---

## Plans / référence

`docs/superpowers/plans/2026-06-22-fame-website-p{1,2,3}-*.md` (Foundation / Features / Secondary) · assistant `…/2026-06-25-assistant-p{1,2,3,4,5}-*.md` · audit `docs/AUDIT_2026-06-24.md` · vagues `…-vague{2,3,4}-*.md` · archive `docs/STATUS-archive.md`.
