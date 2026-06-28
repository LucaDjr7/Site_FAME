'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { SourceRef } from '@/lib/assistant/types'

export function SourceCitations({ sources, locale, lab }: { sources: SourceRef[]; locale: string; lab?: string }) {
  const t = useTranslations('assistant')
  if (!sources || sources.length === 0) return null
  return (
    <div className="mt-2 text-xs font-mono text-fame-text-muted">
      <span className="uppercase tracking-wide">{t('sources')}: </span>
      {sources.map((s, i) => {
        const labo = s.labo ?? lab
        const isFile = s.source_type === 'subject_file'
        const target = isFile ? s.subject_id : s.source_id
        if ((s.source_type === 'subject' || isFile) && labo && target) {
          return (
            <Link key={i} href={`/${locale}/${labo}/paper/${target}`} className="underline hover:text-fame-blue mr-2">
              {isFile ? (s.file_name ?? t('unknownDocument')) : `${s.source_type}:${s.source_id.slice(0, 8)}`}
            </Link>
          )
        }
        return <span key={i} className="mr-2">{s.source_type}</span>
      })}
    </div>
  )
}
