# Vidéo d'onboarding « Visite guidée par Astra » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire deux MP4 d'onboarding (~5 min 30, FR + EN) — screencast du site piloté par Playwright, mascotte Astra animée, voix off TTS — publiés sur Supabase Storage et lisibles sur une page `/[locale]/guide` avec sommaire chapitré.

**Architecture:** Un workspace npm isolé `video/` contient le pipeline (scénario versionné → TTS OpenAI → capture Playwright par chapitre → compositing Remotion → publication Storage). Le site gagne une page publique `/[locale]/guide` (lecteur + sommaire) et un lien NavMenu. Un seed démo purgeable (UUIDs fixes) fournit le contenu à l'écran.

**Tech Stack:** Remotion 4, Playwright (chromium), OpenAI TTS (`gpt-4o-mini-tts`, sortie WAV), tsx, Supabase Storage, Next.js 16 / next-intl côté site.

**Spec:** `docs/superpowers/specs/2026-07-08-onboarding-video-design.md`

## Global Constraints

- `video/` a son **propre `package.json`** — aucune dépendance vidéo dans le `package.json` racine ; le build Next et la suite vitest racine (446 tests) restent verts.
- Aucun artefact binaire commité : `video/audio/`, `video/recordings/`, `video/out/`, `video/node_modules/`, `video/.auth/` vont dans `.gitignore`.
- i18n : **toute chaîne UI de la page guide** existe dans `messages/en.json` ET `messages/fr.json` (namespace `guide` + clé `nav.guide`).
- ⚠️ **Encodage non-ASCII** : après chaque édition de fichier contenant du français, vérifier `grep -c "�" <fichier>` == 0 (piège connu du repo).
- Données démo : UUIDs **fixes et versionnés** (source de vérité de la purge), emails `demo-*@fame-demo.local`, **aucune donnée réelle**.
- Secrets : `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_DEMO_PASSWORD` lus depuis `.env.local` (jamais commités, jamais côté client).
- Modèles sous-agents (CLAUDE.md) : tâches 1–9 = volume/outillage → `claude-sonnet-4-6` convient ; l'orchestrateur revoit chaque tâche. Pas de maquette Claude Design pour `/guide` (décision spec : design en code, tokens FAME).
- Tests : vitest racine env `node` global ; les tests de composants React prennent la directive per-file `// @vitest-environment jsdom` (convention repo — ne PAS changer l'env global).
- Remotion : licence libre pour équipes ≤ 3 salariés / usage recherche — OK pour FAME (labos académiques).
- fps = 30, résolution 1920×1080 partout (capture ET composition).

---

### Task 1: Jeu de données démo + script `seed:demo`

**Files:**
- Create: `src/scripts/seed-demo-data.ts` (dataset pur, testable)
- Create: `src/scripts/seed-demo.ts` (applique/purge via service role)
- Create: `src/scripts/seed-demo-data.test.ts`
- Modify: `package.json` (script `seed:demo`)

**Interfaces:**
- Produces: `DEMO` (export de `seed-demo-data.ts`) : `{ members, subjects, relations, tasks, subtasks, comments, publications }` avec ids UUID fixes. `DEMO_MEMBER_EMAIL = 'demo-alice@fame-demo.local'` (le compte de capture, Task 5). `npm run seed:demo` (idempotent) et `npm run seed:demo -- --purge`.

- [ ] **Step 1: Écrire le test du dataset**

`src/scripts/seed-demo-data.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { DEMO, DEMO_MEMBER_EMAIL } from './seed-demo-data'

describe('seed-demo-data', () => {
  it('tous les emails membres sont marqués demo-', () => {
    for (const m of DEMO.members) {
      expect(m.email).toMatch(/^demo-.+@fame-demo\.local$/)
    }
    expect(DEMO.members.map(m => m.email)).toContain(DEMO_MEMBER_EMAIL)
  })
  it('tous les ids sont des UUIDs fixes et uniques', () => {
    const ids = [
      ...DEMO.members.map(m => m.id),
      ...DEMO.subjects.map(s => s.id),
      ...DEMO.tasks.map(t => t.id),
      ...DEMO.subtasks.map(s => s.id),
      ...DEMO.comments.map(c => c.id),
      ...DEMO.publications.map(p => p.id),
      ...DEMO.relations.map(r => r.id),
    ]
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    for (const id of ids) expect(id).toMatch(uuidRe)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('exactement un sujet confidentiel (pour la démo du cadenas)', () => {
    expect(DEMO.subjects.filter(s => s.confidentiel)).toHaveLength(1)
  })
  it('chaque sujet a son i18n en et fr', () => {
    for (const s of DEMO.subjects) {
      expect(s.i18n.en?.titre).toBeTruthy()
      expect(s.i18n.fr?.titre).toBeTruthy()
    }
  })
  it('les FK internes pointent vers des ids du dataset', () => {
    const subjectIds = new Set(DEMO.subjects.map(s => s.id))
    const memberIds = new Set(DEMO.members.map(m => m.id))
    const taskIds = new Set(DEMO.tasks.map(t => t.id))
    for (const t of DEMO.tasks) expect(subjectIds.has(t.sujet_id)).toBe(true)
    for (const st of DEMO.subtasks) expect(taskIds.has(st.task_id)).toBe(true)
    for (const c of DEMO.comments) expect(subjectIds.has(c.sujet_id)).toBe(true)
    for (const r of DEMO.relations) {
      expect(subjectIds.has(r.source_id)).toBe(true)
      expect(subjectIds.has(r.target_id)).toBe(true)
    }
    for (const s of DEMO.subjects) for (const a of s.auteurs) expect(memberIds.has(a)).toBe(true)
  })
})
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -- src/scripts/seed-demo-data.test.ts` → FAIL (module inexistant).

- [ ] **Step 3: Écrire le dataset**

`src/scripts/seed-demo-data.ts` — colonnes conformes à `supabase/migrations/001` + `008/009/012/013` (vitrine, i18n, relations). Contenu fictif réaliste (domaine FAME : signaux IA du sentiment de l'actualité financière, univers Euronext) :

```ts
// Jeu de données DÉMO pour la vidéo d'onboarding — fictif, purgeable par id.
// Les UUIDs sont FIXES : ils sont la source de vérité de `seed:demo --purge`.

export const DEMO_MEMBER_EMAIL = 'demo-alice@fame-demo.local'

const M_ALICE = 'de300001-0000-4000-8000-000000000001'
const M_BADR  = 'de300001-0000-4000-8000-000000000002'
const S_EARN  = 'de300002-0000-4000-8000-000000000001'
const S_OSLO  = 'de300002-0000-4000-8000-000000000002'
const S_MEDIA = 'de300002-0000-4000-8000-000000000003'
const S_PRIV  = 'de300002-0000-4000-8000-000000000004'
const T_CORPUS = 'de300003-0000-4000-8000-000000000001'
const T_BASELINE = 'de300003-0000-4000-8000-000000000002'
const T_REVIEW = 'de300003-0000-4000-8000-000000000003'

export const DEMO = {
  members: [
    {
      id: M_ALICE, prenom: 'Alice', nom: 'Martin', email: DEMO_MEMBER_EMAIL,
      role: 'researcher', labo: 'paris', domaines: ['NLP', 'Finance'],
      is_admin: false, activated_at: new Date('2026-01-15').toISOString(),
    },
    {
      id: M_BADR, prenom: 'Badr', nom: 'Kaci', email: 'demo-badr@fame-demo.local',
      role: 'phd', labo: 'montreal', domaines: ['Économétrie'],
      is_admin: false, activated_at: new Date('2026-02-01').toISOString(),
    },
  ],
  subjects: [
    {
      id: S_EARN, labo: 'paris', titre: 'Sentiment des annonces de résultats',
      kicker: 'NLP · Euronext', statut: 'active',
      question: 'Le ton des annonces de résultats prédit-il la volatilité du lendemain ?',
      accroche: 'Lire entre les lignes des communiqués pour anticiper la réaction des marchés.',
      periode: '2025–2027',
      context: "Les annonces de résultats concentrent l'information mais leur ton est difficile à quantifier.",
      method: 'Extraction de sentiment par LLM sur les communiqués Euronext, régression sur la volatilité réalisée.',
      results: 'Premiers résultats : corrélation significative sur le segment Oslo.',
      keywords: ['sentiment', 'earnings', 'volatilité'],
      auteurs: [M_ALICE], difficulte: 'intermediate',
      dimensions: { method: 'LLM scoring', data: 'Communiqués 2019–2025', theory: 'Efficience semi-forte', writing: 'Article en cours' },
      ordre: 1, is_transversal: false, confidentiel: false, inherits: {},
      i18n: {
        fr: { titre: 'Sentiment des annonces de résultats' },
        en: {
          titre: 'Earnings announcement sentiment',
          question: 'Does the tone of earnings announcements predict next-day volatility?',
          accroche: 'Reading between the lines of press releases to anticipate market reactions.',
          context: 'Earnings announcements concentrate information, but their tone is hard to quantify.',
          method: 'LLM sentiment extraction on Euronext releases, regression on realized volatility.',
          results: 'Early results: significant correlation on the Oslo segment.',
          keywords: ['sentiment', 'earnings', 'volatility'],
          dimensions: { method: 'LLM scoring', data: 'Releases 2019–2025', theory: 'Semi-strong efficiency', writing: 'Paper in progress' },
        },
      },
    },
    {
      id: S_OSLO, labo: 'paris', titre: 'Sentiment intrajournalier — Oslo',
      kicker: 'NLP · Intraday', statut: 'active',
      question: 'Le signal de sentiment tient-il à la minute sur Oslo Børs ?',
      accroche: 'Descendre du quotidien à la minute.',
      periode: '2026–2027',
      context: '', method: '', results: '',
      keywords: ['intraday', 'oslo'], auteurs: [M_ALICE], difficulte: 'advanced',
      dimensions: { method: '', data: 'Ticks Oslo 2024–2025', theory: '', writing: '' },
      ordre: 2, is_transversal: false, confidentiel: false,
      inherits: { context: S_EARN, method: S_EARN },
      i18n: {
        fr: { titre: 'Sentiment intrajournalier — Oslo' },
        en: {
          titre: 'Intraday sentiment — Oslo',
          question: 'Does the sentiment signal hold at the minute level on Oslo Børs?',
          accroche: 'From daily down to the minute.',
          keywords: ['intraday', 'oslo'],
          dimensions: { method: '', data: 'Oslo ticks 2024–2025', theory: '', writing: '' },
        },
      },
    },
    {
      id: S_MEDIA, labo: 'montreal', titre: 'Couverture médiatique et liquidité',
      kicker: 'Médias · Microstructure', statut: 'on-hold',
      question: "L'attention médiatique déplace-t-elle la liquidité des mid-caps ?",
      accroche: 'Quand les journaux regardent, les carnets bougent.',
      periode: '2025–2026',
      context: 'La couverture presse des mid-caps Euronext est irrégulière.',
      method: 'Comptage pondéré des mentions presse, panel sur les spreads.',
      results: '', keywords: ['médias', 'liquidité'],
      auteurs: [M_BADR], difficulte: 'easy',
      dimensions: { method: 'Panel', data: 'Presse 2020–2025', theory: 'Attention investisseur', writing: '' },
      ordre: 3, is_transversal: false, confidentiel: false, inherits: {},
      i18n: {
        fr: { titre: 'Couverture médiatique et liquidité' },
        en: {
          titre: 'Media coverage and liquidity',
          question: 'Does media attention move mid-cap liquidity?',
          accroche: 'When newspapers watch, order books move.',
          context: 'Press coverage of Euronext mid-caps is irregular.',
          method: 'Weighted press mention counts, panel on spreads.',
          keywords: ['media', 'liquidity'],
          dimensions: { method: 'Panel', data: 'Press 2020–2025', theory: 'Investor attention', writing: '' },
        },
      },
    },
    {
      id: S_PRIV, labo: 'paris', titre: 'Signal propriétaire — calibration',
      kicker: 'Interne', statut: 'active',
      question: 'Calibration du signal propriétaire (démo confidentialité).',
      accroche: 'Fiche visible des seuls membres.',
      periode: '2026', context: '', method: '', results: '',
      keywords: ['interne'], auteurs: [M_ALICE], difficulte: 'advanced',
      dimensions: { method: '', data: '', theory: '', writing: '' },
      ordre: 4, is_transversal: false, confidentiel: true, inherits: {},
      i18n: {
        fr: { titre: 'Signal propriétaire — calibration' },
        en: { titre: 'Proprietary signal — calibration', question: 'Proprietary signal calibration (confidentiality demo).', accroche: 'Members-only sheet.' },
      },
    },
  ],
  relations: [
    { id: 'de300004-0000-4000-8000-000000000001', source_id: S_EARN, target_id: S_OSLO, kind: 'parent', label: '', label_i18n: {} },
    { id: 'de300004-0000-4000-8000-000000000002', source_id: S_EARN, target_id: S_MEDIA, kind: 'assoc', label: 'données partagées', label_i18n: { en: { label: 'shared data' }, fr: { label: 'données partagées' } } },
  ],
  tasks: [
    {
      id: T_CORPUS, labo: 'paris', titre: 'Constituer le corpus de communiqués',
      description: 'Scraper et nettoyer les communiqués Euronext 2019–2025.',
      statut: 'in-progress', difficulte: 'intermediate', sujet_id: S_EARN,
      i18n: { fr: { titre: 'Constituer le corpus de communiqués', description: 'Scraper et nettoyer les communiqués Euronext 2019–2025.' }, en: { titre: 'Build the press-release corpus', description: 'Scrape and clean Euronext releases 2019–2025.' } },
    },
    {
      id: T_BASELINE, labo: 'paris', titre: 'Baseline de sentiment (lexique)',
      description: 'Comparer le scoring LLM à un lexique financier classique.',
      statut: 'to-do', difficulte: 'easy', sujet_id: S_EARN,
      i18n: { fr: { titre: 'Baseline de sentiment (lexique)', description: 'Comparer le scoring LLM à un lexique financier classique.' }, en: { titre: 'Sentiment baseline (lexicon)', description: 'Compare LLM scoring against a classic financial lexicon.' } },
    },
    {
      id: T_REVIEW, labo: 'paris', titre: 'Revue de littérature volatilité',
      description: 'Synthèse des papiers sentiment → volatilité depuis 2015.',
      statut: 'done', difficulte: 'easy', sujet_id: S_EARN,
      i18n: { fr: { titre: 'Revue de littérature volatilité', description: 'Synthèse des papiers sentiment → volatilité depuis 2015.' }, en: { titre: 'Volatility literature review', description: 'Survey of sentiment → volatility papers since 2015.' } },
    },
  ],
  subtasks: [
    { id: 'de300005-0000-4000-8000-000000000001', task_id: T_CORPUS, label: 'Lister les sources', done: true, ordre: 0 },
    { id: 'de300005-0000-4000-8000-000000000002', task_id: T_CORPUS, label: 'Script de scraping', done: true, ordre: 1 },
    { id: 'de300005-0000-4000-8000-000000000003', task_id: T_CORPUS, label: 'Dédoublonnage', done: false, ordre: 2 },
  ],
  comments: [
    { id: 'de300006-0000-4000-8000-000000000001', sujet_id: S_EARN, auteur_type: 'member', auteur_nom: 'Badr Kaci', membre_id: M_BADR, texte: 'Le segment Lisbonne mériterait le même traitement.' },
    { id: 'de300006-0000-4000-8000-000000000002', sujet_id: S_EARN, auteur_type: 'visitor', auteur_nom: 'Visiteur curieux', membre_id: null, texte: 'Très intéressant ! Les données seront-elles publiques ?' },
  ],
  publications: [
    { id: 'de300007-0000-4000-8000-000000000001', labo: 'paris', titre: 'LLM sentiment and post-announcement volatility: evidence from Oslo Børs', auteurs: ['Alice Martin', 'Badr Kaci'], annee: 2026, type: 'working-paper', revue_ou_conf: 'FAME Working Papers', lien: null },
  ],
} as const
```

- [ ] **Step 4: Vérifier** — `npm test -- src/scripts/seed-demo-data.test.ts` → PASS. Puis `grep -c "�" src/scripts/seed-demo-data.ts` → 0.

- [ ] **Step 5: Écrire le script d'application/purge**

`src/scripts/seed-demo.ts` (même squelette env/client que `src/scripts/seed-admin.ts` — dotenv `.env.local`, `createClient` service role avec `realtime.transport: WebSocket`) :

```ts
// Run: npm run seed:demo        → insère (idempotent, upsert par id)
//      npm run seed:demo -- --purge → supprime tout le jeu démo
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { DEMO, DEMO_MEMBER_EMAIL } from './seed-demo-data'

config({ path: ['.env.local', '.env'] })

for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
  if (!process.env[k]) { console.error(`Set ${k} in .env.local`); process.exit(1) }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  }
)

async function purge() {
  // Ordre FK-safe : enfants d'abord. Les cascades gèrent le reste.
  await supabase.from('subtasks').delete().in('id', DEMO.subtasks.map(s => s.id))
  await supabase.from('tasks').delete().in('id', DEMO.tasks.map(t => t.id))
  await supabase.from('comments').delete().in('id', DEMO.comments.map(c => c.id))
  await supabase.from('subject_relations').delete().in('id', DEMO.relations.map(r => r.id))
  await supabase.from('subjects').delete().in('id', DEMO.subjects.map(s => s.id))
  await supabase.from('publications').delete().in('id', DEMO.publications.map(p => p.id))
  await supabase.from('members').delete().in('id', DEMO.members.map(m => m.id))
  // Auth user du membre de capture
  const { data } = await supabase.auth.admin.listUsers()
  const authUser = data?.users?.find(u => u.email === DEMO_MEMBER_EMAIL)
  if (authUser) await supabase.auth.admin.deleteUser(authUser.id)
  console.log('Demo data purged.')
}

async function seed() {
  const password = process.env.SEED_DEMO_PASSWORD
  if (!password) { console.error('Set SEED_DEMO_PASSWORD in .env.local'); process.exit(1) }

  // 1. Auth user pour le membre de capture (id ALIGNÉ sur le profil membre)
  const alice = DEMO.members.find(m => m.email === DEMO_MEMBER_EMAIL)!
  const { error: authError } = await supabase.auth.admin.createUser({
    id: alice.id, email: alice.email, password, email_confirm: true,
  })
  if (authError && !authError.message.includes('already been registered')) {
    console.error('Auth error:', authError.message); process.exit(1)
  }

  // 2. Upserts par id (idempotent)
  const steps: Array<[string, readonly Record<string, unknown>[]]> = [
    ['members', DEMO.members], ['subjects', DEMO.subjects],
    ['subject_relations', DEMO.relations], ['tasks', DEMO.tasks],
    ['subtasks', DEMO.subtasks], ['comments', DEMO.comments],
    ['publications', DEMO.publications],
  ]
  for (const [table, rows] of steps) {
    const { error } = await supabase.from(table).upsert(rows as Record<string, unknown>[], { onConflict: 'id' })
    if (error) { console.error(`${table}:`, error.message); process.exit(1) }
    console.log(`${table}: ${rows.length} rows`)
  }
  console.log(`Demo seeded. Capture login: ${DEMO_MEMBER_EMAIL}`)
}

const run = process.argv.includes('--purge') ? purge : seed
run().catch(err => { console.error(err); process.exit(1) })
```

Note : `tasks.i18n` existe (migration `012`), `subjects.question/accroche/periode/i18n/inherits/confidentiel/difficulte/is_transversal` existent (migrations `002/004/008/009/013`). Si un upsert échoue sur une colonne, lire la migration correspondante et ajuster le dataset — ne pas retirer la colonne du test.

- [ ] **Step 6: Ajouter le script npm** — dans `package.json`, sous `"seed:admin"` :

```json
    "seed:demo": "npx tsx src/scripts/seed-demo.ts",
```

- [ ] **Step 7: Tester en réel** — poser `SEED_DEMO_PASSWORD=demo-fame-2026!` dans `.env.local` (ne pas commiter), puis :

Run: `npm run seed:demo` → chaque table logge son count, exit 0. Relancer → toujours 0 (idempotent).
Run: `npm run seed:demo -- --purge` → « Demo data purged. »
Run: `npm run seed:demo` (re-seed pour la suite du plan).
Run: `npm test` → toute la suite passe ; `npx tsc --noEmit` → 0.

- [ ] **Step 8: Commit** — `git add src/scripts/seed-demo* package.json && git commit -m "feat(video): seed démo purgeable pour la vidéo d'onboarding"`

---

### Task 2: Workspace `video/` (scaffold)

**Files:**
- Create: `video/package.json`, `video/tsconfig.json`, `video/remotion.config.ts`, `video/README.md`
- Modify: `.gitignore` (racine)

**Interfaces:**
- Produces: workspace autonome — `cd video && npm install` puis `npx remotion --help` et `npx playwright --version` fonctionnent. Scripts npm : `validate`, `tts`, `capture`, `render`, `publish` (implémentés Tasks 3–8 ; déclarés dès maintenant).

- [ ] **Step 1: Créer `video/package.json`**

```json
{
  "name": "fame-onboarding-video",
  "private": true,
  "type": "module",
  "scripts": {
    "validate": "tsx scripts/validate.ts",
    "tts": "tsx scripts/tts.ts",
    "capture": "tsx scripts/capture.ts",
    "studio": "remotion studio",
    "render": "tsx scripts/render.ts",
    "publish": "tsx scripts/publish.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.290",
    "openai": "^6.9.0",
    "playwright": "^1.56.0",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "remotion": "^4.0.290"
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.108.2",
    "@types/react": "^19",
    "dotenv": "^17.4.2",
    "tsx": "^4.22.4",
    "typescript": "^5",
    "vitest": "^3.2.6"
  }
}
```

- [ ] **Step 2: `video/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "scripts", "scenario"]
}
```

- [ ] **Step 3: `video/remotion.config.ts`**

```ts
import { Config } from '@remotion/cli/config'
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
```

- [ ] **Step 4: `.gitignore` racine** — ajouter à la fin :

```
# video pipeline artifacts
video/node_modules/
video/audio/
video/recordings/
video/out/
video/.auth/
```

- [ ] **Step 5: `video/README.md`** — documenter le pipeline en 10 lignes : prérequis (`.env.local` racine avec `OPENAI_API_KEY`, `SEED_DEMO_PASSWORD`, Supabase ; site lancé sur `http://localhost:3000` ; `npm run seed:demo` à la racine), puis `npm run validate && npm run tts && npm run capture && npm run render && npm run publish`, chaque étape relançable seule, artefacts dans `audio/ recordings/ out/` (non commités).

- [ ] **Step 6: Installer et vérifier**

Run: `cd video && npm install && npx remotion versions && npx playwright install chromium`
Expected: versions Remotion affichées, chromium installé, `video/node_modules/` ignoré par git (`git status` propre hors nouveaux fichiers).

- [ ] **Step 7: Vérifier que la racine est intacte** — à la racine : `npm test` (446+ verts) et `npm run build` → OK (le workspace n'est pas ramassé par Next).

- [ ] **Step 8: Commit** — `git add video/package.json video/tsconfig.json video/remotion.config.ts video/README.md video/package-lock.json .gitignore && git commit -m "chore(video): workspace Remotion/Playwright isolé"`

---

### Task 3: Scénario + narration FR/EN + validation

**Files:**
- Create: `video/scenario/types.ts`, `video/scenario/scenario.ts`, `video/scenario/narration.fr.ts`, `video/scenario/narration.en.ts`
- Create: `video/scenario/scenario.test.ts`
- Create: `video/scripts/validate.ts`

**Interfaces:**
- Produces:
  - `types.ts` : `Action` (union `goto|click|type|hover|pause|scroll`), `Beat { line: string; actions: Action[] }`, `Chapter { id: ChapterId; beats: Beat[] }`, `ChapterId = 'welcome'|'tour'|'subject'|'daily'|'reflexes'|'outro'`.
  - `scenario.ts` : `export const CHAPTERS: Chapter[]` (6 chapitres, ordre = ordre vidéo), `export const BASE_LAB = 'paris'`.
  - `narration.<locale>.ts` : `export const NARRATION: Record<string, string>` — mêmes clés dans les deux locales ; clés `chapter.<id>.title` = titres des cartes de chapitre.
- Consumed by: Tasks 4 (TTS), 5 (capture), 7 (composition).

- [ ] **Step 1: Écrire le test**

`video/scenario/scenario.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { CHAPTERS } from './scenario'
import { NARRATION as FR } from './narration.fr'
import { NARRATION as EN } from './narration.en'

describe('scenario', () => {
  it('mêmes clés de narration en FR et EN, aucune vide', () => {
    expect(Object.keys(FR).sort()).toEqual(Object.keys(EN).sort())
    for (const rec of [FR, EN]) for (const [k, v] of Object.entries(rec)) {
      expect(v.trim(), k).not.toBe('')
    }
  })
  it('chaque beat référence une ligne de narration existante', () => {
    for (const ch of CHAPTERS) for (const beat of ch.beats) {
      expect(FR[beat.line], beat.line).toBeTruthy()
    }
  })
  it('chaque chapitre a un titre de carte', () => {
    for (const ch of CHAPTERS) expect(FR[`chapter.${ch.id}.title`]).toBeTruthy()
  })
  it('ids de chapitres uniques et dans l\'ordre du spec', () => {
    expect(CHAPTERS.map(c => c.id)).toEqual(['welcome', 'tour', 'subject', 'daily', 'reflexes', 'outro'])
  })
})
```

- [ ] **Step 2: Vérifier l'échec** — `cd video && npm test` → FAIL (modules inexistants).

- [ ] **Step 3: Écrire `types.ts`**

```ts
export type Action =
  | { kind: 'goto'; path: string }                       // ex. '/fr/paris/tasks' — '{locale}' substitué à la capture
  | { kind: 'click'; selector: string }
  | { kind: 'type'; selector: string; text: string }
  | { kind: 'hover'; selector: string }
  | { kind: 'scroll'; y: number }
  | { kind: 'pause'; ms: number }

export interface Beat { line: string; actions: Action[] }
export type ChapterId = 'welcome' | 'tour' | 'subject' | 'daily' | 'reflexes' | 'outro'
export interface Chapter { id: ChapterId; beats: Beat[] }
```

- [ ] **Step 4: Écrire la narration FR** (`narration.fr.ts` — texte complet, source de vérité voix + sous-titres)

```ts
export const NARRATION: Record<string, string> = {
  'chapter.welcome.title': 'Bienvenue',
  'chapter.tour.title': "Tour d'horizon",
  'chapter.subject.title': "La vie d'une fiche",
  'chapter.daily.title': 'Le quotidien',
  'chapter.reflexes.title': 'Les bons réflexes',
  'chapter.outro.title': 'À bientôt',

  'welcome.1': "Bonjour ! Moi c'est Astra. Bienvenue sur le site des labos FAME, Paris et Montréal. Suivez-moi, je vous fais visiter.",
  'welcome.2': "Tout commence ici, sur le globe. Chaque épingle dorée est un labo. Entrons dans celui de Paris.",

  'tour.grid': "Voici la vitrine du labo : chaque carte est une fiche de recherche, avec sa question, son avancement et son équipe.",
  'tour.paper': "Un clic sur une carte ouvre la fiche détaillée : contexte, méthode, résultats, documents et discussions.",
  'tour.tasks': "L'onglet Tâches, c'est le kanban du labo : à faire, en cours, terminé.",
  'tour.publications': "Les publications du labo sont recensées ici.",
  'tour.team': "La page Équipe présente les membres des deux labos et leurs domaines.",
  'tour.data': "Réservées aux membres : la page Données explore la Dropbox du labo…",
  'tour.prompts': "…et la page Prompts partage les prompts d'équipe.",
  'tour.graph': "Le graphe montre comment les sujets se répondent entre eux, d'un labo à l'autre.",
  'tour.astra': "Et en bas de page, il y a moi ! Posez-moi vos questions, je connais tout le site.",

  'subject.create': "Créons une fiche. En mode édition, la carte pointillée en fin de grille ajoute un nouveau sujet.",
  'subject.fill': "La fiche se remplit comme un poster : question, accroche, contexte, méthode.",
  'subject.assist': "Un doute sur la formulation ? L'étincelle propose un texte à partir de ce que vous avez déjà écrit.",
  'subject.i18n': "Écrivez dans votre langue : le site traduit automatiquement vers l'autre.",
  'subject.child': "Une piste dérivée ? Créez une fiche fille : elle hérite des champs que vous choisissez.",
  'subject.status': "Le statut suit la vie du sujet : actif, en pause, terminé.",
  'subject.confidential': "Et le cadenas rend la fiche confidentielle : invisible des visiteurs. Seuls les membres la voient.",

  'daily.task': "Au quotidien, tout passe par les tâches. On en crée une, on la découpe en sous-tâches.",
  'daily.claim': "Une tâche vous tente ? Réclamez-la : votre avatar s'y attache.",
  'daily.subtasks': "Cochez les sous-tâches au fil de l'eau : la barre de progression de la fiche suit toute seule.",
  'daily.comments': "Les discussions vivent sous la fiche : commentaires ouverts aux visiteurs comme aux membres.",
  'daily.files': "Déposez vos documents directement sur la fiche : PDF, présentations, tableurs.",
  'daily.filelock': "Chaque document a son propre cadenas : un document confidentiel peut vivre sur une fiche publique.",
  'daily.dropbox': "Et pour les gros jeux de données, liez un dossier Dropbox.",

  'reflexes.intro': "Avant de vous laisser, mes cinq bons réflexes.",
  'reflexes.1': "Un : déposez vos documents sur les fiches. Je les lis, et je m'en sers pour répondre à tout le monde.",
  'reflexes.2': "Deux : dans le doute, fermez le cadenas. On peut toujours rouvrir plus tard.",
  'reflexes.3': "Trois : écrivez dans votre langue, la traduction s'occupe de l'autre.",
  'reflexes.4': "Quatre : une idée de sujet ? Proposez-la. La page Proposer est ouverte à tous.",
  'reflexes.5': "Cinq : quelque chose cloche ? Signalez-le depuis mon panneau.",

  'outro.1': "Voilà, vous savez tout ! Et si vous êtes perdu, cliquez sur mon étoile en bas de page. À bientôt !",
}
```

- [ ] **Step 5: Écrire la narration EN** (`narration.en.ts` — traduction fidèle, mêmes clés)

```ts
export const NARRATION: Record<string, string> = {
  'chapter.welcome.title': 'Welcome',
  'chapter.tour.title': 'The grand tour',
  'chapter.subject.title': 'The life of a sheet',
  'chapter.daily.title': 'Day to day',
  'chapter.reflexes.title': 'Good habits',
  'chapter.outro.title': 'See you soon',

  'welcome.1': "Hi! I'm Astra. Welcome to the FAME labs website, Paris and Montréal. Follow me, I'll show you around.",
  'welcome.2': "Everything starts here, on the globe. Each golden pin is a lab. Let's step into Paris.",

  'tour.grid': "This is the lab's showcase: each card is a research sheet, with its question, its progress and its team.",
  'tour.paper': "Clicking a card opens the detailed sheet: context, method, results, documents and discussions.",
  'tour.tasks': "The Tasks tab is the lab's kanban: to do, in progress, done.",
  'tour.publications': "The lab's publications are listed here.",
  'tour.team': "The Team page introduces the members of both labs and their fields.",
  'tour.data': "Members only: the Data page browses the lab's Dropbox…",
  'tour.prompts': "…and the Prompts page shares the team's prompts.",
  'tour.graph': "The graph shows how subjects relate to each other, across labs.",
  'tour.astra': "And down at the bottom of every page, there's me! Ask me anything, I know the whole site.",

  'subject.create': "Let's create a sheet. In edit mode, the dotted card at the end of the grid adds a new subject.",
  'subject.fill': "The sheet fills in like a poster: question, hook, context, method.",
  'subject.assist': "Not sure how to phrase it? The sparkle suggests a text based on what you already wrote.",
  'subject.i18n': "Write in your own language: the site automatically translates to the other one.",
  'subject.child': "A spin-off idea? Create a child sheet: it inherits the fields you choose.",
  'subject.status': "The status follows the subject's life: active, on hold, done.",
  'subject.confidential': "And the padlock makes the sheet confidential: invisible to visitors. Only members see it.",

  'daily.task': "Day to day, everything goes through tasks. Create one, break it into subtasks.",
  'daily.claim': "Tempted by a task? Claim it: your avatar gets attached to it.",
  'daily.subtasks': "Tick subtasks as you go: the sheet's progress bar follows along.",
  'daily.comments': "Discussions live under the sheet: comments are open to visitors and members alike.",
  'daily.files': "Drop your documents right on the sheet: PDFs, slides, spreadsheets.",
  'daily.filelock': "Each document has its own padlock: a confidential document can live on a public sheet.",
  'daily.dropbox': "And for large datasets, link a Dropbox folder.",

  'reflexes.intro': "Before I let you go, my five good habits.",
  'reflexes.1': "One: drop your documents on the sheets. I read them, and I use them to answer everyone.",
  'reflexes.2': "Two: when in doubt, close the padlock. You can always reopen it later.",
  'reflexes.3': "Three: write in your language, translation takes care of the other one.",
  'reflexes.4': "Four: got a subject idea? Propose it. The Propose page is open to everyone.",
  'reflexes.5': "Five: something looks off? Report it from my panel.",

  'outro.1': "That's it, you know everything! And if you ever feel lost, click my star at the bottom of the page. See you soon!",
}
```

- [ ] **Step 6: Écrire `scenario.ts`** — chapitres et actions. Les sélecteurs sont Playwright (`text=`, `role=`) et seront **validés en dry-run à la Task 5** (l'implémenteur de la Task 5 a le droit de les corriger — pas de changer les beats). `{locale}` est substitué à l'exécution.

```ts
import type { Chapter } from './types'

export const BASE_LAB = 'paris'

// NB Task 5 : les sélecteurs marqués [VERIFY] sont à valider contre le DOM réel
// (composants indiqués en commentaire) lors du dry-run. Corriger le sélecteur,
// jamais la structure des beats.
export const CHAPTERS: Chapter[] = [
  {
    id: 'welcome',
    beats: [
      { line: 'welcome.1', actions: [{ kind: 'goto', path: '/{locale}' }] },
      // Globe.tsx / LabPin.tsx — le pin Paris navigue vers /{locale}/paris  [VERIFY]
      { line: 'welcome.2', actions: [{ kind: 'pause', ms: 1200 }, { kind: 'click', selector: 'text=Paris' }] },
    ],
  },
  {
    id: 'tour',
    beats: [
      { line: 'tour.grid', actions: [{ kind: 'goto', path: '/{locale}/paris' }] },
      // SubjectVitrine — cartes de la grille ; cliquer la 1re carte démo  [VERIFY]
      { line: 'tour.paper', actions: [{ kind: 'click', selector: 'text=Sentiment des annonces' }] },
      { line: 'tour.tasks', actions: [{ kind: 'goto', path: '/{locale}/paris/tasks' }] },
      { line: 'tour.publications', actions: [{ kind: 'goto', path: '/{locale}/paris/publications' }] },
      { line: 'tour.team', actions: [{ kind: 'goto', path: '/{locale}/paris/team' }] },
      { line: 'tour.data', actions: [{ kind: 'goto', path: '/{locale}/paris/data' }] },
      { line: 'tour.prompts', actions: [{ kind: 'goto', path: '/{locale}/paris/prompts' }] },
      { line: 'tour.graph', actions: [{ kind: 'goto', path: '/{locale}/graph' }, { kind: 'pause', ms: 1500 }] },
      // ChatBubble (bas de page) puis ChatPanel  [VERIFY]
      { line: 'tour.astra', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: 'button[aria-label*="Astra"], button[title*="assistant" i]' }] },
    ],
  },
  {
    id: 'subject',
    beats: [
      // EditModeToggle (crayon) puis carte pointillée d'ajout — SubjectGrid  [VERIFY]
      { line: 'subject.create', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: '[aria-label*="édition" i], [aria-label*="edit" i]' }] },
      { line: 'subject.fill', actions: [{ kind: 'click', selector: 'text=Sentiment des annonces' }, { kind: 'pause', ms: 800 }] },
      // Bouton ✨ d'un champ — VitrineEditor / PaperSheet en mode édition  [VERIFY]
      { line: 'subject.assist', actions: [{ kind: 'hover', selector: 'text=✨' }] },
      { line: 'subject.i18n', actions: [{ kind: 'pause', ms: 500 }] },
      // RelationsPanel — bouton « créer une fiche fille »  [VERIFY]
      { line: 'subject.child', actions: [{ kind: 'scroll', y: 600 }] },
      { line: 'subject.status', actions: [{ kind: 'scroll', y: 0 }] },
      // Fiche démo confidentielle S_PRIV — montrer le badge/cadenas  [VERIFY]
      { line: 'subject.confidential', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'hover', selector: 'text=Signal propriétaire' }] },
    ],
  },
  {
    id: 'daily',
    beats: [
      { line: 'daily.task', actions: [{ kind: 'goto', path: '/{locale}/paris/tasks' }] },
      // TaskCard « Baseline de sentiment » → TaskModal → bouton claim  [VERIFY]
      { line: 'daily.claim', actions: [{ kind: 'click', selector: 'text=Baseline de sentiment' }] },
      // SubtaskList dans TaskModal de « Constituer le corpus »  [VERIFY]
      { line: 'daily.subtasks', actions: [{ kind: 'pause', ms: 500 }] },
      { line: 'daily.comments', actions: [{ kind: 'goto', path: '/{locale}/paris' }, { kind: 'click', selector: 'text=Sentiment des annonces' }, { kind: 'scroll', y: 900 }] },
      // FilesPanel — section fichiers déposés  [VERIFY]
      { line: 'daily.files', actions: [{ kind: 'scroll', y: 600 }] },
      { line: 'daily.filelock', actions: [{ kind: 'pause', ms: 500 }] },
      { line: 'daily.dropbox', actions: [{ kind: 'pause', ms: 500 }] },
    ],
  },
  {
    id: 'reflexes',
    // Chapitre « checklist » : l'écran reste sur la grille, la mascotte + les
    // cartes de la checklist portent le contenu (composition Task 7).
    beats: [
      { line: 'reflexes.intro', actions: [{ kind: 'goto', path: '/{locale}/paris' }] },
      { line: 'reflexes.1', actions: [] },
      { line: 'reflexes.2', actions: [] },
      { line: 'reflexes.3', actions: [] },
      { line: 'reflexes.4', actions: [{ kind: 'goto', path: '/{locale}/paris/propose' }] },
      { line: 'reflexes.5', actions: [] },
    ],
  },
  {
    id: 'outro',
    beats: [
      { line: 'outro.1', actions: [{ kind: 'goto', path: '/{locale}' }] },
    ],
  },
]
```

- [ ] **Step 7: Écrire `video/scripts/validate.ts`** — même logique que le test, exécutable seule (utilisée par le README) :

```ts
import { CHAPTERS } from '../scenario/scenario'
import { NARRATION as FR } from '../scenario/narration.fr'
import { NARRATION as EN } from '../scenario/narration.en'

const errors: string[] = []
const frKeys = Object.keys(FR).sort(); const enKeys = Object.keys(EN).sort()
if (JSON.stringify(frKeys) !== JSON.stringify(enKeys)) errors.push('FR/EN keys differ')
for (const ch of CHAPTERS) {
  if (!FR[`chapter.${ch.id}.title`]) errors.push(`missing title: ${ch.id}`)
  for (const b of ch.beats) if (!FR[b.line]) errors.push(`missing line: ${b.line}`)
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`OK — ${CHAPTERS.length} chapters, ${frKeys.length} narration keys`)
```

- [ ] **Step 8: Vérifier** — `cd video && npm test` → PASS ; `npm run validate` → « OK — 6 chapters, … » ; `grep -c "�" scenario/*.ts` → 0 partout.

- [ ] **Step 9: Commit** — `git add video/scenario video/scripts/validate.ts && git commit -m "feat(video): scénario 6 chapitres + narration FR/EN"`

---

### Task 4: TTS OpenAI (WAV + durées + cache)

**Files:**
- Create: `video/scripts/tts.ts`, `video/scripts/wav.ts`
- Create: `video/scripts/wav.test.ts`

**Interfaces:**
- Consumes: `NARRATION` des deux locales (Task 3).
- Produces: `video/audio/<locale>/<lineId>.wav` + `video/audio/<locale>/manifest.json` de forme `Record<lineId, { hash: string; durationMs: number }>`. `wav.ts` exporte `wavDurationMs(buf: Buffer): number`.

- [ ] **Step 1: Test du parseur WAV**

`video/scripts/wav.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { wavDurationMs } from './wav'

function makeWav(dataBytes: number, byteRate: number): Buffer {
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(byteRate, 24); buf.writeUInt32LE(byteRate, 28)
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40)
  return buf
}

describe('wavDurationMs', () => {
  it('calcule la durée depuis byteRate et data size', () => {
    // 48000 B/s, 96000 octets de data → 2000 ms
    expect(wavDurationMs(makeWav(96000, 48000))).toBe(2000)
  })
  it('rejette un buffer non-RIFF', () => {
    expect(() => wavDurationMs(Buffer.from('not a wav file at all'))).toThrow()
  })
})
```

- [ ] **Step 2: Vérifier l'échec** — `cd video && npm test` → FAIL.

- [ ] **Step 3: Implémenter `wav.ts`**

```ts
// Durée d'un WAV PCM : data size / byteRate. Le chunk `data` est cherché par
// balayage (certains encodeurs insèrent LIST/INFO avant).
export function wavDurationMs(buf: Buffer): number {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE buffer')
  }
  const byteRate = buf.readUInt32LE(28)
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'data') return Math.round((size / byteRate) * 1000)
    off += 8 + size + (size % 2)
  }
  throw new Error('No data chunk found')
}
```

- [ ] **Step 4: Vérifier** — `cd video && npm test` → PASS.

- [ ] **Step 5: Implémenter `tts.ts`**

```ts
// Génère les WAV de narration (une voix par locale) avec cache par hash de texte.
// Run: npm run tts            (les deux locales)
//      npm run tts -- fr      (une locale)
import { config } from 'dotenv'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import OpenAI from 'openai'
import { NARRATION as FR } from '../scenario/narration.fr'
import { NARRATION as EN } from '../scenario/narration.en'
import { wavDurationMs } from './wav'

config({ path: ['../.env.local', '../.env'] })
if (!process.env.OPENAI_API_KEY) { console.error('Set OPENAI_API_KEY in ../.env.local'); process.exit(1) }

const openai = new OpenAI()
const VOICES: Record<string, string> = { fr: 'nova', en: 'alloy' }
const SOURCES: Record<string, Record<string, string>> = { fr: FR, en: EN }
const locales = process.argv[2] ? [process.argv[2]] : ['fr', 'en']

type Manifest = Record<string, { hash: string; durationMs: number }>

for (const locale of locales) {
  const dir = `audio/${locale}`
  mkdirSync(dir, { recursive: true })
  const manifestPath = `${dir}/manifest.json`
  const manifest: Manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}

  for (const [id, text] of Object.entries(SOURCES[locale])) {
    if (id.startsWith('chapter.')) continue // titres de cartes : pas de voix
    const hash = createHash('sha256').update(text).digest('hex').slice(0, 16)
    if (manifest[id]?.hash === hash && existsSync(`${dir}/${id}.wav`)) continue
    console.log(`[${locale}] ${id} …`)
    const res = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts', voice: VOICES[locale], input: text, response_format: 'wav',
      instructions: 'Enthusiastic but clear tour-guide voice, natural pace.',
    })
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(`${dir}/${id}.wav`, buf)
    manifest[id] = { hash, durationMs: wavDurationMs(buf) }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  }
  const total = Object.values(manifest).reduce((s, m) => s + m.durationMs, 0)
  console.log(`[${locale}] total narration: ${(total / 1000).toFixed(1)}s`)
}
```

- [ ] **Step 6: Générer et vérifier**

Run: `cd video && npm run tts`
Expected: WAV créés dans `audio/fr/` et `audio/en/`, manifests écrits, total ≈ 250–330 s par locale. Écouter 2–3 fichiers (`xdg-open audio/fr/welcome.1.wav`) pour valider la voix. Relancer `npm run tts` → 0 régénération (cache).

- [ ] **Step 7: Commit** — `git add video/scripts/tts.ts video/scripts/wav.ts video/scripts/wav.test.ts && git commit -m "feat(video): TTS OpenAI avec cache et durées WAV"`

---

### Task 5: Capture Playwright par chapitre

**Files:**
- Create: `video/scripts/capture.ts`, `video/scripts/cursor.ts`
- Create: `video/scripts/timeline.test.ts` (forme de la timeline)

**Interfaces:**
- Consumes: `CHAPTERS`/`BASE_LAB` (Task 3), `audio/<locale>/manifest.json` (Task 4), `DEMO_MEMBER_EMAIL` + `SEED_DEMO_PASSWORD` (Task 1), site sur `http://localhost:3000`.
- Produces: `video/recordings/<locale>/<chapterId>.webm` (1920×1080) + `video/recordings/<locale>/timeline.json` :
  `{ chapters: Array<{ id: string; durationMs: number; beats: Array<{ line: string; startMs: number; durationMs: number }> }> }`
  Invariant : `beat.durationMs >= manifest[line].durationMs` (l'écran ne coupe jamais la voix) ; export `buildTimeline(chapters, manifest, PAD_MS)` pur et testé.

- [ ] **Step 1: Test de `buildTimeline`**

`video/scripts/timeline.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { buildTimeline, PAD_MS } from './capture'

const manifest = { 'a.1': { hash: 'x', durationMs: 3000 }, 'a.2': { hash: 'y', durationMs: 2000 } }
const chapters = [{ id: 'welcome' as const, beats: [{ line: 'a.1', actions: [] }, { line: 'a.2', actions: [] }] }]

describe('buildTimeline', () => {
  it('les beats s\'enchaînent avec le padding et couvrent la voix', () => {
    const tl = buildTimeline(chapters, manifest, PAD_MS)
    const [ch] = tl.chapters
    expect(ch.beats[0]).toEqual({ line: 'a.1', startMs: 0, durationMs: 3000 + PAD_MS })
    expect(ch.beats[1].startMs).toBe(3000 + PAD_MS)
    expect(ch.durationMs).toBe(5000 + 2 * PAD_MS)
  })
  it('échoue si une ligne manque au manifest', () => {
    expect(() => buildTimeline([{ id: 'welcome', beats: [{ line: 'zz', actions: [] }] }], manifest, PAD_MS)).toThrow('zz')
  })
})
```

- [ ] **Step 2: Vérifier l'échec** — `cd video && npm test` → FAIL.

- [ ] **Step 3: Implémenter `cursor.ts`** (curseur virtuel injecté — les captures Playwright n'ont pas de curseur natif)

```ts
// Injecte un faux curseur (rond doré FAME) qui suit les positions de souris
// pilotées par capture.ts, avec une impulsion au clic.
export const CURSOR_INIT_SCRIPT = `
(() => {
  if (window.__fameCursor) return
  const el = document.createElement('div')
  el.style.cssText = 'position:fixed;z-index:2147483647;width:18px;height:18px;border-radius:50%;' +
    'background:rgba(232,177,73,0.9);border:2px solid #15203f;pointer-events:none;' +
    'transform:translate(-50%,-50%);transition:left .05s linear,top .05s linear;left:-50px;top:-50px'
  const attach = () => document.body && document.body.appendChild(el)
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', attach) : attach()
  window.__fameCursor = {
    move(x, y) { el.style.left = x + 'px'; el.style.top = y + 'px' },
    pulse() {
      el.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.8)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 300 })
    },
  }
})()`
```

- [ ] **Step 4: Implémenter `capture.ts`**

```ts
// Capture le screencast chapitre par chapitre, calé sur les durées TTS.
// Prérequis : site sur http://localhost:3000, seed démo appliqué, TTS généré.
// Run: npm run capture -- fr            (une locale)
//      npm run capture                  (les deux)
//      npm run capture -- fr tour       (un seul chapitre — itération sélecteurs)
import { config } from 'dotenv'
import { chromium, type Page } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { CHAPTERS, BASE_LAB } from '../scenario/scenario'
import type { Chapter, Action } from '../scenario/types'
import { CURSOR_INIT_SCRIPT } from './cursor'

config({ path: ['../.env.local', '../.env'] })

export const PAD_MS = 700 // respiration après chaque ligne de narration
const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000'
const SIZE = { width: 1920, height: 1080 }

type Manifest = Record<string, { hash: string; durationMs: number }>
export interface TimelineBeat { line: string; startMs: number; durationMs: number }
export interface Timeline { chapters: Array<{ id: string; durationMs: number; beats: TimelineBeat[] }> }

export function buildTimeline(chapters: ReadonlyArray<Pick<Chapter, 'id' | 'beats'>>, manifest: Manifest, padMs: number): Timeline {
  return {
    chapters: chapters.map(ch => {
      let cursor = 0
      const beats = ch.beats.map(b => {
        const entry = manifest[b.line]
        if (!entry) throw new Error(`No audio for line: ${b.line}`)
        const beat = { line: b.line, startMs: cursor, durationMs: entry.durationMs + padMs }
        cursor += beat.durationMs
        return beat
      })
      return { id: ch.id, durationMs: cursor, beats }
    }),
  }
}

async function runAction(page: Page, a: Action, locale: string) {
  switch (a.kind) {
    case 'goto':
      await page.goto(`${BASE_URL}${a.path.replaceAll('{locale}', locale)}`, { waitUntil: 'networkidle' })
      break
    case 'click': {
      const el = page.locator(a.selector).first()
      const box = await el.boundingBox()
      if (box) {
        await page.evaluate(([x, y]) => (window as never as { __fameCursor: { move(x: number, y: number): void } }).__fameCursor.move(x, y), [box.x + box.width / 2, box.y + box.height / 2] as const)
        await page.waitForTimeout(400)
        await page.evaluate(() => (window as never as { __fameCursor: { pulse(): void } }).__fameCursor.pulse())
      }
      await el.click()
      break
    }
    case 'type': await page.locator(a.selector).first().pressSequentially(a.text, { delay: 55 }); break
    case 'hover': {
      const el = page.locator(a.selector).first()
      const box = await el.boundingBox()
      if (box) await page.evaluate(([x, y]) => (window as never as { __fameCursor: { move(x: number, y: number): void } }).__fameCursor.move(x, y), [box.x + box.width / 2, box.y + box.height / 2] as const)
      await el.hover()
      break
    }
    case 'scroll': await page.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), a.y); break
    case 'pause': await page.waitForTimeout(a.ms); break
  }
}

async function login(locale: string): Promise<string> {
  // Connexion via l'UI une fois par locale → storageState réutilisé par chapitre.
  const password = process.env.SEED_DEMO_PASSWORD
  if (!password) throw new Error('Set SEED_DEMO_PASSWORD in ../.env.local')
  mkdirSync('.auth', { recursive: true })
  const statePath = `.auth/${locale}.json`
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${BASE_URL}/${locale}/auth/login`)
  await page.locator('input[type="email"]').fill('demo-alice@fame-demo.local')
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(url => !url.pathname.includes('login'), { timeout: 15000 })
  await page.context().storageState({ path: statePath })
  await browser.close()
  return statePath
}

async function captureChapter(chapter: Chapter, locale: string, manifest: Manifest, statePath: string) {
  const dir = `recordings/${locale}`
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: SIZE, recordVideo: { dir, size: SIZE }, storageState: statePath, locale,
  })
  await context.addInitScript(CURSOR_INIT_SCRIPT)
  const page = await context.newPage()
  const tl = buildTimeline([chapter], manifest, PAD_MS).chapters[0]

  const t0 = Date.now()
  for (const [i, beat] of chapter.beats.entries()) {
    const target = tl.beats[i]
    for (const a of beat.actions) await runAction(page, a, locale)
    // Attendre la fin du beat (la voix + le padding) avant le suivant
    const remaining = tl.beats[i].startMs + target.durationMs - (Date.now() - t0)
    if (remaining > 0) await page.waitForTimeout(remaining)
  }
  const video = page.video()
  await context.close() // flush le webm
  await browser.close()
  if (video) renameSync(await video.path(), `${dir}/${chapter.id}.webm`)
  console.log(`[${locale}] ${chapter.id}: ${(tl.durationMs / 1000).toFixed(1)}s`)
  return tl
}

