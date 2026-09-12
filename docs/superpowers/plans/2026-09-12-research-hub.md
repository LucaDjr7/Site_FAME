# Hub de veille recherche (IA × finance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an automated weekly research-paper monitoring pipeline (arXiv/OpenAlex/RePEc/Semantic Scholar) with FAME-relevance scoring, a public filterable list page, member bookmarks/notes, and an admin override page — no human review queue, publication is automatic above a score threshold.

**Architecture:** A pure fetch/scoring library (`src/lib/research/`) adapted from the audited `Papyrus` project (zero-Prisma source adapters + scoring math ported almost verbatim) runs weekly via Vercel Cron, writing directly to Supabase through the existing service-role pattern. Two new Next.js routes (`/research` public, `/admin/research`) and a handful of `/api/research/*` routes wrap it, following every convention already established in this repo (RLS enabled with no policies — app-layer authorization only, `requireAdmin`/`requireMember`, i18n in both `en.json`/`fr.json`, vitest).

**Tech Stack:** Next.js 16.2.9 / React 19.2.4 / TypeScript, Supabase (`@supabase/ssr`, pgvector already enabled), next-intl, vitest. New deps: `fast-xml-parser` (arXiv/RePEc are XML/RSS), `fuse.js` (fuzzy title dedup).

**Spec:** `docs/superpowers/specs/2026-09-12-research-hub-design.md`

## Global Constraints

- Next.js 16: `params`/`searchParams` in page props are `Promise<{...}>` — always `await` them.
- Zero hardcoded UI strings — every visible string goes through `useTranslations()`/`getTranslations()`, with keys added to **both** `messages/en.json` and `messages/fr.json` in the same task.
- All **writes** go through `/api/` routes using `createServiceClient()` (service-role, bypasses RLS). Never call Supabase directly from a client component for a mutation.
- **No RLS policies exist anywhere in this repo** (RLS is enabled on every table but has zero `create policy` statements — verified by grepping `supabase/migrations/`). Authorization is 100% application-layer: `requireMember()`/`requireAdmin()` in routes, explicit `.eq('status', 'published')` / `.eq('user_id', member.id)` filters in queries. Follow this exact pattern for every new table — do not introduce RLS policies as a first for this feature.
- Test runner is **vitest** (`describe`/`it`/`expect`/`vi` from `'vitest'`), not jest. Run tests with `npx vitest run <path>`.
- Lab slugs are validated in every route handler that takes one; this feature's tables are **not** lab-scoped (no `labo` column) since research literature isn't lab-specific.
- Embedding calls reuse the existing provider: `getEmbeddingProvider()` from `@/lib/llm`, backed by `OPENAI_API_KEY` (already configured for the Astra assistant RAG). **No new API key or provider to wire up.**
- `manual_override = true` rows (admin hide / republish / manual add) are never modified by the automated weekly job — every pipeline write path must check this flag before touching a row.
- SSRN is out of scope (Cloudflare-blocked, needs headful Chrome — confirmed independently by both audited projects). Do not add an SSRN source in this plan.
- No PDF storage — only title/authors/abstract/url metadata, matching both audited projects (embedding input is `title + abstract`, never full PDF text).
- New migration file: `supabase/migrations/017_research_hub.sql`.

---

### Task 1: Database schema & shared types

**Files:**
- Create: `supabase/migrations/017_research_hub.sql`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `ResearchPaper`, `ResearchStatus`, `ResearchSource`, `ResearchBookmark`, `ResearchNote`, `ResearchFetchLogEntry` types, used by every later task.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/017_research_hub.sql
-- Hub de veille recherche IA×finance — fetch automatisé, pas de policy RLS
-- (convention du projet : RLS activée, autorisation gérée côté application).

create table research_papers (
  id               uuid primary key default gen_random_uuid(),
  fingerprint      text not null unique,
  title            text not null,
  authors          text[] not null default '{}',
  abstract         text,
  url              text not null,
  source           text not null check (source in ('arxiv','openalex','repec','semantic_scholar','manual')),
  venue            text,
  themes           text[] not null default '{}',
  fame_score       int,
  embedding        vector(1536),
  published_at     date,
  status           text not null,
  manual_override  boolean not null default false,
  fetched_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint research_papers_status_check check (status in ('published','rejected','hidden'))
);
create index research_papers_status_idx on research_papers (status, published_at desc);
alter table research_papers enable row level security;

create table research_fetch_log (
  id         uuid primary key default gen_random_uuid(),
  run_at     timestamptz not null default now(),
  source     text not null,
  added      int not null default 0,
  skipped    int not null default 0,
  errors     int not null default 0,
  message    text
);
alter table research_fetch_log enable row level security;

create table research_bookmarks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  paper_id   uuid not null references research_papers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);
alter table research_bookmarks enable row level security;

create table research_notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  paper_id   uuid not null references research_papers(id) on delete cascade,
  content    text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, paper_id)
);
alter table research_notes enable row level security;
```

Run it in the Supabase SQL editor (or `supabase db push` if the CLI is linked) — same process as every prior migration in this repo (see the comment header convention in `006_assistant_rag.sql`).

- [ ] **Step 2: Add the TypeScript types**

Append to `src/types/index.ts` (near the other domain sections, e.g. after `Publication`):

```ts
// ─── Research hub ────────────────────────────────────────────────────────────

export type ResearchStatus = 'published' | 'rejected' | 'hidden'
export type ResearchSource = 'arxiv' | 'openalex' | 'repec' | 'semantic_scholar' | 'manual'

export interface ResearchPaper {
  id: string
  fingerprint: string
  title: string
  authors: string[]
  abstract: string | null
  url: string
  source: ResearchSource
  venue: string | null
  themes: string[]
  fame_score: number | null
  published_at: string | null
  status: ResearchStatus
  manual_override: boolean
  fetched_at: string
  updated_at: string
}

export interface ResearchBookmark {
  user_id: string
  paper_id: string
  created_at: string
}

export interface ResearchNote {
  user_id: string
  paper_id: string
  content: string
  updated_at: string
}

export interface ResearchFetchLogEntry {
  id: string
  run_at: string
  source: string
  added: number
  skipped: number
  errors: number
  message: string | null
}
```

Note: `embedding` is intentionally **not** in the `ResearchPaper` type — it's write-only from the app's perspective (never read back into a UI), so no TS consumer needs it.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/017_research_hub.sql src/types/index.ts
git commit -m "feat(research): add research_papers/bookmarks/notes/fetch_log schema"
```

---

### Task 2: Source-adapter shared types & HTTP retry helper

**Files:**
- Create: `src/lib/research/sources/types.ts`
- Create: `src/lib/research/sources/fetch-utils.ts`
- Test: `src/lib/research/sources/fetch-utils.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module)
- Produces: `NormalizedPaper` interface, `fetchWithRetry(url, init, sourceName, attempt?): Promise<Response>` — used by every source adapter in Tasks 3-6.

- [ ] **Step 1: Write `types.ts`**

```ts
// src/lib/research/sources/types.ts
// Shape every source adapter normalizes into — mirrors research_papers columns
// that come straight from the fetch (fingerprint/status/themes/score are computed later).
export interface NormalizedPaper {
  title: string
  abstract: string
  authors: string[]
  doi: string | null
  url: string
  source: 'arxiv' | 'openalex' | 'repec' | 'semantic_scholar'
  venue: string | null
  publishedAt: string | null // ISO date, or null if unknown
}
```

- [ ] **Step 2: Write the failing test for the retry helper**

```ts
// src/lib/research/sources/fetch-utils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry } from './fetch-utils'

