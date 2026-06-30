import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { buildGraphData } from '@/lib/subjects/graph-data'
import { toLocale2 } from '@/lib/subjects/localized'
import { RelationGraph } from '@/components/graph/RelationGraph'
import type { Subject, SubjectRelation } from '@/types'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'graph' })
  return { title: t('metaTitle') }
}

export default async function GraphPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'graph' })

  const isMember = !!(await getSession())?.member
  const service = await createServiceClient()

  let sq = service.from('subjects').select('*')
  if (!isMember) sq = sq.eq('confidentiel', false)

  const [{ data: subjects }, { data: relations }] = await Promise.all([
    sq.order('ordre', { ascending: true }),
    service.from('subject_relations').select('*'),
  ])

  const { nodes, edges } = buildGraphData(
    (subjects ?? []) as Subject[],
    (relations ?? []) as SubjectRelation[],
    toLocale2(locale),
  )

  return (
    <div className="flex flex-col h-screen bg-fame-navy">
      {/* Minimal in-page header (no TopBar — this route is outside [lab]) */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-fame-blue-mid shrink-0">
        <Link
          href={`/${locale}`}
          className="font-mono text-xs text-fame-text-muted hover:text-fame-text-light transition-colors"
        >
          {t('back')}
        </Link>
        <span className="w-px h-4 bg-fame-blue-mid" aria-hidden="true" />
        <span className="font-mono text-xs text-fame-slate tracking-widest uppercase select-none">
          {t('kicker')}
        </span>
        <h1 className="font-mono text-sm font-semibold text-fame-text-light tracking-wide">
          {t('title')}
        </h1>
      </header>

      {/* Graph fills remaining viewport height */}
      <div className="flex-1 relative">
        <RelationGraph nodes={nodes} edges={edges} isMember={isMember} locale={locale} />
      </div>
    </div>
  )
}