async function main() {
  const [localeArg, chapterArg] = process.argv.slice(2)
  const locales = localeArg ? [localeArg] : ['fr', 'en']
  for (const locale of locales) {
    const manifest: Manifest = JSON.parse(readFileSync(`audio/${locale}/manifest.json`, 'utf8'))
    const statePath = existsSync(`.auth/${locale}.json`) ? `.auth/${locale}.json` : await login(locale)
    const chapters = chapterArg ? CHAPTERS.filter(c => c.id === chapterArg) : CHAPTERS
    const done: Timeline['chapters'] = []
    for (const ch of chapters) done.push(await captureChapter(ch, locale, manifest, statePath))
    if (!chapterArg) {
      writeFileSync(`recordings/${locale}/timeline.json`, JSON.stringify({ chapters: done }, null, 2))
      console.log(`[${locale}] timeline.json written (${done.length} chapters)`)
    }
  }
  console.log(`BASE_LAB=${BASE_LAB} — done`)
}

// Ne lancer main() que hors vitest (le test importe buildTimeline/PAD_MS)
if (!process.env.VITEST) main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 5: Vérifier le test** — `cd video && npm test` → PASS (buildTimeline).

- [ ] **Step 6: Valider les sélecteurs [VERIFY] chapitre par chapitre**