describe('fetchWithRetry', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('returns immediately on a 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await fetchWithRetry('http://x', {}, 'test')
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const promise = fetchWithRetry('http://x', {}, 'test')
    await vi.runAllTimersAsync()
    const res = await promise
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after 3 attempts on repeated 500s', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const promise = fetchWithRetry('http://x', {}, 'test')
    const assertion = expect(promise).rejects.toThrow('test] HTTP 500 after 3 attempts')
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/research/sources/fetch-utils.test.ts`
Expected: FAIL — `Cannot find module './fetch-utils'`

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/research/sources/fetch-utils.ts
// Shared HTTP retry: exponential backoff on 429/5xx, gives up after 3 attempts.
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  sourceName: string,
  attempt = 1
): Promise<Response> {
  const res = await fetch(url, init)

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 3) throw new Error(`[${sourceName}] HTTP ${res.status} after 3 attempts`)
    const delay = Math.pow(2, attempt) * 1000
    await new Promise((r) => setTimeout(r, delay))
    return fetchWithRetry(url, init, sourceName, attempt + 1)
  }

  return res
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/research/sources/fetch-utils.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/research/sources/types.ts src/lib/research/sources/fetch-utils.ts src/lib/research/sources/fetch-utils.test.ts
git commit -m "feat(research): add source adapter shared types + HTTP retry helper"
```

---

### Task 3: arXiv source adapter

**Files:**
- Modify: `package.json` (add `fast-xml-parser`)
- Create: `src/lib/research/sources/arxiv.ts`
- Test: `src/lib/research/sources/arxiv.test.ts`

**Interfaces:**
- Consumes: `NormalizedPaper` (Task 2), `fetchWithRetry` (Task 2)
- Produces: `searchArxiv(query: string, limit?: number): Promise<NormalizedPaper[]>`

- [ ] **Step 1: Add the dependency**

```bash
npm install fast-xml-parser@^5.8.0
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/research/sources/arxiv.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchArxiv } from './arxiv'

const FEED_XML = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.01234v1</id>
    <title>LLM sentiment for stock return prediction</title>
    <summary>We study transformer-based sentiment scoring of financial news.</summary>
    <published>2024-01-02T00:00:00Z</published>
    <author><name>Jane Doe</name></author>
  </entry>
</feed>`

afterEach(() => vi.restoreAllMocks())

describe('searchArxiv', () => {
  it('normalizes an arXiv Atom entry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FEED_XML, { status: 200 })))
    const papers = await searchArxiv('llm finance', 10)
    expect(papers).toHaveLength(1)
    expect(papers[0]).toMatchObject({
      title: 'LLM sentiment for stock return prediction',
      abstract: 'We study transformer-based sentiment scoring of financial news.',
      authors: ['Jane Doe'],
      source: 'arxiv',
      url: 'http://arxiv.org/abs/2401.01234v1',
      publishedAt: '2024-01-02T00:00:00.000Z',
    })
  })

  it('returns an empty array on HTTP failure without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))
    const papers = await searchArxiv('anything')
    expect(papers).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/research/sources/arxiv.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

Adapted from the audited `Papyrus` project's `lib/sources/arxiv.ts` (zero Prisma dependency there — ported near-verbatim, renamed `searchPapers` → `searchArxiv`, `doi` field dropped from the return since our schema tracks it only via the fingerprint, `venue` added as `null`):

```ts
// src/lib/research/sources/arxiv.ts
// ArXiv API client — all ArXiv calls must go through this module.
// ArXiv serves Atom XML (not JSON) and limits clients to ~3 req/sec.
import { XMLParser } from 'fast-xml-parser'
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const BASE = 'http://export.arxiv.org/api/query'

interface ArxivAuthor { name: string }
interface ArxivEntry {
  title: string
  summary: string
  published: string
  id: string
  author: ArxivAuthor | ArxivAuthor[]
}
interface ArxivFeed { feed: { entry?: ArxivEntry | ArxivEntry[] } }

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true })

function toArray(entry: ArxivEntry | ArxivEntry[] | undefined): ArxivEntry[] {
  if (!entry) return []
  return Array.isArray(entry) ? entry : [entry]
}

function authorNames(author: ArxivAuthor | ArxivAuthor[]): string[] {
  const list = Array.isArray(author) ? author : [author]
  return list.map((a) => a.name).filter((n): n is string => Boolean(n))
}

export async function searchArxiv(query: string, limit = 50): Promise<NormalizedPaper[]> {
  const maxResults = Math.min(limit, 200)
  const url = `${BASE}?search_query=${encodeURIComponent(`all:${query}`)}&start=0&max_results=${maxResults}`

  let res: Response
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/atom+xml' } }, 'arxiv')
  } catch (err) {
    console.error('[arxiv] fetch error:', err)
    return []
  }
  if (!res.ok) {
    console.error(`[arxiv] HTTP ${res.status}`)
    return []
  }

  const xml = await res.text()
  const parsed = parser.parse(xml) as ArxivFeed

  return toArray(parsed.feed?.entry)
    .map((e): NormalizedPaper | null => {
      const title = typeof e.title === 'string' ? e.title.trim() : ''
      const abstract = typeof e.summary === 'string' ? e.summary.trim() : ''
      if (!title || !abstract) return null
      return {
        title,
        abstract,
        authors: authorNames(e.author),
        doi: null,
        url: e.id,
        source: 'arxiv',
        venue: null,
        publishedAt: e.published ? new Date(e.published).toISOString() : null,
      }
    })
    .filter((p): p is NormalizedPaper => p !== null)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/research/sources/arxiv.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/research/sources/arxiv.ts src/lib/research/sources/arxiv.test.ts
git commit -m "feat(research): add arXiv source adapter"
```

---

### Task 4: OpenAlex source adapter

**Files:**
- Modify: `.env.example` (add `OPENALEX_MAILTO`)
- Create: `src/lib/research/sources/openalex.ts`
- Test: `src/lib/research/sources/openalex.test.ts`

**Interfaces:**
- Consumes: `NormalizedPaper`, `fetchWithRetry` (Task 2)
- Produces: `searchOpenAlex(query: string, limit?: number): Promise<NormalizedPaper[]>`

- [ ] **Step 1: Add the env var placeholder**

Append to `.env.example` (near the other server-only integration keys):

```
# --- Research hub (server-only) ---
OPENALEX_MAILTO=                     # required by OpenAlex's "polite pool" — a real contact email
SEMANTIC_SCHOLAR_API_KEY=            # optional, raises the rate limit
CRON_SECRET=                         # Vercel Cron sends this as `Authorization: Bearer <value>`
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/research/sources/openalex.test.ts
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { searchOpenAlex } from './openalex'

const WORK = {
  id: 'https://openalex.org/W123',
  doi: 'https://doi.org/10.1/abc',
  title: 'Deep learning for factor investing',
  publication_date: '2024-03-01',
  abstract_inverted_index: { Deep: [0], learning: [1], works: [2] },
  authorships: [{ author: { display_name: 'A. Researcher' } }],
  primary_location: { landing_page_url: 'https://journal.example/abc' },
}

beforeEach(() => { process.env.OPENALEX_MAILTO = 'test@example.com' })
afterEach(() => { vi.restoreAllMocks(); delete process.env.OPENALEX_MAILTO })

describe('searchOpenAlex', () => {
  it('reconstructs the abstract from the inverted index and normalizes the work', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [WORK] }), { status: 200 })
    ))
    const papers = await searchOpenAlex('factor investing', 10)
    expect(papers).toHaveLength(1)
    expect(papers[0]).toMatchObject({
      title: 'Deep learning for factor investing',
      abstract: 'Deep learning works',
      authors: ['A. Researcher'],
      doi: '10.1/abc',
      url: 'https://journal.example/abc',
      source: 'openalex',
      publishedAt: '2024-03-01',
    })
  })

  it('throws if OPENALEX_MAILTO is not set', async () => {
    delete process.env.OPENALEX_MAILTO
    await expect(searchOpenAlex('x')).rejects.toThrow('OPENALEX_MAILTO')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/research/sources/openalex.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

Adapted from `Papyrus`'s `lib/sources/openAlex.ts` — the venue-filter split (finance venues vs AI/ML venues, run in parallel, deduped, falling back to an unfiltered query) is dropped for simplicity: our own two-stage relevance gate (Task 8) + FAME score (Task 10) already do this filtering, so a single unfiltered OpenAlex search per query is enough and much simpler to maintain. `OPENALEX_MAILTO` is required (no hardcoded personal-email fallback, unlike Papyrus):

```ts
// src/lib/research/sources/openalex.ts
// OpenAlex API client — all OpenAlex calls must go through this module.
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const BASE = 'https://api.openalex.org/works'

interface OAAuthorship { author: { display_name: string | null } | null }
interface OAWork {
  id: string
  doi: string | null
  title: string | null
  publication_date: string | null
  abstract_inverted_index: Record<string, number[]> | null
  authorships: OAAuthorship[]
  primary_location: { landing_page_url: string | null } | null
}
interface OASearchResponse { results: OAWork[] }

// OpenAlex stores abstracts as an inverted index { word: [positions] } — rebuild
// the original text by placing each word at its position.
function reconstructAbstract(index: Record<string, number[]> | null): string {
  if (!index) return ''
  const slots: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) slots[pos] = word
  }
  return slots.filter((w) => w !== undefined).join(' ').trim()
}

function normalizeWork(w: OAWork): NormalizedPaper | null {
  const abstract = reconstructAbstract(w.abstract_inverted_index)
  if (!w.title || !abstract) return null
  const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, '') : null
  return {
    title: w.title,
    abstract,
    authors: w.authorships.map((a) => a.author?.display_name).filter((n): n is string => Boolean(n)),
    doi,
    url: w.primary_location?.landing_page_url ?? w.id,
    source: 'openalex',
    venue: null,
    publishedAt: w.publication_date ?? null,
  }
}

export async function searchOpenAlex(query: string, limit = 50): Promise<NormalizedPaper[]> {
  const mailto = process.env.OPENALEX_MAILTO
  if (!mailto) throw new Error('Missing OPENALEX_MAILTO')

  const perPage = Math.min(limit, 200)
  const url = `${BASE}?search=${encodeURIComponent(query)}&per-page=${perPage}&mailto=${encodeURIComponent(mailto)}`

  let res: Response
  try {
    res = await fetchWithRetry(url, { headers: { Accept: 'application/json' } }, 'openalex')
  } catch (err) {
    console.error('[openalex] fetch error:', err)
    return []
  }
  if (!res.ok) {
    console.error(`[openalex] HTTP ${res.status}`)
    return []
  }

  try {
    const json = (await res.json()) as OASearchResponse
    return json.results.map(normalizeWork).filter((p): p is NormalizedPaper => p !== null)
  } catch (err) {
    console.error('[openalex] parse error:', err)
    return []
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/research/sources/openalex.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add .env.example src/lib/research/sources/openalex.ts src/lib/research/sources/openalex.test.ts
git commit -m "feat(research): add OpenAlex source adapter"
```

---

### Task 5: RePEc source adapter

**Files:**
- Create: `src/lib/research/sources/repec.ts`
- Test: `src/lib/research/sources/repec.test.ts`

**Interfaces:**
- Consumes: `NormalizedPaper`, `fetchWithRetry` (Task 2)
- Produces: `searchRepec(limit?: number): Promise<NormalizedPaper[]>` — note: **no query param** (RePEc/NEP is a fixed set of curated RSS feeds, not a search API).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/research/sources/repec.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchRepec } from './repec'

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Market microstructure and machine learning</title>
    <description>&lt;p&gt;We study order book dynamics with ML.&lt;/p&gt;</description>
    <link>https://doi.org/10.2/xyz</link>
    <dc:creator>J. Smith, K. Lee</dc:creator>
    <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
  </item>
</channel></rss>`

afterEach(() => vi.restoreAllMocks())

describe('searchRepec', () => {
  it('parses an RSS item, strips HTML from the description, splits authors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(RSS, { status: 200 })))
    const papers = await searchRepec(50)
    expect(papers.length).toBeGreaterThan(0)
    expect(papers[0]).toMatchObject({
      title: 'Market microstructure and machine learning',
      abstract: 'We study order book dynamics with ML.',
      authors: ['J. Smith', 'K. Lee'],
      doi: '10.2/xyz',
      source: 'repec',
    })
  })

  it('never throws when one feed fails — returns whatever the other feeds produced', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const papers = await searchRepec(50)
    expect(papers).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/research/sources/repec.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Adapted from `Papyrus`'s `lib/sources/repec.ts` (same NEP report codes as `ArdiaD/fame`'s `config.yaml`: `nep-fmk`, `nep-cmp`, `nep-big`, `nep-rmg`, `nep-fin`):

```ts
// src/lib/research/sources/repec.ts
// RSS adapter for RePEc/NEP curated economics feeds — no search query, fixed feed list.
import { XMLParser } from 'fast-xml-parser'
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const NEP_CODES = ['nep-fmk', 'nep-cmp', 'nep-big', 'nep-rmg', 'nep-fin'] as const
type NepCode = (typeof NEP_CODES)[number]

const BASE = 'https://nep.repec.org'

interface RepecItem {
  title?: string
  description?: string
  link?: string
  'dc:creator'?: string
  pubDate?: string
}
interface RepecFeed { rss: { channel: { item?: RepecItem | RepecItem[] } } }

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function extractDoi(link: string | undefined): string | null {
  if (!link) return null
  const idx = link.indexOf('doi.org/')
  return idx === -1 ? null : link.slice(idx + 'doi.org/'.length) || null
}

function toItemArray(raw: RepecItem | RepecItem[] | undefined): RepecItem[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

async function fetchFeed(code: NepCode): Promise<NormalizedPaper[]> {
  let res: Response
  try {
    res = await fetchWithRetry(`${BASE}/${code}.rss`, {}, 'repec')
  } catch (err) {
    console.error(`[repec:${code}] error:`, err)
    return []
  }
  if (!res.ok) {
    console.error(`[repec:${code}] HTTP ${res.status}`)
    return []
  }

  let parsed: RepecFeed
  try {
    parsed = parser.parse(await res.text()) as RepecFeed
  } catch (err) {
    console.error(`[repec:${code}] XML parse failed:`, err)
    return []
  }

  return toItemArray(parsed.rss?.channel?.item)
    .map((item): NormalizedPaper | null => {
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const abstract = stripHtml(typeof item.description === 'string' ? item.description : '').trim()
      if (!title || !abstract) return null

      const authors = (item['dc:creator'] ?? '')
        .split(/[,;]/)
        .map((a) => a.trim())
        .filter((a) => a.length > 0)
      const link = typeof item.link === 'string' ? item.link.trim() : ''
      const d = item.pubDate ? new Date(item.pubDate) : null

      return {
        title,
        abstract,
        authors,
        doi: extractDoi(link),
        url: link,
        source: 'repec',
        venue: null,
        publishedAt: d && !isNaN(d.getTime()) ? d.toISOString() : null,
      }
    })
    .filter((p): p is NormalizedPaper => p !== null)
}

export async function searchRepec(limit = 50): Promise<NormalizedPaper[]> {
  const results = await Promise.all(NEP_CODES.map(fetchFeed))
  return results.flat().slice(0, limit)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/research/sources/repec.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/sources/repec.ts src/lib/research/sources/repec.test.ts
git commit -m "feat(research): add RePEc source adapter"
```

---

### Task 6: Semantic Scholar source adapter

**Files:**
- Create: `src/lib/research/sources/semantic-scholar.ts`
- Test: `src/lib/research/sources/semantic-scholar.test.ts`

**Interfaces:**
- Consumes: `NormalizedPaper`, `fetchWithRetry` (Task 2)
- Produces: `searchSemanticScholar(query: string, limit?: number): Promise<NormalizedPaper[]>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/research/sources/semantic-scholar.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchSemanticScholar } from './semantic-scholar'

const RESPONSE = {
  data: [{
    paperId: 'abc123',
    title: 'Reinforcement learning for portfolio rebalancing',
    abstract: 'We train an RL agent to rebalance a multi-asset portfolio.',
    authors: [{ authorId: '1', name: 'X. Chen' }],
    externalIds: { DOI: '10.3/rl-portfolio' },
    url: 'https://www.semanticscholar.org/paper/abc123',
    publicationDate: '2024-05-10',
  }],
}

afterEach(() => vi.restoreAllMocks())

describe('searchSemanticScholar', () => {
  it('normalizes a search result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(RESPONSE), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const papers = await searchSemanticScholar('reinforcement learning portfolio', 10)
    expect(papers).toEqual([{
      title: 'Reinforcement learning for portfolio rebalancing',
      abstract: 'We train an RL agent to rebalance a multi-asset portfolio.',
      authors: ['X. Chen'],
      doi: '10.3/rl-portfolio',
      url: 'https://www.semanticscholar.org/paper/abc123',
      source: 'semantic_scholar',
      venue: null,
      publishedAt: '2024-05-10',
    }])
  })

  it('sends an x-api-key header when SEMANTIC_SCHOLAR_API_KEY is set', async () => {
    process.env.SEMANTIC_SCHOLAR_API_KEY = 'secret-key'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await searchSemanticScholar('x')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('secret-key')
    delete process.env.SEMANTIC_SCHOLAR_API_KEY
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/research/sources/semantic-scholar.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Adapted from `Papyrus`'s `lib/sources/semanticScholar.ts` (the `getReferences` citation-lookup export is dropped — out of scope per spec, no citation graph in v1):

```ts
// src/lib/research/sources/semantic-scholar.ts
// Semantic Scholar API client — all calls must go through this module.
import type { NormalizedPaper } from './types'
import { fetchWithRetry } from './fetch-utils'

const BASE = 'https://api.semanticscholar.org/graph/v1'
const FIELDS = 'paperId,title,abstract,authors,externalIds,url,publicationDate'

interface SSAuthor { authorId: string; name: string }
interface SSPaper {
  paperId: string
  title: string
  abstract: string | null
  authors: SSAuthor[]
  externalIds: Record<string, string> | null
  url: string
  publicationDate: string | null
}
interface SSSearchResponse { data: SSPaper[] }

function ssHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY
  if (key) headers['x-api-key'] = key
  return headers
}

export async function searchSemanticScholar(query: string, limit = 50): Promise<NormalizedPaper[]> {
  const url = `${BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${FIELDS}`

  let res: Response
  try {
    res = await fetchWithRetry(url, { headers: ssHeaders() }, 'semantic-scholar')
  } catch (err) {
    console.error('[semantic-scholar] fetch error:', err)
    return []
  }
  if (!res.ok) {
    console.error(`[semantic-scholar] HTTP ${res.status}`)
    return []
  }

  const json = (await res.json()) as SSSearchResponse
  return json.data
    .filter((p): p is SSPaper & { title: string; abstract: string } => Boolean(p.title && p.abstract))
    .map((p) => ({
      title: p.title,
      abstract: p.abstract,
      authors: p.authors.map((a) => a.name),
      doi: p.externalIds?.['DOI'] ?? null,
      url: p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
      source: 'semantic_scholar' as const,
      venue: null,
      publishedAt: p.publicationDate ?? null,
    }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/research/sources/semantic-scholar.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/sources/semantic-scholar.ts src/lib/research/sources/semantic-scholar.test.ts
git commit -m "feat(research): add Semantic Scholar source adapter"
```

---

### Task 7: Theme taxonomy & tagging

**Files:**
- Create: `src/lib/research/themes.ts`
- Test: `src/lib/research/themes.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `THEMES: ThemeDefinition[]`, `THEME_NAMES: string[]`, `tagThemes(title: string, abstract: string): string[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/research/themes.test.ts
import { describe, it, expect } from 'vitest'
import { tagThemes, THEME_NAMES } from './themes'

describe('tagThemes', () => {
  it('tags a paper matching one theme', () => {
    const tags = tagThemes('Portfolio rebalancing', 'A mean-variance approach to diversification.')
    expect(tags).toContain('Portfolio')
  })

  it('tags a paper matching several themes', () => {
    const tags = tagThemes('LLM sentiment for crypto trading', 'We use a large language model and bitcoin price data.')
    expect(tags).toEqual(expect.arrayContaining(['LLMs', 'Crypto']))
  })

  it('returns an empty array when nothing matches', () => {
    expect(tagThemes('A history of medieval trade routes', 'No overlap with our taxonomy.')).toEqual([])
  })

  it('THEME_NAMES has 12 unique entries', () => {
    expect(new Set(THEME_NAMES).size).toBe(12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/research/themes.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Ported verbatim from `Papyrus`'s `lib/scoring/themes.ts` + `tagger.ts` (already a merge of the `ArdiaD/fame` `config.yaml` theme list and Papyrus's own taxonomy — 12 topics, both projects converge on essentially the same set):

```ts
// src/lib/research/themes.ts
// Theme taxonomy for auto-tagging + filter chips on the public research page.

export interface ThemeDefinition {
  readonly name: string
  readonly keywords: readonly string[]
}

export const THEMES: readonly ThemeDefinition[] = [
  { name: 'LLMs', keywords: ['large language model', 'llm', 'gpt', 'chatgpt', 'foundation model', 'instruction tuning', 'prompt engineering'] },
  { name: 'RL', keywords: ['reinforcement learning', 'reward function', 'policy gradient', 'q-learning', 'actor-critic', 'multi-armed bandit'] },
  { name: 'NLP', keywords: ['natural language processing', 'nlp', 'text classification', 'sentiment analysis', 'information extraction', 'text mining'] },
  { name: 'Portfolio', keywords: ['portfolio', 'asset allocation', 'mean-variance', 'markowitz', 'diversification', 'rebalancing', 'risk parity'] },
  { name: 'Factor Investing', keywords: ['factor investing', 'factor model', 'fama-french', 'momentum', 'value factor', 'quality factor', 'smart beta'] },
  { name: 'Volatility', keywords: ['volatility', 'implied volatility', 'garch', 'realized volatility', 'vix', 'stochastic volatility'] },
  { name: 'Trading', keywords: ['trading strategy', 'algorithmic trading', 'high frequency', 'market microstructure', 'order book', 'trade signal'] },
  { name: 'Crypto', keywords: ['cryptocurrency', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'decentralized finance', 'crypto'] },
  { name: 'Derivatives', keywords: ['derivatives', 'options', 'futures', 'swaps', 'hedging', 'black-scholes', 'delta hedging'] },
  { name: 'Macro', keywords: ['macroeconomics', 'gdp', 'inflation', 'monetary policy', 'central bank', 'interest rate', 'yield curve'] },
  { name: 'Deep Learning', keywords: ['deep learning', 'neural network', 'convolutional', 'lstm', 'attention mechanism', 'autoencoder', 'generative adversarial'] },
  { name: 'Return Forecasting', keywords: ['return forecasting', 'stock return', 'price prediction', 'excess return', 'cross-sectional', 'predictability'] },
] as const

export const THEME_NAMES: string[] = THEMES.map((t) => t.name)

export function tagThemes(title: string, abstract: string): string[] {
  const text = `${title} ${abstract}`.toLowerCase()
  return THEMES.filter((t) => t.keywords.some((kw) => text.includes(kw))).map((t) => t.name)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/research/themes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/themes.ts src/lib/research/themes.test.ts
git commit -m "feat(research): add theme taxonomy + tagging"
```

---

### Task 8: Relevance AND-gate

**Files:**
- Create: `src/lib/research/relevance.ts`
- Test: `src/lib/research/relevance.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `passesRelevanceGate(title: string, abstract: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/research/relevance.test.ts
import { describe, it, expect } from 'vitest'
import { passesRelevanceGate } from './relevance'

describe('passesRelevanceGate', () => {
  it('passes when title+abstract match at least one AI term and one finance term', () => {
    expect(passesRelevanceGate(
      'Deep learning for equity return prediction',
      'We apply a neural network to forecast stock returns.'
    )).toBe(true)
  })

  it('rejects an AI paper with no finance term', () => {
    expect(passesRelevanceGate(
      'A neural network for image segmentation',
      'We propose a convolutional architecture for medical imaging.'
    )).toBe(false)
  })

  it('rejects a finance paper with no AI term', () => {
    expect(passesRelevanceGate(
      'A survey of portfolio theory',
      'We review classical mean-variance optimization for equity portfolios.'
    )).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(passesRelevanceGate('LARGE LANGUAGE MODEL FOR TRADING', 'GPT-based ALPHA generation.')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/research/relevance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Ported from `ArdiaD/fame`'s `config.yaml` `relevance.ai_terms` / `relevance.finance_terms` (the broad AND-gate lists — deliberately kept separate from the 12 narrower `THEMES` in Task 7, which serve tagging/filtering, not the admission gate):

```ts
// src/lib/research/relevance.ts
// Coarse AND-gate: a paper only enters the pipeline if it mentions at least one
// AI term AND one finance term. Cheap pre-filter, run before spending an
// embedding call (Task 10) — ported from ArdiaD/fame's config.yaml term lists.

const AI_TERMS = [
  'machine learning', 'deep learning', 'neural network', 'reinforcement learning',
  'large language model', 'llm', 'transformer', 'natural language processing', 'nlp',
  'artificial intelligence', 'generative', 'gpt', 'embedding', 'gradient boosting',
  'random forest', 'graph neural',
]

const FINANCE_TERMS = [
  'trading', 'investment', 'portfolio', 'asset pricing', 'stock return', 'equity',
  'market', 'alpha', 'factor', 'volatility', 'risk', 'hedge', 'derivative',
  'cryptocurrency', 'forecasting return', 'backtest', 'order book', 'execution',
]

export function passesRelevanceGate(title: string, abstract: string): boolean {
  const text = `${title} ${abstract}`.toLowerCase()
  const hasAiTerm = AI_TERMS.some((t) => text.includes(t))
  const hasFinanceTerm = FINANCE_TERMS.some((t) => text.includes(t))
  return hasAiTerm && hasFinanceTerm
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/research/relevance.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/relevance.ts src/lib/research/relevance.test.ts
git commit -m "feat(research): add AI×finance relevance AND-gate"
```

---

### Task 9: Fuzzy/exact dedup

**Files:**
- Modify: `package.json` (add `fuse.js`)
- Create: `src/lib/research/dedup.ts`
- Test: `src/lib/research/dedup.test.ts`

**Interfaces:**
- Consumes: nothing (pure — the caller, Task 11, fetches candidates from the DB)
- Produces:
  - `computeFingerprint(input: { doi: string | null; url: string; title: string }): string`
  - `DedupCandidate` type `{ id: string; fingerprint: string; title: string }`
  - `findDuplicate(paper: { fingerprint: string; title: string }, candidates: DedupCandidate[]): DedupCandidate | null`

- [ ] **Step 1: Add the dependency**

```bash
npm install fuse.js@^7.3.0
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/research/dedup.test.ts
import { describe, it, expect } from 'vitest'
import { computeFingerprint, findDuplicate, type DedupCandidate } from './dedup'

describe('computeFingerprint', () => {
  it('prefers an arXiv id extracted from the url', () => {
    const fp = computeFingerprint({ doi: null, url: 'http://arxiv.org/abs/2401.01234v2', title: 'X' })
    expect(fp).toBe('arxiv:2401.01234')
  })

  it('falls back to the DOI when there is no arXiv id', () => {
    const fp = computeFingerprint({ doi: '10.1/ABC', url: 'https://journal.example/x', title: 'X' })
    expect(fp).toBe('doi:10.1/abc')
  })

  it('falls back to a normalized-title hash when neither is present', () => {
    const a = computeFingerprint({ doi: null, url: 'https://x.example/a', title: 'Deep Learning, for Trading!' })
    const b = computeFingerprint({ doi: null, url: 'https://x.example/b', title: 'deep learning for trading' })
    expect(a).toBe(b) // punctuation/case-insensitive normalization
    expect(a).toMatch(/^title:/)
  })
})

describe('findDuplicate', () => {
  const candidates: DedupCandidate[] = [
    { id: '1', fingerprint: 'arxiv:2401.01234', title: 'Deep learning for trading' },
    { id: '2', fingerprint: 'doi:10.1/xyz', title: 'A survey of reinforcement learning in finance' },
  ]

  it('matches on exact fingerprint', () => {
    const match = findDuplicate({ fingerprint: 'doi:10.1/xyz', title: 'anything' }, candidates)
    expect(match?.id).toBe('2')
  })

  it('matches on fuzzy title (preprint vs. published-version rewording)', () => {
    const match = findDuplicate(
      { fingerprint: 'title:some-other-hash', title: 'Deep learning for trading strategies' },
      candidates
    )
    expect(match?.id).toBe('1')
  })

  it('returns null when nothing matches closely enough', () => {
    const match = findDuplicate(
      { fingerprint: 'title:unrelated-hash', title: 'A totally unrelated paper about medieval trade' },
      candidates
    )
    expect(match).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/research/dedup.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/research/dedup.ts
// Two-stage dedup, same principle as ArdiaD/fame: strong identifier first
// (arXiv id / DOI), then fuzzy title match (Fuse.js threshold 0.15 ≈ 92%
// similarity — same threshold Papyrus validated for preprint↔published pairs).
import Fuse from 'fuse.js'
import { createHash } from 'crypto'

export interface DedupCandidate {
  id: string
  fingerprint: string
  title: string
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function computeFingerprint(input: { doi: string | null; url: string; title: string }): string {
  const arxivMatch = input.url.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i)
  if (arxivMatch) return `arxiv:${arxivMatch[1]}`
  if (input.doi) return `doi:${input.doi.toLowerCase()}`
  const hash = createHash('sha256').update(normalizeTitle(input.title)).digest('hex').slice(0, 16)
  return `title:${hash}`
}

export function findDuplicate(
  paper: { fingerprint: string; title: string },
  candidates: DedupCandidate[]
): DedupCandidate | null {
  const exact = candidates.find((c) => c.fingerprint === paper.fingerprint)
  if (exact) return exact

  if (candidates.length === 0) return null
  const fuse = new Fuse(candidates, { keys: ['title'], threshold: 0.15, includeScore: true })
  const best = fuse.search(paper.title)[0]
  if (!best || best.score === undefined || best.score > 0.15) return null
  return best.item
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/research/dedup.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/research/dedup.ts src/lib/research/dedup.test.ts
git commit -m "feat(research): add fingerprint + fuzzy-title dedup"
```

---

### Task 10: FAME relevance score (embeddings)

**Files:**
- Modify: `.env.example` (add threshold overrides)
- Create: `src/lib/research/score.ts`
- Test: `src/lib/research/score.test.ts`

**Interfaces:**
- Consumes: `getEmbeddingProvider` from `@/lib/llm` (existing)
- Produces:
  - `computeCosineSimilarity(a: number[], b: number[]): number`
  - `normalizeToPercent(cosine: number): number` (0-100 int, clamped)
  - `FAME_THRESHOLD: number`
  - `scoreBatch(papers: { title: string; abstract: string }[], deps?: { provider?: EmbeddingProvider }): Promise<number[]>` — one score per input paper, same order

- [ ] **Step 1: Add env overrides**

Append to `.env.example` under the research-hub block added in Task 4:

```
RESEARCH_FAME_THRESHOLD=50           # 0-100, score at/above this → published
RESEARCH_SIM_LO=0.32                 # cosine similarity mapped to 0%
RESEARCH_SIM_HI=0.72                 # cosine similarity mapped to 100%
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/research/score.test.ts
import { describe, it, expect, vi } from 'vitest'
import { computeCosineSimilarity, normalizeToPercent, scoreBatch } from './score'
import type { EmbeddingProvider } from '@/lib/llm'

describe('computeCosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(computeCosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
  })
  it('is 0 for orthogonal vectors', () => {
    expect(computeCosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })
  it('is 0 when a vector is all zeros (guards div-by-zero)', () => {
    expect(computeCosineSimilarity([0, 0], [1, 1])).toBe(0)
  })
})

describe('normalizeToPercent', () => {
  it('clamps below SIM_LO to 0', () => {
    expect(normalizeToPercent(0.1)).toBe(0)
  })
  it('clamps above SIM_HI to 100', () => {
    expect(normalizeToPercent(0.9)).toBe(100)
  })
  it('maps the midpoint to 50', () => {
    expect(normalizeToPercent(0.52)).toBe(50) // (0.52-0.32)/(0.72-0.32) = 0.5
  })
})

describe('scoreBatch', () => {
  it('embeds title+abstract for each paper and scores against the FAME reference vector', async () => {
    const fakeProvider: EmbeddingProvider = {
      embed: vi.fn(async (texts: string[]) => texts.map(() => [1, 0])), // pretend everything matches perfectly
    }
    const scores = await scoreBatch(
      [{ title: 'A', abstract: 'a' }, { title: 'B', abstract: 'b' }],
      { provider: fakeProvider }
    )
    expect(scores).toHaveLength(2)
    expect(scores.every((s) => s === 100)).toBe(true)
    // one call for the reference vector + one batched call for the two papers
    expect((fakeProvider.embed as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/research/score.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

The cosine function is ported verbatim from `Papyrus`'s `lib/scoring/scorer.ts` (pure, dependency-free, already correct). The 0-100% band mapping and reference-vector approach follow `ArdiaD/fame`'s `fame.py` (`SIM_LO`/`SIM_HI` = 0.32/0.72). The reference description is **not** copied from Papyrus's `GOLDEN_DESCRIPTION` — that one is scoped narrowly to LLM/NLP-on-financial-news and would under-score RL/portfolio/volatility papers that are just as central to FAME's actual scope (see the 12 themes in Task 7). Written fresh from the project's own description of itself (see `ArdiaD/fame`'s README: *"Generative AI and Large Language Models for investing, trading, and market supervision"*), broadened to cover the full theme list:

```ts
// src/lib/research/score.ts
// FAME relevance score: cosine similarity between a paper's title+abstract and
// a reference description of the FAME project's research scope, normalized to
// 0-100%. Reuses the embedding provider already wired for the Astra assistant
// RAG (src/lib/llm) — no new API key.
import { getEmbeddingProvider, type EmbeddingProvider } from '@/lib/llm'

export const FAME_THRESHOLD = Number(process.env.RESEARCH_FAME_THRESHOLD ?? 50)
const SIM_LO = Number(process.env.RESEARCH_SIM_LO ?? 0.32)
const SIM_HI = Number(process.env.RESEARCH_SIM_HI ?? 0.72)

const FAME_REFERENCE_SUMMARY = `
  The FAME project (Financial Artificial Machine Intelligence, Paris Dauphine – PSL
  and HEC Montreal) studies generative AI and large language models for investing,
  trading, and market supervision. Research topics include LLM-based analysis of
  financial news, disclosures and earnings calls for trading signals; reinforcement
  learning for portfolio allocation and execution; deep learning and factor models
  for stock return and volatility forecasting; natural language processing of
  financial text; machine learning applied to derivatives pricing and hedging;
  and AI methods for cryptocurrency and digital asset markets.
`

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0)
    normA += (a[i] ?? 0) ** 2
    normB += (b[i] ?? 0) ** 2
  }
  if (normA === 0 || normB === 0) return 0
  const result = dot / (Math.sqrt(normA) * Math.sqrt(normB))
  return Number.isFinite(result) ? result : 0
}

export function normalizeToPercent(cosine: number): number {
  const norm = (cosine - SIM_LO) / (SIM_HI - SIM_LO)
  return Math.round(Math.max(0, Math.min(1, norm)) * 100)
}

let cachedReferenceVector: Promise<number[]> | null = null

function getReferenceVector(provider: EmbeddingProvider): Promise<number[]> {
  if (!cachedReferenceVector) {
    cachedReferenceVector = provider.embed([FAME_REFERENCE_SUMMARY]).then((v) => v[0]!)
  }
  return cachedReferenceVector
}

export async function scoreBatch(
  papers: { title: string; abstract: string }[],
  deps: { provider?: EmbeddingProvider } = {}
): Promise<number[]> {
  const provider = deps.provider ?? getEmbeddingProvider()
  const refVector = await getReferenceVector(provider)
  const texts = papers.map((p) => `${p.title}. ${p.abstract.slice(0, 2000)}`)
  const embeddings = await provider.embed(texts)
  return embeddings.map((e) => normalizeToPercent(computeCosineSimilarity(e, refVector)))
}
```

Note: `cachedReferenceVector` is module-level and intentionally never reset — the reference summary is a static constant, so caching it for the lifetime of the serverless function instance is correct and avoids one extra embedding call per invocation.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/research/score.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add .env.example src/lib/research/score.ts src/lib/research/score.test.ts
git commit -m "feat(research): add FAME relevance score via existing embedding provider"
```

---

### Task 11: Fetch pipeline orchestration

**Files:**
- Create: `src/lib/research/fetch-pipeline.ts`
- Test: `src/lib/research/fetch-pipeline.test.ts`

**Interfaces:**
- Consumes: `searchArxiv` (Task 3), `searchOpenAlex` (Task 4), `searchRepec` (Task 5), `searchSemanticScholar` (Task 6), `tagThemes` (Task 7), `passesRelevanceGate` (Task 8), `computeFingerprint`/`findDuplicate`/`DedupCandidate` (Task 9), `scoreBatch`/`FAME_THRESHOLD` (Task 10), `createServiceClient` (existing)
- Produces:
  - `interface FetchPipelineResult { source: string; added: number; skipped: number; errors: number; message?: string }`
  - `runResearchFetch(deps?: { service?: SupabaseClient }): Promise<FetchPipelineResult[]>` — used by Task 13's cron route.

- [ ] **Step 1: Write the failing test**

The Supabase client is injected (same DI pattern as `src/lib/rag/index-source.ts`'s `provider` param), so the test supplies a minimal fake instead of mocking the whole module:

```ts
// src/lib/research/fetch-pipeline.test.ts
import { describe, it, expect, vi } from 'vitest'
import { runResearchFetch } from './fetch-pipeline'

vi.mock('./sources/arxiv', () => ({
  searchArxiv: vi.fn(async () => [
    { title: 'LLM sentiment for equity returns', abstract: 'We use a transformer to score financial news for alpha.', authors: ['A'], doi: null, url: 'http://arxiv.org/abs/2401.00001', source: 'arxiv', venue: null, publishedAt: '2024-01-01' },
    { title: 'A history of medieval trade routes', abstract: 'No AI or finance content here at all.', authors: ['B'], doi: null, url: 'http://arxiv.org/abs/2401.00002', source: 'arxiv', venue: null, publishedAt: '2024-01-01' },
  ]),
}))
vi.mock('./sources/openalex', () => ({ searchOpenAlex: vi.fn(async () => []) }))
vi.mock('./sources/repec', () => ({ searchRepec: vi.fn(async () => []) }))
vi.mock('./sources/semantic-scholar', () => ({ searchSemanticScholar: vi.fn(async () => []) }))
vi.mock('./score', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./score')>()
  return { ...actual, scoreBatch: vi.fn(async (papers: unknown[]) => papers.map(() => 80)) }
})

function fakeService() {
  const inserted: Record<string, unknown>[] = []
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    gte: () => chain,
    lte: () => chain,
    insert: (row: Record<string, unknown>) => { inserted.push(row); return { select: () => ({ single: async () => ({ data: { id: 'new-id', ...row }, error: null }) }) } },
    then: undefined,
  }
  // research_papers lookups (exact fingerprint + date-window candidates) both return empty → nothing is a duplicate
  Object.assign(chain, { then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }) })
  return {
    inserted,
    from: (table: string) => {
      if (table === 'research_fetch_log') return { insert: async () => ({ error: null }) }
      return chain
    },
  }
}

describe('runResearchFetch', () => {
  it('gates out irrelevant papers before spending an embedding call, and inserts the rest as published', async () => {
    const service = fakeService()
    const results = await runResearchFetch({ service: service as never })
    expect(results.find((r) => r.source === 'arxiv')?.added).toBe(1)
    expect(service.inserted).toHaveLength(1)
    expect(service.inserted[0]).toMatchObject({ status: 'published', fame_score: 80 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/research/fetch-pipeline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Query set follows `Papyrus`'s `jobs/ingestFame.ts` pattern (two keyword phrases per theme, run against every query-source; RePEc ignores the query and is called once):

```ts
// src/lib/research/fetch-pipeline.ts
// Weekly ingestion: fetch every source, gate → dedup → score → insert.
// Each source is isolated in its own try/catch — one failing source never
// aborts the others (same principle as ArdiaD/fame).
import { createServiceClient } from '@/lib/supabase/server'
import { searchArxiv } from './sources/arxiv'
import { searchOpenAlex } from './sources/openalex'
import { searchRepec } from './sources/repec'
import { searchSemanticScholar } from './sources/semantic-scholar'
import { tagThemes, THEMES } from './themes'
import { passesRelevanceGate } from './relevance'
import { computeFingerprint, findDuplicate, type DedupCandidate } from './dedup'
import { scoreBatch, FAME_THRESHOLD } from './score'
import type { NormalizedPaper } from './sources/types'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

export interface FetchPipelineResult {
  source: string
  added: number
  skipped: number
  errors: number
  message?: string
}

// Two representative keywords per theme — broad recall without an explosion
// of requests (12 themes × 2 ≈ 24 queries per query-source).
const QUERIES: string[] = THEMES.flatMap((t) => t.keywords.slice(0, 2))

async function fetchDateWindowCandidates(
  service: ServiceClient,
  publishedAt: string | null
): Promise<DedupCandidate[]> {
  let query = service.from('research_papers').select('id, fingerprint, title')
  if (publishedAt) {
    const d = new Date(publishedAt)
    const from = new Date(d); from.setFullYear(from.getFullYear() - 1)
    const to = new Date(d); to.setFullYear(to.getFullYear() + 1)
    query = query.gte('published_at', from.toISOString().slice(0, 10)).lte('published_at', to.toISOString().slice(0, 10))
  }
  const { data } = await query
  return (data ?? []) as DedupCandidate[]
}

async function ingestOne(
  service: ServiceClient,
  paper: NormalizedPaper
): Promise<'added' | 'skipped'> {
  if (!passesRelevanceGate(paper.title, paper.abstract)) return 'skipped'

  const fingerprint = computeFingerprint(paper)
  const { data: exact } = await service.from('research_papers').select('id').eq('fingerprint', fingerprint)
  if (exact && exact.length > 0) return 'skipped'

  const candidates = await fetchDateWindowCandidates(service, paper.publishedAt)
  if (findDuplicate({ fingerprint, title: paper.title }, candidates)) return 'skipped'

  const [score] = await scoreBatch([{ title: paper.title, abstract: paper.abstract }])
  const status = (score ?? 0) >= FAME_THRESHOLD ? 'published' : 'rejected'

  const { error } = await service.from('research_papers').insert({
    fingerprint,
    title: paper.title,
    authors: paper.authors,
    abstract: paper.abstract,
    url: paper.url,
    source: paper.source,
    venue: paper.venue,
    themes: tagThemes(paper.title, paper.abstract),
    fame_score: score,
    published_at: paper.publishedAt ? paper.publishedAt.slice(0, 10) : null,
    status,
    manual_override: false,
  }).select().single()

  if (error) throw new Error(error.message)
  return 'added'
}

async function runSource(
  service: ServiceClient,
  source: string,
  fetchFn: () => Promise<NormalizedPaper[]>
): Promise<FetchPipelineResult> {
  const result: FetchPipelineResult = { source, added: 0, skipped: 0, errors: 0 }
  try {
    const papers = await fetchFn()
    for (const paper of papers) {
      try {
        const outcome = await ingestOne(service, paper)
        result[outcome]++
      } catch (err) {
        result.errors++
        console.error(`[research-fetch:${source}] paper error:`, err)
      }
    }
  } catch (err) {
    result.errors++
    result.message = err instanceof Error ? err.message : String(err)
    console.error(`[research-fetch:${source}] fetch error:`, err)
  }
  await service.from('research_fetch_log').insert({ ...result })
  return result
}

export async function runResearchFetch(
  deps: { service?: ServiceClient } = {}
): Promise<FetchPipelineResult[]> {
  const service = deps.service ?? (await createServiceClient())

  const results: FetchPipelineResult[] = []
  results.push(await runSource(service, 'arxiv', async () => (await Promise.all(QUERIES.map((q) => searchArxiv(q)))).flat()))
  results.push(await runSource(service, 'openalex', async () => (await Promise.all(QUERIES.map((q) => searchOpenAlex(q)))).flat()))
  // semantic_scholar last — it rate-limits aggressively and would otherwise block the others.
  results.push(await runSource(service, 'semantic_scholar', async () => (await Promise.all(QUERIES.map((q) => searchSemanticScholar(q)))).flat()))
  results.push(await runSource(service, 'repec', () => searchRepec()))

  return results
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/research/fetch-pipeline.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/fetch-pipeline.ts src/lib/research/fetch-pipeline.test.ts
git commit -m "feat(research): add fetch pipeline orchestration (gate → dedup → score → insert)"
```

---

### Task 12: Retention / purge

**Files:**
- Create: `src/lib/research/retention.ts`
- Test: `src/lib/research/retention.test.ts`

**Interfaces:**
- Consumes: `createServiceClient` (existing)
- Produces: `runRetention(deps?: { service?: SupabaseClient }): Promise<{ deletedRejected: number; strippedHidden: number }>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/research/retention.test.ts
import { describe, it, expect, vi } from 'vitest'
import { runRetention } from './retention'

describe('runRetention', () => {
  it('deletes rejected rows older than 90 days and strips (never deletes) old hidden rows', async () => {
    const deleteCall = vi.fn(() => ({ eq: () => ({ lt: () => Promise.resolve({ data: [{ id: 'r1' }, { id: 'r2' }], error: null }) }) }))
    const updateCall = vi.fn(() => ({ eq: () => ({ lt: () => Promise.resolve({ data: [{ id: 'h1' }], error: null }) }) }))
    const service = {
      from: (table: string) => {
        expect(table).toBe('research_papers')
        return { delete: deleteCall, update: updateCall }
      },
    }

    const result = await runRetention({ service: service as never })

    expect(deleteCall).toHaveBeenCalled()
    expect(updateCall).toHaveBeenCalledWith(expect.objectContaining({ abstract: null, embedding: null }))
    expect(result).toEqual({ deletedRejected: 2, strippedHidden: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/research/retention.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/research/retention.ts
// Purge policy (see spec § Rétention):
//   - rejected, older than 90 days → row deleted entirely (noise, no admin decision).
//   - hidden, older than 90 days → abstract + embedding stripped, row KEPT forever
//     (deleting it would let the fingerprint resurface and get silently
//     auto-republished on the next fetch, overwriting the admin's decision).
// `manual_override` rows are never touched by this job outside of these two
// well-defined, always-safe transitions.
import { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

const RETENTION_DAYS = 90

function cutoffIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - RETENTION_DAYS)
  return d.toISOString()
}

export async function runRetention(
  deps: { service?: ServiceClient } = {}
): Promise<{ deletedRejected: number; strippedHidden: number }> {
  const service = deps.service ?? (await createServiceClient())
  const cutoff = cutoffIso()

  const { data: deleted, error: deleteError } = await service
    .from('research_papers')
    .delete()
    .eq('status', 'rejected')
    .lt('updated_at', cutoff)
  if (deleteError) throw new Error(deleteError.message)

  const { data: stripped, error: updateError } = await service
    .from('research_papers')
    .update({ abstract: null, embedding: null })
    .eq('status', 'hidden')
    .lt('updated_at', cutoff)
  if (updateError) throw new Error(updateError.message)

  return { deletedRejected: deleted?.length ?? 0, strippedHidden: stripped?.length ?? 0 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/research/retention.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/retention.ts src/lib/research/retention.test.ts
git commit -m "feat(research): add retention/purge policy for rejected and hidden papers"
```

---

### Task 13: Weekly cron route

**Files:**
- Create: `src/app/api/research/fetch/route.ts`
- Test: `src/app/api/research/fetch/route.test.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `runResearchFetch` (Task 11), `runRetention` (Task 12)
- Produces: `GET /api/research/fetch` — the only HTTP entry point for the whole pipeline.

**⚠️ Lesson from the Papyrus audit**: its Vercel Cron called a `GET` route that only *listed* job logs, while the real ingestion sat behind a `POST` guarded by a secret header — the two never met, and automated ingestion silently never ran in production for months. Vercel Cron **only ever sends `GET`**, with header `Authorization: Bearer <CRON_SECRET>` automatically attached when a `CRON_SECRET` env var exists on the Vercel project. This route must do the real work directly on `GET`, checked against that exact header — no separate POST to forget to wire up.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/research/fetch/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/research/fetch-pipeline', () => ({
  runResearchFetch: vi.fn(async () => [{ source: 'arxiv', added: 3, skipped: 1, errors: 0 }]),
}))
vi.mock('@/lib/research/retention', () => ({
  runRetention: vi.fn(async () => ({ deletedRejected: 0, strippedHidden: 0 })),
}))

import { GET } from './route'
import { runResearchFetch } from '@/lib/research/fetch-pipeline'

beforeEach(() => { process.env.CRON_SECRET = 'test-secret'; vi.clearAllMocks() })

function req(auth?: string) {
  const headers = auth ? { Authorization: auth } : undefined
  return new NextRequest('http://localhost/api/research/fetch', { headers })
}

describe('GET /api/research/fetch', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(runResearchFetch).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong secret', async () => {
    const res = await GET(req('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('runs the pipeline + retention and returns a summary for a valid Vercel Cron request', async () => {
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([{ source: 'arxiv', added: 3, skipped: 1, errors: 0 }])
    expect(runResearchFetch).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/research/fetch/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/research/fetch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { runResearchFetch } from '@/lib/research/fetch-pipeline'
import { runRetention } from '@/lib/research/retention'

// Vercel Cron only ever issues GET, with `Authorization: Bearer <CRON_SECRET>`
// auto-attached when CRON_SECRET is set on the project — see vercel.json.
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  const got = req.headers.get('authorization')
  if (!expected || got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await runResearchFetch()
  const retention = await runRetention()
  return NextResponse.json({ results, retention })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/research/fetch/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add the Vercel Cron config**

```json
{
  "crons": [
    { "path": "/api/research/fetch", "schedule": "0 6 * * 1" }
  ]
}
```

**Note for whoever deploys this:** `maxDuration = 60` requires at least a Vercel Pro plan (Hobby caps serverless functions at 10s). If the project is on Hobby, either upgrade or reduce `QUERIES` in `fetch-pipeline.ts` before enabling the cron — a full run across ~24 queries × 3 query-sources can legitimately take longer than 10s. Also set `CRON_SECRET` in the Vercel project's environment variables (any random string) — without it, this route rejects every request including Vercel's own.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/research/fetch/route.ts src/app/api/research/fetch/route.test.ts vercel.json
git commit -m "feat(research): add weekly cron route (GET, Vercel Cron bearer auth)"
```

---

### Task 14: Admin list + manual add route + fetch log

**Files:**
- Create: `src/app/api/research/route.ts`
- Test: `src/app/api/research/route.test.ts`
- Create: `src/app/api/research/fetch-log/route.ts`
- Test: `src/app/api/research/fetch-log/route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `authErrorResponse` (existing `@/lib/auth`), `createServiceClient` (existing), `computeFingerprint` (Task 9), `tagThemes` (Task 7)
- Produces: `GET /api/research?status=` (admin, list), `POST /api/research` (admin, manual add), `GET /api/research/fetch-log` (admin, last 20 `research_fetch_log` rows — lets the admin page surface a weekly run that failed silently, per spec § Fetch & cron)

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/research/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  authErrorResponse: (e: unknown) => new Response(JSON.stringify({ error: String(e) }), { status: 403 }) as never,
}))
const insertSingle = vi.fn(async () => ({ data: { id: 'new-id' }, error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: insertSingle }) }),
    }),
  }),
}))

import { GET, POST } from './route'
import { requireAdmin } from '@/lib/auth'

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/research', () => {
  it('requires admin', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no'))
    const res = await GET(new NextRequest('http://localhost/api/research'))
    expect(res.status).toBe(403)
  })

  it('returns the list for an admin', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await GET(new NextRequest('http://localhost/api/research'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/research (manual add)', () => {
  it('requires title and url', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await POST(new NextRequest('http://localhost/api/research', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(400)
  })

  it('inserts a manual paper, published, with manual_override true', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await POST(new NextRequest('http://localhost/api/research', {
      method: 'POST',
      body: JSON.stringify({ title: 'A manually added paper', url: 'https://example.com/x', authors: ['Z'] }),
    }))
    expect(res.status).toBe(201)
    expect(insertSingle).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/research/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/research/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import { computeFingerprint } from '@/lib/research/dedup'
import { tagThemes } from '@/lib/research/themes'

// Admin-only listing across every status — the public /research page reads
// published rows directly (see src/app/[locale]/research/page.tsx), it does
// not use this route.
export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const status = req.nextUrl.searchParams.get('status')
  const service = await createServiceClient()
  let query = service.from('research_papers').select('*')
  if (status) query = query.eq('status', status)
  const { data, error } = await query.order('fetched_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Manual add — covers a paper the automated fetch missed. Always published,
// always manual_override so the weekly job never touches it.
export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const body = await req.json()
  const { title, url, authors, abstract, venue } = body
  if (!title?.trim() || !url?.trim()) {
    return NextResponse.json({ error: 'title and url required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const fingerprint = computeFingerprint({ doi: null, url, title })
  const { data, error } = await service.from('research_papers').insert({
    fingerprint,
    title,
    authors: authors ?? [],
    abstract: abstract || null,
    url,
    source: 'manual',
    venue: venue || null,
    themes: tagThemes(title, abstract ?? ''),
    fame_score: null,
    status: 'published',
    manual_override: true,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/research/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing test for the fetch-log route**

```ts
// src/app/api/research/fetch-log/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
  authErrorResponse: () => new Response(null, { status: 403 }) as never,
}))
const limit = vi.fn(async () => ({ data: [{ id: '1', source: 'arxiv', added: 3, skipped: 1, errors: 0, message: null, run_at: '2026-09-01T06:00:00Z' }], error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({ from: () => ({ select: () => ({ order: () => ({ limit }) }) }) }),
}))

import { GET } from './route'
import { requireAdmin } from '@/lib/auth'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/research/fetch-log', () => {
  it('requires admin', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no'))
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(403)
  })

  it('returns the last 20 runs for an admin', async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { is_admin: true } })
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(200)
    expect(limit).toHaveBeenCalledWith(20)
    const body = await res.json()
    expect(body).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/app/api/research/fetch-log/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Write the fetch-log route**

```ts
// src/app/api/research/fetch-log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

// Surfaces the weekly cron's own log so an admin can spot a silently-failed
// run (see spec § Fetch & cron — the exact failure mode found in the Papyrus audit).
export async function GET(_req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const service = await createServiceClient()
  const { data, error } = await service.from('research_fetch_log').select('*').order('run_at', { ascending: false }).limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/app/api/research/fetch-log/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add src/app/api/research/route.ts src/app/api/research/route.test.ts src/app/api/research/fetch-log/route.ts src/app/api/research/fetch-log/route.test.ts
git commit -m "feat(research): add admin list + manual-add routes + fetch log endpoint"
```

---

### Task 15: Admin hide/publish routes

**Files:**
- Create: `src/app/api/research/[id]/hide/route.ts`
- Create: `src/app/api/research/[id]/publish/route.ts`
- Test: `src/app/api/research/[id]/hide/route.test.ts`
- Test: `src/app/api/research/[id]/publish/route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `authErrorResponse`, `createServiceClient` (existing)
- Produces: `POST /api/research/[id]/hide` (published → hidden), `POST /api/research/[id]/publish` (rejected **or** hidden → published)

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/research/[id]/hide/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ member: { is_admin: true } }),
  authErrorResponse: () => new Response(null, { status: 403 }) as never,
}))
const single = vi.fn()
const update = vi.fn(() => ({ eq: () => ({ select: () => ({ single }) }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }), update }),
  }),
}))

import { POST } from './route'

beforeEach(() => vi.clearAllMocks())

describe('POST /api/research/[id]/hide', () => {
  it('404s when the paper does not exist', async () => {
    single.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: 'nope' }) })
    expect(res.status).toBe(404)
  })

  it('409s when the paper is not currently published', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'rejected' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(409)
  })

  it('hides a published paper and sets manual_override', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'published' }, error: null })
    single.mockResolvedValueOnce({ data: { id: '1', status: 'hidden' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'hidden', manual_override: true }))
  })
})
```

```ts
// src/app/api/research/[id]/publish/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ member: { is_admin: true } }),
  authErrorResponse: () => new Response(null, { status: 403 }) as never,
}))
const single = vi.fn()
const update = vi.fn(() => ({ eq: () => ({ select: () => ({ single }) }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }), update }),
  }),
}))

import { POST } from './route'

beforeEach(() => vi.clearAllMocks())

describe('POST /api/research/[id]/publish', () => {
  it('409s when the paper is already published', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'published' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(409)
  })

  it('republishes a rejected paper', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'rejected' }, error: null })
    single.mockResolvedValueOnce({ data: { id: '1', status: 'published' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'published', manual_override: true }))
  })

  it('unhides a hidden paper', async () => {
    single.mockResolvedValueOnce({ data: { id: '1', status: 'hidden' }, error: null })
    single.mockResolvedValueOnce({ data: { id: '1', status: 'published' }, error: null })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/research/[id]/hide/route.test.ts src/app/api/research/[id]/publish/route.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

```ts
// src/app/api/research/[id]/hide/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()

  const { data: paper } = await service.from('research_papers').select('id, status').eq('id', id).single()
  if (!paper) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (paper.status !== 'published') {
    return NextResponse.json({ error: 'Only a published paper can be hidden' }, { status: 409 })
  }

  const { data, error } = await service.from('research_papers')
    .update({ status: 'hidden', manual_override: true, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

```ts
// src/app/api/research/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// Covers both "republish a rejected paper" and "unhide a hidden paper" —
// same transition (→ published), same admin action.
export async function POST(_req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = await createServiceClient()

  const { data: paper } = await service.from('research_papers').select('id, status').eq('id', id).single()
  if (!paper) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (paper.status === 'published') {
    return NextResponse.json({ error: 'Already published' }, { status: 409 })
  }

  const { data, error } = await service.from('research_papers')
    .update({ status: 'published', manual_override: true, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/research/[id]/hide/route.test.ts src/app/api/research/[id]/publish/route.test.ts`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/research/[id]/hide/route.ts src/app/api/research/[id]/publish/route.ts src/app/api/research/[id]/hide/route.test.ts src/app/api/research/[id]/publish/route.test.ts
git commit -m "feat(research): add admin hide/publish override routes"
```

---

### Task 16: Bookmarks API

**Files:**
- Create: `src/app/api/research/bookmarks/route.ts`
- Test: `src/app/api/research/bookmarks/route.test.ts`

**Interfaces:**
- Consumes: `requireMember`, `authErrorResponse`, `createServiceClient` (existing)
- Produces: `GET /api/research/bookmarks` (mine), `POST /api/research/bookmarks` (add, body `{ paper_id }`), `DELETE /api/research/bookmarks?paper_id=` (remove)

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/research/bookmarks/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireMember: vi.fn(),
  authErrorResponse: () => new Response(null, { status: 401 }) as never,
}))
const eqCalls: [string, unknown][] = []
const chain = {
  select: () => chain,
  eq: (c: string, v: unknown) => { eqCalls.push([c, v]); return chain },
  then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
}
const upsert = vi.fn(() => Promise.resolve({ error: null }))
const del = vi.fn(() => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({ from: () => ({ ...chain, upsert, delete: del }) }),
}))

import { GET, POST, DELETE } from './route'
import { requireMember } from '@/lib/auth'

beforeEach(() => { eqCalls.length = 0; vi.clearAllMocks() })

describe('/api/research/bookmarks', () => {
  it('GET requires a member and scopes to their own user_id', async () => {
    (requireMember as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { id: 'u1' } })
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(200)
    expect(eqCalls).toContainEqual(['user_id', 'u1'])
  })

  it('POST upserts a bookmark for the caller', async () => {
    (requireMember as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { id: 'u1' } })
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify({ paper_id: 'p1' }) }))
    expect(res.status).toBe(201)
    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1', paper_id: 'p1' })
  })

  it('DELETE requires paper_id', async () => {
    (requireMember as ReturnType<typeof vi.fn>).mockResolvedValue({ member: { id: 'u1' } })
    const res = await DELETE(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/research/bookmarks/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/research/bookmarks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

// Bookmarks are private per-member data. This repo has no RLS policies, so the
// scoping happens here: every query is explicitly filtered by the caller's own
// user_id — never trust a user_id from the request body/query for reads.
export async function GET(_req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const service = await createServiceClient()
  const { data, error } = await service.from('research_bookmarks').select('*').eq('user_id', member.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { paper_id } = await req.json()
  if (!paper_id) return NextResponse.json({ error: 'paper_id required' }, { status: 400 })
  const service = await createServiceClient()
  const { error } = await service.from('research_bookmarks').upsert({ user_id: member.id, paper_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const paperId = req.nextUrl.searchParams.get('paper_id')
  if (!paperId) return NextResponse.json({ error: 'paper_id required' }, { status: 400 })
  const service = await createServiceClient()
  const { error } = await service.from('research_bookmarks').delete().eq('user_id', member.id).eq('paper_id', paperId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/research/bookmarks/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/research/bookmarks/route.ts src/app/api/research/bookmarks/route.test.ts
git commit -m "feat(research): add member bookmarks API"
```

---

### Task 17: Notes API

**Files:**
- Create: `src/app/api/research/notes/route.ts`
- Test: `src/app/api/research/notes/route.test.ts`

**Interfaces:**
- Consumes: `requireMember`, `authErrorResponse`, `createServiceClient` (existing)
- Produces: `GET /api/research/notes?paper_id=` (mine, single), `PUT /api/research/notes` (upsert, body `{ paper_id, content }`)

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/research/notes/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireMember: vi.fn().mockResolvedValue({ member: { id: 'u1' } }),
  authErrorResponse: () => new Response(null, { status: 401 }) as never,
}))
const maybeSingle = vi.fn(async () => ({ data: null, error: null }))
const upsert = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }), upsert }),
  }),
}))

import { GET, PUT } from './route'

beforeEach(() => vi.clearAllMocks())

describe('/api/research/notes', () => {
  it('GET requires paper_id', async () => {
    const res = await GET(new NextRequest('http://localhost/x'))
    expect(res.status).toBe(400)
  })

  it('GET returns null when the caller has no note on that paper', async () => {
    const res = await GET(new NextRequest('http://localhost/x?paper_id=p1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('PUT upserts content scoped to the caller + paper', async () => {
    const res = await PUT(new NextRequest('http://localhost/x', { method: 'PUT', body: JSON.stringify({ paper_id: 'p1', content: 'interesting result' }) }))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith({ user_id: 'u1', paper_id: 'p1', content: 'interesting result', updated_at: expect.any(String) })
  })

  it('PUT rejects an empty content', async () => {
    const res = await PUT(new NextRequest('http://localhost/x', { method: 'PUT', body: JSON.stringify({ paper_id: 'p1', content: '  ' }) }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/research/notes/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/research/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const paperId = req.nextUrl.searchParams.get('paper_id')
  if (!paperId) return NextResponse.json({ error: 'paper_id required' }, { status: 400 })
  const service = await createServiceClient()
  const { data, error } = await service.from('research_notes').select('*').eq('user_id', member.id).eq('paper_id', paperId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

export async function PUT(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { paper_id, content } = await req.json()
  if (!paper_id || !content?.trim()) {
    return NextResponse.json({ error: 'paper_id and content required' }, { status: 400 })
  }
  const service = await createServiceClient()
  const { error } = await service.from('research_notes').upsert({
    user_id: member.id, paper_id, content, updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/research/notes/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/research/notes/route.ts src/app/api/research/notes/route.test.ts
git commit -m "feat(research): add member notes API"
```

---

### Task 18: Public research page

**Files:**
- Create: `src/app/[locale]/research/page.tsx`
- Create: `src/components/research/ResearchCard.tsx`
- Create: `src/components/research/ResearchFilters.tsx`
- Modify: `messages/en.json`, `messages/fr.json` (new `research` namespace)

**Interfaces:**
- Consumes: `ResearchPaper` type (Task 1), `THEME_NAMES` (Task 7), `createServiceClient` (existing), `getSession` (existing, to know if bookmarks should render — wired in Task 19)
- Produces: page at `/{locale}/research`; `ResearchCard`, `ResearchFilters` components used by Task 19/20.

No unit test for this task (Server Component + presentational components — verified by running the dev server, per this repo's convention for UI work). This is a UI task: **before writing it, read the `FAME Accueil.dc.html` mockup via the MCP Claude Design (Opus-only — see AGENTS.md) to check whether a research-hub layout/card style is already specified.** No mockup file is known to cover `/research` itself; if the orchestrating Opus session finds none, use the layout below (consistent with the existing `[lab]/page.tsx` subject grid) and flag that to the user rather than inventing a divergent visual language.

- [ ] **Step 1: Add i18n keys**

`messages/en.json`, top-level:
```json
"research": {
  "metaTitle": "Research radar — FAME",
  "metaDescription": "AI × finance papers, fetched automatically and scored for relevance to FAME.",
  "title": "Research radar",
  "kicker": "FAME / Research",
  "empty": "No papers yet — the next weekly fetch will populate this page.",
  "searchPlaceholder": "Search title or abstract…",
  "filterTheme": "Theme",
  "filterSource": "Source",
  "allThemes": "All themes",
  "allSources": "All sources",
  "fameScoreLabel": "FAME relevance",
  "viewSource": "View source ↗",
  "bookmark": "Bookmark",
  "bookmarked": "Bookmarked",
  "noteLabel": "Your note",
  "notePlaceholder": "Private note (only you see this)…",
  "noteSaved": "Note saved",
  "actionError": "Something went wrong, please try again."
}
```

`messages/fr.json`, same keys translated:
```json
"research": {
  "metaTitle": "Veille recherche — FAME",
  "metaDescription": "Papiers IA × finance, récupérés automatiquement et notés selon leur pertinence pour FAME.",
  "title": "Veille recherche",
  "kicker": "FAME / Recherche",
  "empty": "Aucun papier pour l'instant — le prochain fetch hebdomadaire remplira cette page.",
  "searchPlaceholder": "Rechercher un titre ou un résumé…",
  "filterTheme": "Thème",
  "filterSource": "Source",
  "allThemes": "Tous les thèmes",
  "allSources": "Toutes les sources",
  "fameScoreLabel": "Pertinence FAME",
  "viewSource": "Voir la source ↗",
  "bookmark": "Enregistrer",
  "bookmarked": "Enregistré",
  "noteLabel": "Votre note",
  "notePlaceholder": "Note privée (visible de vous seul)…",
  "noteSaved": "Note enregistrée",
  "actionError": "Une erreur est survenue, réessayez."
}
```

- [ ] **Step 2: Write `ResearchCard`**

```tsx
// src/components/research/ResearchCard.tsx
import { useTranslations } from 'next-intl'
import type { ResearchPaper } from '@/types'

export function ResearchCard({ paper, actions }: { paper: ResearchPaper; actions?: React.ReactNode }) {
  const t = useTranslations('research')
  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid rgba(20,40,90,0.1)',
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <h3 className="font-serif" style={{ fontSize: 16, margin: 0, color: '#15203f' }}>{paper.title}</h3>
      <p className="font-mono" style={{ fontSize: 11, color: '#7e95d6', margin: 0, letterSpacing: '0.02em' }}>
        {paper.authors.join(', ')}
        {paper.published_at ? ` · ${paper.published_at.slice(0, 4)}` : ''}
        {paper.venue ? ` · ${paper.venue}` : ''}
      </p>
      {paper.abstract && (
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#2a3457', margin: 0 }}>
          {paper.abstract.length > 320 ? `${paper.abstract.slice(0, 320)}…` : paper.abstract}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {paper.themes.map((theme) => (
          <span key={theme} className="font-mono" style={{
            fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '3px 8px', borderRadius: 20, background: 'rgba(47,68,134,0.08)', color: '#2f4486',
          }}>{theme}</span>
        ))}
        {paper.fame_score !== null && (
          <span className="font-mono" title={t('fameScoreLabel')} style={{
            fontSize: 9.5, padding: '3px 8px', borderRadius: 20,
            background: 'rgba(30,155,126,0.12)', color: '#1e9b7e',
          }}>{t('fameScoreLabel')}: {paper.fame_score}%</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <a href={paper.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2f4486' }}>
          {t('viewSource')}
        </a>
        {actions}
      </div>
    </article>
  )
}
```

`actions` is a slot (kept out of this component so `ResearchCard` stays a plain server-renderable presentational piece) — Task 19 passes `<BookmarkButton>`/`<NoteField>` into it only for signed-in members.

- [ ] **Step 3: Write `ResearchFilters`**

Client component; state lives in the URL (`searchParams`), no new dependency:

```tsx
// src/components/research/ResearchFilters.tsx
'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { THEME_NAMES } from '@/lib/research/themes'

const SOURCES = ['arxiv', 'openalex', 'repec', 'semantic_scholar', 'manual'] as const

export function ResearchFilters() {
  const t = useTranslations('research')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value); else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
      <input
        type="search"
        placeholder={t('searchPlaceholder')}
        defaultValue={searchParams.get('q') ?? ''}
        onChange={(e) => setParam('q', e.target.value)}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(20,40,90,0.14)', minWidth: 220, flex: 1 }}
      />
      <select value={searchParams.get('theme') ?? ''} onChange={(e) => setParam('theme', e.target.value)}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(20,40,90,0.14)' }}>
        <option value="">{t('allThemes')}</option>
        {THEME_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      <select value={searchParams.get('source') ?? ''} onChange={(e) => setParam('source', e.target.value)}
        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(20,40,90,0.14)' }}>
        <option value="">{t('allSources')}</option>
        {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}
```

- [ ] **Step 4: Write the page**

Follows the exact `createServiceClient()` + `.eq(...)` pattern already used by `src/app/[locale]/graph/page.tsx` (no RLS policy in this repo — filtering happens in the query):

```tsx
// src/app/[locale]/research/page.tsx
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ResearchCard } from '@/components/research/ResearchCard'
import { ResearchFilters } from '@/components/research/ResearchFilters'
import type { ResearchPaper } from '@/types'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; theme?: string; source?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'research' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

export default async function ResearchPage({ searchParams }: Props) {
  const { q, theme, source } = await searchParams
  const t = await getTranslations('research')

  const service = await createServiceClient()
  let query = service.from('research_papers').select('*').eq('status', 'published')
  if (theme) query = query.contains('themes', [theme])
  if (source) query = query.eq('source', source)
  if (q) query = query.or(`title.ilike.%${q}%,abstract.ilike.%${q}%`)

  const { data } = await query.order('published_at', { ascending: false })
  const papers = (data ?? []) as ResearchPaper[]

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px 80px' }}>
      <p className="font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', color: '#7e95d6', textTransform: 'uppercase' }}>
        {t('kicker')}
      </p>
      <h1 className="font-serif" style={{ fontSize: 28, margin: '4px 0 20px', color: '#15203f' }}>{t('title')}</h1>
      <ResearchFilters />
      {papers.length === 0 ? (
        <p style={{ color: '#7e95d6' }}>{t('empty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {papers.map((paper) => <ResearchCard key={paper.id} paper={paper} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, visit `http://localhost:3000/en/research`.
Expected: page renders (empty state until Task 13's fetch has run at least once against a real Supabase project), filters update the URL and re-fetch server-side on navigation.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/research/page.tsx src/components/research/ResearchCard.tsx src/components/research/ResearchFilters.tsx messages/en.json messages/fr.json
git commit -m "feat(research): add public research radar page"
```

---

### Task 19: Member bookmarks & notes on the page

**Files:**
- Create: `src/components/research/BookmarkButton.tsx`
- Create: `src/components/research/NoteField.tsx`
- Modify: `src/app/[locale]/research/page.tsx` (pass member-only actions into `ResearchCard`)
- Modify: `messages/en.json`, `messages/fr.json` (keys already added in Task 18 cover this — no new keys)

**Interfaces:**
- Consumes: `useToast` (existing `@/components/ui/Toast`), `/api/research/bookmarks` (Task 16), `/api/research/notes` (Task 17)
- Produces: `<BookmarkButton paperId isBookmarked>`, `<NoteField paperId initialContent>`

- [ ] **Step 1: Write `BookmarkButton`**

```tsx
// src/components/research/BookmarkButton.tsx
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'

export function BookmarkButton({ paperId, initiallyBookmarked }: { paperId: string; initiallyBookmarked: boolean }) {
  const t = useTranslations('research')
  const { addToast } = useToast()
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    try {
      const res = await fetch('/api/research/bookmarks' + (bookmarked ? `?paper_id=${paperId}` : ''), {
        method: bookmarked ? 'DELETE' : 'POST',
        headers: bookmarked ? undefined : { 'Content-Type': 'application/json' },
        body: bookmarked ? undefined : JSON.stringify({ paper_id: paperId }),
      })
      if (res.ok) setBookmarked((b) => !b)
      else addToast(t('actionError'), 'error')
    } catch {
      addToast(t('actionError'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={toggle} disabled={busy} style={{
      fontSize: 11.5, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
      border: '1px solid rgba(20,40,90,0.14)',
      background: bookmarked ? 'rgba(47,68,134,0.12)' : 'transparent',
      color: bookmarked ? '#2f4486' : '#5768ac',
    }}>
      {bookmarked ? t('bookmarked') : t('bookmark')}
    </button>
  )
}
```

- [ ] **Step 2: Write `NoteField`**

```tsx
// src/components/research/NoteField.tsx
'use client'
import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'

export function NoteField({ paperId, initialContent }: { paperId: string; initialContent: string }) {
  const t = useTranslations('research')
  const { addToast } = useToast()
  const [content, setContent] = useState(initialContent)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onChange(value: string) {
    setContent(value)
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/research/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paper_id: paperId, content: value }),
        })
        if (res.ok) addToast(t('noteSaved'), 'success')
        else addToast(t('actionError'), 'error')
      } catch {
        addToast(t('actionError'), 'error')
      }
    }, 800) // debounce
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', color: '#9a9684', letterSpacing: '0.06em' }}>
        {t('noteLabel')}
      </label>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('notePlaceholder')}
        rows={2}
        style={{ width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid rgba(20,40,90,0.12)', fontSize: 12.5, resize: 'vertical' }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Wire both into the page for signed-in members only**

```tsx
// src/app/[locale]/research/page.tsx — replace the imports + the papers.map block
import { getSession } from '@/lib/auth'
import { BookmarkButton } from '@/components/research/BookmarkButton'
import { NoteField } from '@/components/research/NoteField'
```

```tsx
// inside ResearchPage, before the `return`:
const session = await getSession()
const member = session?.member ?? null

let bookmarkedIds = new Set<string>()
let notesByPaper = new Map<string, string>()
if (member) {
  const [{ data: bookmarks }, { data: notes }] = await Promise.all([
    service.from('research_bookmarks').select('paper_id').eq('user_id', member.id),
    service.from('research_notes').select('paper_id, content').eq('user_id', member.id),
  ])
  bookmarkedIds = new Set((bookmarks ?? []).map((b) => b.paper_id))
  notesByPaper = new Map((notes ?? []).map((n) => [n.paper_id, n.content]))
}
```

```tsx
// replace the `papers.map(...)` line with:
{papers.map((paper) => (
  <div key={paper.id}>
    <ResearchCard
      paper={paper}
      actions={member ? <BookmarkButton paperId={paper.id} initiallyBookmarked={bookmarkedIds.has(paper.id)} /> : undefined}
    />
    {member && <NoteField paperId={paper.id} initialContent={notesByPaper.get(paper.id) ?? ''} />}
  </div>
))}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in as a member, visit `/en/research`.
Expected: bookmark button toggles and persists across a page reload; typing in the note field saves after ~800ms (toast confirms); signed out, neither element renders.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/components/research/BookmarkButton.tsx src/components/research/NoteField.tsx "src/app/[locale]/research/page.tsx"
git commit -m "feat(research): add member bookmarks and private notes on the research page"
```

---

### Task 20: Admin override page

**Files:**
- Create: `src/app/[locale]/admin/research/page.tsx`
- Create: `src/components/admin/AdminResearchClient.tsx`
- Modify: `messages/en.json`, `messages/fr.json` (new `adminResearch` namespace, matching the existing `admin`/`adminAssistant` split)

**Interfaces:**
- Consumes: `requireAdmin`, `AuthError` (existing), `GET/POST /api/research` (Task 14), `GET /api/research/fetch-log` (Task 14), `POST /api/research/[id]/hide` and `/publish` (Task 15), `useToast` (existing)
- Produces: page at `/{locale}/admin/research`

- [ ] **Step 1: Add i18n keys**

`messages/en.json`:
```json
"adminResearch": {
  "title": "Research hub — admin",
  "statusAll": "All",
  "statusPublished": "Published",
  "statusRejected": "Rejected",
  "statusHidden": "Hidden",
  "hide": "Hide",
  "republish": "Republish",
  "addManual": "Add a paper manually",
  "manualTitle": "Title",
  "manualUrl": "URL",
  "manualAuthors": "Authors (comma-separated)",
  "manualAbstract": "Abstract (optional)",
  "submit": "Add",
  "added": "Paper added",
  "actionError": "Something went wrong, please try again.",
  "fetchLog": "Recent fetch runs",
  "logEmpty": "No fetch run recorded yet."
}
```

`messages/fr.json`:
```json
"adminResearch": {
  "title": "Hub de veille — admin",
  "statusAll": "Tous",
  "statusPublished": "Publiés",
  "statusRejected": "Rejetés",
  "statusHidden": "Masqués",
  "hide": "Masquer",
  "republish": "Republier",
  "addManual": "Ajouter un papier manuellement",
  "manualTitle": "Titre",
  "manualUrl": "URL",
  "manualAuthors": "Auteurs (séparés par une virgule)",
  "manualAbstract": "Résumé (optionnel)",
  "submit": "Ajouter",
  "added": "Papier ajouté",
  "actionError": "Une erreur est survenue, réessayez.",
  "fetchLog": "Derniers runs de fetch",
  "logEmpty": "Aucun run de fetch enregistré pour l'instant."
}
```

- [ ] **Step 2: Write the page** (mirrors `src/app/[locale]/admin/proposals/page.tsx` exactly)

```tsx
// src/app/[locale]/admin/research/page.tsx
import { redirect } from 'next/navigation'
import { requireAdmin, AuthError } from '@/lib/auth'
import { AdminResearchClient } from '@/components/admin/AdminResearchClient'

type Props = { params: Promise<{ locale: string }> }

export default async function AdminResearchPage({ params }: Props) {
  const { locale } = await params
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AuthError) redirect(`/${locale}/auth/login`)
    throw e
  }
  return <AdminResearchClient />
}
```

- [ ] **Step 3: Write the client component**

```tsx
// src/components/admin/AdminResearchClient.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import type { ResearchPaper, ResearchStatus, ResearchFetchLogEntry } from '@/types'

const STATUSES: (ResearchStatus | 'all')[] = ['all', 'published', 'rejected', 'hidden']

export function AdminResearchClient() {
  const t = useTranslations('adminResearch')
  const { addToast } = useToast()
  const [papers, setPapers] = useState<ResearchPaper[]>([])
  const [log, setLog] = useState<ResearchFetchLogEntry[]>([])
  const [statusFilter, setStatusFilter] = useState<ResearchStatus | 'all'>('published')
  const [form, setForm] = useState({ title: '', url: '', authors: '', abstract: '' })

  const load = useCallback(() => {
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`
    fetch(`/api/research${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setPapers(data) })
      .catch(() => addToast(t('actionError'), 'error'))
  }, [statusFilter, t, addToast])

  const loadLog = useCallback(() => {
    fetch('/api/research/fetch-log')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setLog(data) })
      .catch(() => addToast(t('actionError'), 'error'))
  }, [t, addToast])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadLog() }, [loadLog])

  async function hide(id: string) {
    const res = await fetch(`/api/research/${id}/hide`, { method: 'POST' })
    if (res.ok) load(); else addToast(t('actionError'), 'error')
  }

  async function republish(id: string) {
    const res = await fetch(`/api/research/${id}/publish`, { method: 'POST' })
    if (res.ok) load(); else addToast(t('actionError'), 'error')
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        url: form.url,
        authors: form.authors.split(',').map((a) => a.trim()).filter(Boolean),
        abstract: form.abstract || undefined,
      }),
    })
    if (res.ok) {
      addToast(t('added'), 'success')
      setForm({ title: '', url: '', authors: '', abstract: '' })
      load()
    } else {
      addToast(t('actionError'), 'error')
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px 80px' }}>
      <h1 className="font-serif" style={{ fontSize: 24, marginBottom: 20 }}>{t('title')}</h1>

      <form onSubmit={submitManual} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32, padding: 16, border: '1px solid rgba(20,40,90,0.1)', borderRadius: 10 }}>
        <strong style={{ fontSize: 13 }}>{t('addManual')}</strong>
        <input required placeholder={t('manualTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input required placeholder={t('manualUrl')} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input placeholder={t('manualAuthors')} value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
        <textarea placeholder={t('manualAbstract')} value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} rows={2} />
        <button type="submit" style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, background: '#2f4486', color: '#fff', border: 'none', cursor: 'pointer' }}>
          {t('submit')}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
            border: statusFilter === s ? '1px solid #2f4486' : '1px solid rgba(20,40,90,0.14)',
            background: statusFilter === s ? 'rgba(47,68,134,0.12)' : 'transparent',
          }}>
            {t(`status${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}` as 'statusAll')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {papers.map((paper) => (
          <div key={paper.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid rgba(20,40,90,0.08)', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13.5 }}>{paper.title}</div>
              <div className="font-mono" style={{ fontSize: 10.5, color: '#7e95d6' }}>
                {paper.source} · {paper.status} · {paper.fame_score ?? '—'}%
              </div>
            </div>
            {paper.status === 'published' && <button onClick={() => hide(paper.id)}>{t('hide')}</button>}
            {(paper.status === 'rejected' || paper.status === 'hidden') && <button onClick={() => republish(paper.id)}>{t('republish')}</button>}
          </div>
        ))}
      </div>

      <h2 className="font-serif" style={{ fontSize: 16, margin: '32px 0 12px' }}>{t('fetchLog')}</h2>
      {log.length === 0 ? (
        <p style={{ color: '#7e95d6', fontSize: 13 }}>{t('logEmpty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {log.map((entry) => (
            <div key={entry.id} className="font-mono" style={{
              fontSize: 11, padding: '8px 12px', borderRadius: 6,
              background: entry.errors > 0 ? 'rgba(192,71,59,0.08)' : 'rgba(30,155,126,0.06)',
              color: entry.errors > 0 ? '#c0473b' : '#2a3457',
            }}>
              {new Date(entry.run_at).toLocaleString()} · {entry.source} · added {entry.added} · skipped {entry.skipped} · errors {entry.errors}
              {entry.message ? ` · ${entry.message}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in as an admin, visit `/en/admin/research`.
Expected: list loads, filters switch status, manual-add form creates a `published`/`manual` row, hide/republish buttons flip status and disappear/reappear correctly across filters.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/admin/research/page.tsx" src/components/admin/AdminResearchClient.tsx messages/en.json messages/fr.json
git commit -m "feat(research): add admin override page (hide/republish/manual add)"
```

---

### Task 21: Navigation — lab menu link + home globe CTA

**Files:**
- Modify: `src/components/layout/NavMenu.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Create: `src/components/globe/ResearchHubCTA.tsx`
- Modify: `messages/en.json`, `messages/fr.json` (`nav.research`, `home.researchCta`)

**Interfaces:**
- Consumes: nothing new
- Produces: nav entry + home CTA linking to `/{locale}/research`

**⚠️ Before writing this task**: read `FAME Accueil.dc.html` via the MCP Claude Design (`DesignSync` → `get_file`, projectId `5bd688a8-2928-4c09-8d94-63f35b89ec74`) — Opus-only per AGENTS.md — to check whether the mockup already places a research-hub entry point near the globe. If it does, match its exact position/style instead of the fallback below; if a Sonnet subagent executes this task, the orchestrating Opus session must paste the relevant mockup markup into its prompt (per AGENTS.md's subagent workflow), since the subagent cannot reach the MCP itself.

- [ ] **Step 1: Add i18n keys**

`messages/en.json` — `nav` namespace, add one key: `"research": "Research radar"`.
`messages/en.json` — `home` namespace, add: `"researchCta": "Explore the research radar →"`.

`messages/fr.json` — `nav`: `"research": "Veille recherche"`.
`messages/fr.json` — `home`: `"researchCta": "Explorer la veille recherche →"`.

- [ ] **Step 2: Add the NavMenu entry**

In `src/components/layout/NavMenu.tsx`, right after the existing global `graph` link (same "hors [lab], lien absolu" pattern already in the file):

```tsx
{/* Page globale (hors [lab]) → lien absolu, pas de préfixe base. */}
<Link
  href={`/${locale}/graph`}
  onClick={() => setOpen(false)}
  className="font-serif hover:bg-[rgba(47,68,134,0.08)] transition-colors text-fame-text-body"
  style={itemStyle}
>
  {t('graph')}
</Link>
<Link
  href={`/${locale}/research`}
  onClick={() => setOpen(false)}
  className="font-serif hover:bg-[rgba(47,68,134,0.08)] transition-colors text-fame-text-body"
  style={itemStyle}
>
  {t('research')}
</Link>
```

This single addition covers "accessible from both labs" — `NavMenu` is rendered by both labs' `[lab]/layout.tsx` TopBar, and the link is absolute (not lab-prefixed), so it's the exact same menu item wherever it's opened from.

- [ ] **Step 3: Write the home CTA component**

Simple persistent link-styled pill (deliberately not a copy of `AssistantGlobeCTA`'s dismissible teaser card — this is plain navigation, not a widget launcher):

```tsx
// src/components/globe/ResearchHubCTA.tsx
'use client'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

export function ResearchHubCTA() {
  const t = useTranslations('home')
  const locale = useLocale()
  return (
    <Link
      href={`/${locale}/research`}
      className="font-mono"
      style={{
        position: 'fixed',
        left: '26px',
        bottom: '32px',
        zIndex: 1100,
        fontSize: '11.5px',
        letterSpacing: '0.04em',
        color: '#eef3ff',
        background: 'rgba(31,46,92,0.6)',
        border: '1px solid rgba(150,180,255,0.22)',
        borderRadius: '20px',
        padding: '8px 16px',
        textDecoration: 'none',
        backdropFilter: 'blur(6px)',
      }}
    >
      {t('researchCta')}
    </Link>
  )
}
```

- [ ] **Step 4: Mount it on the home page**

```tsx
// src/app/[locale]/page.tsx
import { ResearchHubCTA } from '@/components/globe/ResearchHubCTA'
```

Add `<ResearchHubCTA />` as a sibling of `<AssistantGlobeCTA />` inside the root `<div>` (bottom-left vs. the assistant's bottom-right — no overlap).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, visit `/en` — confirm the new pill renders bottom-left, links to `/en/research`, doesn't overlap the assistant CTA; open the nav menu on both `/en/paris` and `/en/montreal` — confirm the `Research radar` entry appears in both and points to the same `/en/research` URL.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/NavMenu.tsx "src/app/[locale]/page.tsx" src/components/globe/ResearchHubCTA.tsx messages/en.json messages/fr.json
git commit -m "feat(research): add nav entry + home globe CTA for the research hub"
```

---

## Post-implementation checklist (not a task — do this once Task 21 is merged)

- Set `CRON_SECRET`, `OPENALEX_MAILTO`, and (optionally) `SEMANTIC_SCHOLAR_API_KEY` in the Vercel project's environment variables — the cron route (Task 13) rejects every request, including Vercel's own, without `CRON_SECRET`.
- Confirm the Vercel plan supports `maxDuration = 60` (Hobby caps at 10s) before relying on the cron — see the note in Task 13.
- Trigger `GET /api/research/fetch` once manually (with the correct bearer header) after the first deploy to populate `research_papers` — the public page is correctly built but will show the empty state until then.
