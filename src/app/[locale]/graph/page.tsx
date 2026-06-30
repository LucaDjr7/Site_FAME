import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'
import { RelationGraph } from '@/components/graph/RelationGraph'
import type { Subject, SubjectRelation, MemberRef } from '@/types'

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

  const [{ data: subjects }, { data: relations }, { data: members }] = await Promise.all([
    sq.order('ordre', { ascending: true }),
    service.from('subject_relations').select('*'),
    service.from('members').select('id,prenom,nom,photo_url'),
  ])

  return (
    <div className="flex flex-col h-screen bg-fame-sand-bg">
      {/* Minimal in-page header (no TopBar — this route is outside [lab]) */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-fame-ecru shrink-0 bg-white/70 backdrop-blur-sm">
        <Link
          href={`/${locale}`}
          className="font-mono text-xs text-fame-slate hover:text-fame-blue transition-colors"
        >
          {t('back')}
        </Link>
        <span className="w-px h-4 bg-fame-ecru" aria-hidden="true" />
        <span className="font-mono text-xs text-fame-slate tracking-widest uppercase select-none">
          {t('kicker')}
        </span>
        <h1 className="font-mono text-sm font-semibold text-fame-text-dark tracking-wide">
          {t('title')}
        </h1>
      </header>

      {/* Graph fills remaining viewport height */}
      <div className="flex-1 relative">
        <RelationGraph
          subjects={(subjects ?? []) as Subject[]}
          relations={(relations ?? []) as SubjectRelation[]}
          members={(members ?? []) as MemberRef[]}
          isMember={isMember}
          locale={locale}
        />
      </div>
    </div>
  )
}