Prérequis : à la racine `npm run build && npm run start` (rendu fluide ; sinon `npm run dev`), seed démo appliqué.

Run: `cd video && npm run capture -- fr welcome` puis ouvrir `recordings/fr/welcome.webm`.
Pour chaque sélecteur qui échoue (timeout) : lire le composant indiqué en commentaire dans `scenario.ts` (`src/components/...`), corriger le sélecteur dans `scenario.ts`, relancer le chapitre seul. Répéter pour `tour`, `subject`, `daily`, `reflexes`, `outro`.
Expected: 6 webm FR lisibles, curseur doré visible, chaque écran reste au moins la durée de sa narration.

- [ ] **Step 7: Capture complète**

Run: `cd video && rm -rf recordings && npm run capture`
Expected: `recordings/fr/` et `recordings/en/` avec 6 webm + `timeline.json` chacun ; l'UI est bien dans la langue de la locale (URLs `/{locale}/…`).

- [ ] **Step 8: Commit** — `git add video/scripts/capture.ts video/scripts/cursor.ts video/scripts/timeline.test.ts video/scenario/scenario.ts && git commit -m "feat(video): capture Playwright par chapitre avec curseur virtuel et timeline"`

---

### Task 6: Composants Remotion (mascotte, cartes, sous-titres)

