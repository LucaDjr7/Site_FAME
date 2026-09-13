import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { RESEARCH_PAPER_COLUMNS } from '@/lib/research/columns'
import { sanitizeSearchTerm } from '@/lib/research/search'
import { ResearchCard } from '@/components/research/ResearchCard'
import { ResearchSearchInput, ResearchFilterSidebar } from '@/components/research/ResearchFilters'
import { BookmarkButton } from '@/components/research/BookmarkButton'
import { NoteField } from '@/components/research/NoteField'
import type { ResearchPaper } from '@/types'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; theme?: string; source?: string }>
}

// Intentional variance: 3-gradient composite with specific position offsets, matching PublicationList's PAGE_BG.
const PAGE_BG =
  'radial-gradient(110% 80% at 26% 8%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%), ' +
  'radial-gradient(120% 110% at 78% 112%, rgba(113,120,132,0.2) 0%, rgba(113,120,132,0) 60%), ' +
  'radial-gradient(140% 120% at 92% 44%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%), ' +
  '#F9F9FA'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'research' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

export default async function ResearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { q, theme, source } = await searchParams
  const t = await getTranslations('research')

  const service = await createServiceClient()
  // Explicit columns, never `*`: `research_papers.embedding` is a 1536-float
  // pgvector that must not end up in the RSC payload (see columns.ts).
  let query = service.from('research_papers').select(RESEARCH_PAPER_COLUMNS).eq('status', 'published')
  if (theme) query = query.contains('themes', [theme])
  if (source) query = query.eq('source', source)
  // `q` is interpolated into PostgREST's `.or()` mini-language — strip the
  // characters that would re-partition that string or act as ilike wildcards.
  const searchTerm = q ? sanitizeSearchTerm(q) : ''
  if (searchTerm) query = query.or(`title.ilike.%${searchTerm}%,abstract.ilike.%${searchTerm}%`)

  const { data, error } = await query.order('published_at', { ascending: false })
  // A failed query must not render as the legitimate "no papers yet" empty
  // state — that is how a broken filter or a DB outage stays invisible.
  if (error) console.error('[research] query failed:', error.message)
  const papers: ResearchPaper[] = error ? [] : ((data ?? []) as unknown as ResearchPaper[])

  const grouped = Object.values(
    papers.reduce<Record<string, { year: string; items: ResearchPaper[] }>>((acc, p) => {
      const year = p.published_at ? p.published_at.slice(0, 4) : 'undated'
      acc[year] ??= { year, items: [] }
      acc[year].items.push(p)
      return acc
    }, {})
  ).sort((a, b) => (a.year === 'undated' ? 1 : b.year === 'undated' ? -1 : b.year.localeCompare(a.year)))

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

  return (
    <div className="font-serif" style={{ minHeight: 'calc(100vh - 6rem)', display: 'flex', flexDirection: 'column', background: PAGE_BG, color: '#18244c' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 14px', flexShrink: 0, borderBottom: '1px solid rgba(20,40,90,0.1)' }}>
        <div>
          {/* /research sits outside [locale]/[lab]/, so it inherits no TopBar —
              same situation (and same treatment) as [locale]/privacy. */}
          <Link
            href={`/${locale}`}
            className="font-mono inline-block mb-2 text-sm text-fame-blue hover:underline"
          >
            {t('back')}
          </Link>
          <div className="font-mono text-fame-text-muted" style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 3 }}>
            {t('kicker')}
          </div>
          <h1 className="font-serif text-fame-text-dark" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{t('title')}</h1>
        </div>
        <ResearchSearchInput />
      </div>

      {/* Body row */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 40px' }}>
          {error ? (
            <div className="font-mono text-fame-red" style={{ fontSize: 13, textAlign: 'center', paddingTop: 60 }}>{t('loadError')}</div>
          ) : papers.length === 0 ? (
            <div className="font-mono text-fame-text-muted" style={{ fontSize: 13, textAlign: 'center', paddingTop: 60 }}>{t('empty')}</div>
          ) : (
            <div style={{ maxWidth: 780, margin: '0 auto' }}>
              {grouped.map(({ year, items }) => (
                <div key={year} style={{ marginBottom: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <span className="font-mono text-fame-blue" style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.14em', flexShrink: 0 }}>
                      {year === 'undated' ? t('unknownDate') : year}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(20,40,90,0.12)' }} />
                    <span className="font-mono" style={{ fontSize: 10, color: '#6b7596', letterSpacing: '0.1em', flexShrink: 0 }}>
                      {items.length} {t('countSuffix')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {items.map((paper) => (
                      <div key={paper.id}>
                        <ResearchCard
                          paper={paper}
                          actions={member ? <BookmarkButton paperId={paper.id} initiallyBookmarked={bookmarkedIds.has(paper.id)} /> : undefined}
                        />
                        {member && <NoteField paperId={paper.id} initialContent={notesByPaper.get(paper.id) ?? ''} />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <ResearchFilterSidebar paperCount={papers.length} />
      </div>
    </div>
  )
}