**Files:**
- Create: `video/src/AstraMascot.tsx`, `video/src/ChapterCard.tsx`, `video/src/Captions.tsx`, `video/src/theme.ts`

**Interfaces:**
- Produces:
  - `theme.ts` : `export const FAME = { navy:'#15203f', navyLight:'#18244c', blue:'#2f4486', slate:'#5768ac', gold:'#e8b149', sand:'#fbf9f3', ecru:'#eceadf', textLight:'#eef3ff', textBody:'#2a3457', star:'#9fb6ff' }`, `export const FONT_SERIF = 'Roboto Slab, serif'`, `export const FONT_MONO = 'IBM Plex Mono, monospace'`.
  - `<AstraMascot size={number} mood={'idle'|'happy'} />` — étoile animée, auto-suffisante (utilise `useCurrentFrame`).
  - `<ChapterCard title={string} index={number} />` — plein écran, fond navy étoilé, à séquencer 60 frames (2 s).
  - `<Captions text={string} />` — cartouche bas d'écran.
- Consumed by: Task 7 (`GuideVideo`).

- [ ] **Step 1: `theme.ts`** — écrire les constantes ci-dessus (valeurs = tokens AGENTS.md, `star` = `#9fb6ff` de `ChatBubble.tsx`).

- [ ] **Step 2: `AstraMascot.tsx`**

```tsx
import { useCurrentFrame } from 'remotion'
import { FAME } from './theme'

// Path de l'étoile 4 branches — copié de src/components/assistant/ChatBubble.tsx
const STAR_PATH = 'M50 2 Q50 50 65.6 34.4 Q50 50 98 50 Q50 50 65.6 65.6 Q50 50 50 98 Q50 50 34.4 65.6 Q50 50 2 50 Q50 50 34.4 34.4 Q50 50 50 2 Z'

export function AstraMascot({ size = 110, mood = 'idle' }: { size?: number; mood?: 'idle' | 'happy' }) {
  const frame = useCurrentFrame()
  const float = Math.sin(frame / 22) * 6                     // flottement
  const rot = mood === 'happy' ? Math.sin(frame / 6) * 8 : Math.sin(frame / 40) * 3
  const blink = frame % 105 < 4                              // clignement ~3,5 s
  const eyeRy = blink ? 0.6 : 4.4

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}
      style={{ transform: `translateY(${float}px) rotate(${rot}deg)`, filter: `drop-shadow(0 6px 18px ${FAME.blue}66)` }}>
      <path d={STAR_PATH} fill={FAME.star} />
      {/* halo */}
      <path d={STAR_PATH} fill="none" stroke={FAME.star} strokeOpacity={0.35} strokeWidth={3} transform="scale(1.06) translate(-3,-3)" />
      {/* yeux */}
      <ellipse cx={42} cy={48} rx={3.2} ry={eyeRy} fill={FAME.navy} />
      <ellipse cx={58} cy={48} rx={3.2} ry={eyeRy} fill={FAME.navy} />
      {/* sourire si happy */}
      {mood === 'happy' && <path d="M43 58 Q50 64 57 58" stroke={FAME.navy} strokeWidth={2.4} fill="none" strokeLinecap="round" />}
    </svg>
  )
}
```

- [ ] **Step 3: `ChapterCard.tsx`**

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { AstraMascot } from './AstraMascot'
import { FAME, FONT_MONO, FONT_SERIF } from './theme'

// Étoiles de fond déterministes (pas de Math.random : rendu stable frame à frame)
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 137.5) % 100, y: (i * 61.8) % 100, r: 0.6 + (i % 3) * 0.5,
}))

export function ChapterCard({ title, index }: { title: string; index: number }) {
  const frame = useCurrentFrame()
  const appear = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${FAME.navy}, ${FAME.navyLight})`, alignItems: 'center', justifyContent: 'center' }}>
      <svg style={{ position: 'absolute', inset: 0 }} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} fill={FAME.textLight} opacity={0.5} />)}
      </svg>
      <div style={{ opacity: appear, transform: `translateY(${(1 - appear) * 24}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <AstraMascot size={130} mood="happy" />
        <div style={{ fontFamily: FONT_MONO, color: FAME.gold, letterSpacing: '0.3em', fontSize: 26 }}>
          {String(index).padStart(2, '0')}
        </div>
        <h1 style={{ fontFamily: FONT_SERIF, color: FAME.textLight, fontSize: 84, margin: 0 }}>{title}</h1>
      </div>
    </AbsoluteFill>
  )
}
```

- [ ] **Step 4: `Captions.tsx`**

```tsx
import { interpolate, useCurrentFrame } from 'remotion'
import { FAME, FONT_SERIF } from './theme'

export function Captions({ text }: { text: string }) {
  const frame = useCurrentFrame()
  const appear = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div style={{
      position: 'absolute', bottom: 54, left: '50%',
      transform: `translateX(-50%) translateY(${(1 - appear) * 14}px)`, opacity: appear,
      maxWidth: 1240, background: `${FAME.sand}F2`, border: `1px solid ${FAME.ecru}`,
      borderRadius: 16, padding: '18px 30px', boxShadow: '0 18px 40px -18px rgba(0,5,30,0.5)',
      fontFamily: FONT_SERIF, fontSize: 32, color: FAME.textBody, textAlign: 'center',
    }}>
      {text}
    </div>
  )
}
```

- [ ] **Step 5: Vérifier visuellement** — la vérification passe par la Task 7 (Studio + stills : les composants ont besoin d'une composition). `npx tsc --noEmit -p video/tsconfig.json` → 0 dès maintenant.

- [ ] **Step 6: Commit** — `git add video/src && git commit -m "feat(video): mascotte Astra, cartes de chapitre, sous-titres (Remotion)"`

---

### Task 7: Composition `GuideVideo` + rendu + chapters.json

**Files:**
- Create: `video/src/Root.tsx`, `video/src/GuideVideo.tsx`, `video/src/timing.ts`, `video/src/index.ts`
- Create: `video/src/timing.test.ts`
- Create: `video/scripts/render.ts`

**Interfaces:**
- Consumes: composants Task 6, `recordings/<locale>/{*.webm,timeline.json}`, `audio/<locale>/{*.wav,manifest.json}`, `NARRATION` (sous-titres + titres).
- Produces:
  - `timing.ts` : `computeSchedule(timeline, fps): { chapters: Array<{ id: string; cardFrom: number; cardDuration: number; videoFrom: number; videoDuration: number; beats: Array<{ line: string; from: number; duration: number }> }>; totalFrames: number }` — carte 2 s (60 frames) avant chaque chapitre, frames arrondies via `Math.round(ms * fps / 1000)`.
  - Compositions Remotion : ids `GuideVideo-fr` et `GuideVideo-en`, 1920×1080\@30fps.
  - `npm run render` → `out/fame-guide-<locale>.mp4` + `out/chapters.<locale>.json` de forme `Array<{ id: string; title: string; startSeconds: number }>`.

- [ ] **Step 1: Test de `computeSchedule`**

`video/src/timing.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { computeSchedule, CARD_FRAMES } from './timing'

const timeline = { chapters: [
  { id: 'welcome', durationMs: 10000, beats: [{ line: 'w.1', startMs: 0, durationMs: 10000 }] },
  { id: 'tour', durationMs: 5000, beats: [{ line: 't.1', startMs: 0, durationMs: 5000 }] },
] }

describe('computeSchedule', () => {
  it('carte 2s puis vidéo, chapitres bout à bout', () => {
    const s = computeSchedule(timeline, 30)
    expect(CARD_FRAMES).toBe(60)
    expect(s.chapters[0]).toMatchObject({ cardFrom: 0, cardDuration: 60, videoFrom: 60, videoDuration: 300 })
    expect(s.chapters[1].cardFrom).toBe(360)
    expect(s.totalFrames).toBe(60 + 300 + 60 + 150)
  })
  it('les beats sont positionnés relativement au début vidéo du chapitre', () => {
    const s = computeSchedule(timeline, 30)
    expect(s.chapters[1].beats[0]).toMatchObject({ from: 420, duration: 150 })
  })
})
```

- [ ] **Step 2: Vérifier l'échec** — `cd video && npm test` → FAIL.

- [ ] **Step 3: Implémenter `timing.ts`**

```ts
export const CARD_FRAMES = 60 // 2 s à 30 fps

export interface TimelineJson {
  chapters: Array<{ id: string; durationMs: number; beats: Array<{ line: string; startMs: number; durationMs: number }> }>
}

export function computeSchedule(timeline: TimelineJson, fps: number) {
  const toFrames = (ms: number) => Math.round((ms * fps) / 1000)
  let cursor = 0
  const chapters = timeline.chapters.map(ch => {
    const cardFrom = cursor
    const videoFrom = cardFrom + CARD_FRAMES
    const videoDuration = toFrames(ch.durationMs)
    const beats = ch.beats.map(b => ({ line: b.line, from: videoFrom + toFrames(b.startMs), duration: toFrames(b.durationMs) }))
    cursor = videoFrom + videoDuration
    return { id: ch.id, cardFrom, cardDuration: CARD_FRAMES, videoFrom, videoDuration, beats }
  })
  return { chapters, totalFrames: cursor }
}
```

- [ ] **Step 4: Vérifier** — `cd video && npm test` → PASS.

- [ ] **Step 5: `GuideVideo.tsx`** — assemble tout ; les artefacts sont servis par `staticFile` (les dossiers `audio/` et `recordings/` sont copiés/symlinkés dans `video/public/` par le script de rendu, convention Remotion) :

```tsx
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile } from 'remotion'
import { AstraMascot } from './AstraMascot'
import { Captions } from './Captions'
import { ChapterCard } from './ChapterCard'
import { computeSchedule, type TimelineJson } from './timing'
import { NARRATION as FR } from '../scenario/narration.fr'
import { NARRATION as EN } from '../scenario/narration.en'

export function GuideVideo({ locale, timeline }: { locale: 'fr' | 'en'; timeline: TimelineJson }) {
  const narration = locale === 'fr' ? FR : EN
  const schedule = computeSchedule(timeline, 30)

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {schedule.chapters.map((ch, i) => (
        <Sequence key={ch.id} from={ch.cardFrom} durationInFrames={ch.cardDuration + ch.videoDuration} name={ch.id}>
          <Sequence from={0} durationInFrames={ch.cardDuration}>
            <ChapterCard title={narration[`chapter.${ch.id}.title`]} index={i + 1} />
          </Sequence>
          <Sequence from={ch.cardDuration} durationInFrames={ch.videoDuration}>
            <OffthreadVideo src={staticFile(`recordings/${locale}/${ch.id}.webm`)} muted />
            {ch.beats.map(b => (
              <Sequence key={b.line} from={b.from - ch.videoFrom} durationInFrames={b.duration}>
                <Audio src={staticFile(`audio/${locale}/${b.line}.wav`)} />
                <Captions text={narration[b.line]} />
              </Sequence>
            ))}
            {/* Mascotte en surimpression permanente, coin bas-gauche (la bulle réelle du site est bas-gauche aussi) */}
            <div style={{ position: 'absolute', left: 42, bottom: 150 }}>
              <AstraMascot size={110} mood={ch.id === 'reflexes' || ch.id === 'outro' ? 'happy' : 'idle'} />
            </div>
          </Sequence>
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
```

- [ ] **Step 6: `Root.tsx` + `index.ts`**

```tsx
// Root.tsx — enregistre GuideVideo-fr / GuideVideo-en.
// La timeline est lue au moment du bundling via calculateMetadata (fetch de staticFile).
import { Composition, staticFile } from 'remotion'
import { GuideVideo } from './GuideVideo'
import { computeSchedule, type TimelineJson } from './timing'

const EMPTY: TimelineJson = { chapters: [] }

function makeComposition(locale: 'fr' | 'en') {
  return (
    <Composition
      id={`GuideVideo-${locale}`}
      component={GuideVideo}
      width={1920} height={1080} fps={30}
      durationInFrames={300}
      defaultProps={{ locale, timeline: EMPTY }}
      calculateMetadata={async () => {
        const res = await fetch(staticFile(`recordings/${locale}/timeline.json`))
        const timeline = (await res.json()) as TimelineJson
        return { durationInFrames: Math.max(1, computeSchedule(timeline, 30).totalFrames), props: { locale, timeline } }
      }}
    />
  )
}

export function Root() {
  return <>{makeComposition('fr')}{makeComposition('en')}</>
}
```

```ts
// index.ts — entrée Remotion
import { registerRoot } from 'remotion'
import { Root } from './Root'
registerRoot(Root)
```

- [ ] **Step 7: `render.ts`**

```ts
// Prépare video/public/ (liens vers audio/ et recordings/), rend les 2 MP4,
// écrit les chapters.<locale>.json (timecodes des cartes de chapitres).
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeSchedule, type TimelineJson } from '../src/timing'
import { NARRATION as FR } from '../scenario/narration.fr'
import { NARRATION as EN } from '../scenario/narration.en'

const locales = (process.argv[2] ? [process.argv[2]] : ['fr', 'en']) as Array<'fr' | 'en'>

rmSync('public', { recursive: true, force: true })
mkdirSync('public', { recursive: true })
symlinkSync(resolve('audio'), resolve('public/audio'))
symlinkSync(resolve('recordings'), resolve('public/recordings'))
mkdirSync('out', { recursive: true })

for (const locale of locales) {
  execSync(`npx remotion render src/index.ts GuideVideo-${locale} out/fame-guide-${locale}.mp4`, { stdio: 'inherit' })
  const timeline = JSON.parse(readFileSync(`recordings/${locale}/timeline.json`, 'utf8')) as TimelineJson
  const narration = locale === 'fr' ? FR : EN
  const chapters = computeSchedule(timeline, 30).chapters.map(ch => ({
    id: ch.id, title: narration[`chapter.${ch.id}.title`], startSeconds: Math.floor(ch.cardFrom / 30),
  }))
  writeFileSync(`out/chapters.${locale}.json`, JSON.stringify(chapters, null, 2))
  console.log(`[${locale}] out/fame-guide-${locale}.mp4 + chapters (${chapters.length})`)
}
```

- [ ] **Step 8: Prévisualiser puis rendre**

Run: `cd video && npm run studio` → vérifier dans Remotion Studio : cartes, mascotte (flottement/clignement), sous-titres synchronisés, audio audible. Corriger tailles/positions si besoin.
Run: `npm run render`
Expected: `out/fame-guide-fr.mp4` et `out/fame-guide-en.mp4` (~5–6 min chacun) + `out/chapters.fr.json` / `out/chapters.en.json` (6 entrées). Regarder les 2 MP4 en entier (vérification humaine : synchro voix/écran, aucune donnée réelle à l'écran).

- [ ] **Step 9: Commit** — `git add video/src video/scripts/render.ts && git commit -m "feat(video): composition Remotion GuideVideo + rendu MP4 et chapitres"`

---

### Task 8: Publication Supabase Storage

**Files:**
- Create: `video/scripts/publish.ts`

**Interfaces:**
- Consumes: `out/fame-guide-<locale>.mp4`, `out/chapters.<locale>.json` (Task 7) ; service role (env racine).
- Produces: bucket public `guide-videos` contenant `fame-guide-fr.mp4`, `fame-guide-en.mp4`, `chapters.fr.json`, `chapters.en.json`. URL publique : `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/guide-videos/<name>` (consommée Task 9).

- [ ] **Step 1: Implémenter `publish.ts`**

```ts
// Upload des MP4 + chapitres vers le bucket public `guide-videos` (upsert).
import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

config({ path: ['../.env.local', '../.env'] })
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const) {
  if (!process.env[k]) { console.error(`Set ${k} in ../.env.local`); process.exit(1) }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BUCKET = 'guide-videos'

async function main() {
  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (bucketError && !/already exists/i.test(bucketError.message)) throw bucketError

  const files: Array<[string, string]> = [
    ['out/fame-guide-fr.mp4', 'video/mp4'], ['out/fame-guide-en.mp4', 'video/mp4'],
    ['out/chapters.fr.json', 'application/json'], ['out/chapters.en.json', 'application/json'],
  ]
  for (const [path, contentType] of files) {
    const name = path.replace('out/', '')
    const { error } = await supabase.storage.from(BUCKET).upload(name, readFileSync(path), { contentType, upsert: true })
    if (error) throw new Error(`${name}: ${error.message}`)
    console.log(`uploaded ${name}`)
  }
  console.log(`Public base: ${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`)
}
main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Publier et vérifier**

Run: `cd video && npm run publish`
Run: `curl -sI "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/public/guide-videos/chapters.fr.json" | head -1` → `HTTP/2 200`. Ouvrir l'URL du MP4 FR dans le navigateur → lecture OK.

- [ ] **Step 3: Commit** — `git add video/scripts/publish.ts && git commit -m "feat(video): publication des MP4 et chapitres sur Supabase Storage"`

---

### Task 9: Page `/[locale]/guide` + NavMenu + i18n

**Files:**
- Create: `src/app/[locale]/guide/page.tsx`
- Create: `src/components/guide/GuidePlayer.tsx`
- Create: `src/components/guide/GuidePlayer.test.tsx`
- Modify: `src/components/layout/NavMenu.tsx` (lien après « Graphe », lignes ~105–113)
- Modify: `messages/fr.json`, `messages/en.json` (clé `nav.guide` + namespace `guide`)
- Modify: `src/app/sitemap.ts` (ajouter `/guide` comme `/graph`)

**Interfaces:**
- Consumes: URLs publiques Task 8. Patterns repo : page hors `[lab]` = `src/app/[locale]/graph/page.tsx` (header minimal + `GraphBackButton`), i18n `getTranslations`, `params: Promise<{locale}>` (Next 16).
- Produces: `<GuidePlayer videoUrl chapters labels />` avec `chapters: Array<{ id: string; title: string; startSeconds: number }> | null`.

- [ ] **Step 1: Test du player**

`src/components/guide/GuidePlayer.test.tsx` :

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GuidePlayer } from './GuidePlayer'

const labels = { chaptersTitle: 'Chapitres', unavailable: 'Vidéo indisponible' }
const chapters = [
  { id: 'welcome', title: 'Bienvenue', startSeconds: 0 },
  { id: 'tour', title: "Tour d'horizon", startSeconds: 22 },
]

describe('GuidePlayer', () => {
  it('liste les chapitres avec leur timecode', () => {
    render(<GuidePlayer videoUrl="https://x/v.mp4" chapters={chapters} labels={labels} />)
    expect(screen.getByText('Bienvenue')).toBeTruthy()
    expect(screen.getByText('0:22')).toBeTruthy()
  })
  it('un clic sur un chapitre saute au timecode', () => {
    render(<GuidePlayer videoUrl="https://x/v.mp4" chapters={chapters} labels={labels} />)
    const video = document.querySelector('video') as HTMLVideoElement
    fireEvent.click(screen.getByText("Tour d'horizon"))
    expect(video.currentTime).toBe(22)
  })
  it('affiche le repli si chapitres indisponibles', () => {
    render(<GuidePlayer videoUrl="https://x/v.mp4" chapters={null} labels={labels} />)
    expect(screen.getByText('Vidéo indisponible')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -- src/components/guide` → FAIL.

- [ ] **Step 3: Implémenter `GuidePlayer.tsx`**

```tsx
'use client'
import { useRef } from 'react'

export interface GuideChapter { id: string; title: string; startSeconds: number }
type Labels = { chaptersTitle: string; unavailable: string }

function fmt(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

export function GuidePlayer({ videoUrl, chapters, labels }: {
  videoUrl: string; chapters: GuideChapter[] | null; labels: Labels
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  if (!chapters) {
    return <p className="font-serif text-fame-text-body" style={{ padding: 24 }}>{labels.unavailable}</p>
  }

  const jump = (s: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = s
    v.play().catch(() => {})
  }

  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <video ref={videoRef} src={videoUrl} controls preload="metadata"
        style={{ flex: '1 1 640px', maxWidth: 960, width: '100%', borderRadius: 14, border: '1px solid rgba(20,40,90,0.12)', background: '#000' }} />
      <nav aria-label={labels.chaptersTitle} style={{ flex: '0 1 280px' }}>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9a9684', padding: '4px 0 10px' }}>
          {labels.chaptersTitle}
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {chapters.map((ch, i) => (
            <li key={ch.id}>
              <button onClick={() => jump(ch.startSeconds)}
                className="font-serif hover:bg-[rgba(47,68,134,0.08)] transition-colors text-fame-text-body"
                style={{ display: 'flex', width: '100%', gap: 12, alignItems: 'baseline', padding: '9px 11px', borderRadius: 9, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14.5 }}>
                <span className="font-mono" style={{ fontSize: 11, color: '#b88c30' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ flex: 1 }}>{ch.title}</span>
                <span className="font-mono" style={{ fontSize: 11, color: '#9a9684' }}>{fmt(ch.startSeconds)}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: Vérifier** — `npm test -- src/components/guide` → PASS.

- [ ] **Step 5: Page RSC** — `src/app/[locale]/guide/page.tsx` (même squelette que `graph/page.tsx` : metadata + header minimal + `GraphBackButton` réutilisé) :

```tsx
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { GraphBackButton } from '@/components/graph/GraphBackButton'
import { GuidePlayer, type GuideChapter } from '@/components/guide/GuidePlayer'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'guide' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

async function fetchChapters(locale: string): Promise<GuideChapter[] | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  try {
    const res = await fetch(`${base}/storage/v1/object/public/guide-videos/chapters.${locale}.json`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    return (await res.json()) as GuideChapter[]
  } catch { return null }
}

export default async function GuidePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'guide' })
  const chapters = await fetchChapters(locale)
  const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/guide-videos/fame-guide-${locale}.mp4`

  return (
    <div className="min-h-screen bg-fame-sand-bg">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-fame-ecru bg-white/70 backdrop-blur-sm">
        <GraphBackButton locale={locale} />
        <span className="w-px h-4 bg-fame-ecru" aria-hidden="true" />
        <span className="font-mono text-xs text-fame-slate tracking-widest uppercase select-none">{t('kicker')}</span>
        <h1 className="font-mono text-sm font-semibold text-fame-text-dark tracking-wide">{t('title')}</h1>
      </header>
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '36px 24px' }}>
        <p className="font-serif text-fame-text-body" style={{ fontSize: 17, maxWidth: 720, marginBottom: 28 }}>{t('intro')}</p>
        <GuidePlayer videoUrl={videoUrl} chapters={chapters}
          labels={{ chaptersTitle: t('chaptersTitle'), unavailable: t('unavailable') }} />
      </main>
    </div>
  )
}
```

- [ ] **Step 6: i18n** — dans `messages/fr.json` : `nav.guide: "Guide"` (après `"graph"`), et nouveau namespace (après `graph`) :

```json
  "guide": {
    "metaTitle": "Guide du site — FAME",
    "metaDescription": "Visite guidée du site FAME par Astra : fiches, tâches, documents et bons réflexes.",
    "kicker": "FAME",
    "title": "Guide du site",
    "intro": "Nouveau membre ? Astra vous fait visiter : les fiches de recherche, le kanban, les documents et les bons réflexes pour que le labo tourne rond. Utilisez le sommaire pour sauter à un chapitre.",
    "chaptersTitle": "Chapitres",
    "unavailable": "La vidéo n'est pas encore disponible. Revenez bientôt !"
  },
```

Dans `messages/en.json` : `nav.guide: "Guide"` et :

```json
  "guide": {
    "metaTitle": "Site guide — FAME",
    "metaDescription": "A guided tour of the FAME website by Astra: sheets, tasks, documents and good habits.",
    "kicker": "FAME",
    "title": "Site guide",
    "intro": "New member? Astra shows you around: research sheets, the kanban, documents and the good habits that keep the lab running smoothly. Use the table of contents to jump to a chapter.",
    "chaptersTitle": "Chapters",
    "unavailable": "The video is not available yet. Check back soon!"
  },
```

- [ ] **Step 7: NavMenu** — dans `src/components/layout/NavMenu.tsx`, dupliquer le bloc « graph » (lignes ~105–113) juste en dessous, en remplaçant `graph` par `guide` :

```tsx
            <Link
              href={`/${locale}/guide`}
              onClick={() => setOpen(false)}
              className="font-serif hover:bg-[rgba(47,68,134,0.08)] transition-colors text-fame-text-body"
              style={itemStyle}
            >
              {t('guide')}
            </Link>
```

- [ ] **Step 8: Sitemap** — dans `src/app/sitemap.ts`, ajouter les URLs `/{locale}/guide` sur le modèle exact des entrées `graph` existantes (mêmes locales, même priorité).

- [ ] **Step 9: Vérifier**

Run: `npm test` → tout vert ; `npx tsc --noEmit` → 0 ; `npm run lint` → 0 ; `grep -c "�" messages/fr.json src/app/\[locale\]/guide/page.tsx` → 0.
Run: `npm run dev` → ouvrir `http://localhost:3000/fr/guide` : vidéo lisible, sommaire saute aux chapitres ; `http://localhost:3000/en/guide` idem ; lien « Guide » dans le menu.

- [ ] **Step 10: Commit** — `git add src/app/\[locale\]/guide src/components/guide src/components/layout/NavMenu.tsx messages src/app/sitemap.ts && git commit -m "feat(guide): page /guide avec lecteur chapitré + lien NavMenu"`

---

### Task 10: Pipeline complet + STATUS.md

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Rejouer le pipeline de bout en bout** (ordre du README `video/`) :

```bash
npm run seed:demo                       # racine
npm run build && npm run start &        # site en prod locale
cd video && npm run validate && npm run tts && npm run capture && npm run render && npm run publish
```

Expected: chaque étape exit 0 ; les MP4 finaux et `/fr/guide` + `/en/guide` fonctionnent.

- [ ] **Step 2: Checklist de vérification humaine** (à faire par Luca, lister dans STATUS) : regarder les 2 MP4 en entier (synchro voix/écran, sous-titres, mascotte, aucune donnée réelle) ; page guide dans les 2 locales ; lecture depuis un autre appareil (URL publique).

- [ ] **Step 3: Purge optionnelle** — après tournage, `npm run seed:demo -- --purge` si on ne veut pas garder le contenu démo en dev (le re-seed est une commande).

- [ ] **Step 4: Mettre à jour `docs/STATUS.md`** — nouvelle entrée en tête de « Où on en est » : vidéo d'onboarding livrée (pipeline `video/`, commandes, page `/guide`, bucket `guide-videos`, ce qui reste = vérif humaine des MP4). Vérifier `grep -c "�"` → 0.

- [ ] **Step 5: Commit final** — `git add docs/STATUS.md && git commit -m "docs(status): vidéo d'onboarding Astra livrée (pipeline video/ + page guide)"`

---

## Self-Review (fait à l'écriture du plan)

- **Couverture spec** : diffusion (MP4 + page ✔ Tasks 8–9), chapitrage ✔ (Tasks 3/7/9), mascotte ✔ (Task 6), TTS FR/EN ✔ (Task 4), seed démo purgeable ✔ (Task 1), maintenance/régénération ✔ (cache TTS Task 4, capture par chapitre Task 5, README Task 2), hors-périmètre respecté (pas de player custom, sous-titres incrustés).
- **Sélecteurs Playwright** : marqués `[VERIFY]` avec composant source ; validation itérative outillée (`npm run capture -- fr <chapitre>`) — assumé, le DOM réel fait foi.
- **Cohérence des types** : `Timeline`/`TimelineJson` (Task 5/7) ont la même forme JSON ; `GuideChapter` (Task 9) = sortie de `render.ts` (Task 7) ; `PAD_MS`/`CARD_FRAMES` exportés là où testés.
- **Risque connu** : `calculateMetadata` + `staticFile` pour lire `timeline.json` au rendu — si la lecture échoue en CLI, replier sur la lecture du JSON dans `render.ts` passé en `--props`. Le studio (Task 7 Step 8) le révèle immédiatement.
