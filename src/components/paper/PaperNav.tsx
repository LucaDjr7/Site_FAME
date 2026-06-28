'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Subject, SubjectStatus, Lab } from '@/types'

const STATUS_COLOR: Record<SubjectStatus, string> = { active: '#1e9b7e', 'on-hold': '#e8b149', done: '#2f4486' }

/** Height of the bottom thumbnail nav strip (px). Shared so the assistant bubble can sit just above it. */
export const PAPER_NAV_HEIGHT = 102

type Props = {
  subjects: Pick<Subject, 'id' | 'titre' | 'statut' | 'ordre'>[]
  currentId: string
  lab: Lab
  locale: string
}

export function PaperNav({ subjects, currentId, lab, locale }: Props) {
  const t = useTranslations('paper')
  const idx = subjects.findIndex(s => s.id === currentId)
  const single = subjects.length <= 1
  const prev = !single ? subjects[(idx - 1 + subjects.length) % subjects.length] : null
  const next = !single ? subjects[(idx + 1) % subjects.length] : null
  const href = (id: string) => `/${locale}/${lab}/paper/${id}`

  return (
    <div className="bg-fame-navy" style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: PAPER_NAV_HEIGHT, pointerEvents: 'auto',
      display: 'flex', alignItems: 'center', gap: 16, padding: '0 26px',
      borderTop: '1px solid rgba(20,40,90,0.4)',
    }}>
      {prev ? (
        <Link href={href(prev.id)} aria-label={t('prev')} style={arrowStyle}>‹</Link>
      ) : (
        <span aria-hidden="true" style={{ ...arrowStyle, opacity: 0.25, cursor: 'default', pointerEvents: 'none' }}>‹</span>
      )}
      <div className="fame-scroll" style={{ flex: 1, display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 4px' }}>
        {subjects.map(s => {
          const active = s.id === currentId
          return (
            <Link key={s.id} href={href(s.id)} title={s.titre} style={{ flex: 'none', width: 120, textAlign: 'left', textDecoration: 'none', opacity: active ? 1 : 0.5, transition: 'opacity .2s ease' }}>
              <div style={{ position: 'relative', height: 58, borderRadius: 5, background: '#f5f4ee', overflow: 'hidden', boxShadow: '0 4px 14px -6px rgba(0,5,30,0.6)', outline: active ? '2px solid #5b7cf0' : '2px solid transparent', outlineOffset: 2 }}>
                <div style={{ height: 13, margin: '6px 6px 0', borderRadius: 2, background: 'rgba(20,32,63,0.16)' }} />
                <div style={{ margin: '5px 6px', height: 24, borderRadius: 2, background: 'repeating-linear-gradient(135deg,#e4e2d6 0 5px,#eceadf 5px 10px)' }} />
                <span style={{ position: 'absolute', top: 5, right: 6, width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[s.statut] }} />
              </div>
              <div className="font-mono" style={{ marginTop: 6, fontSize: 10, lineHeight: 1.25, color: active ? '#eef3ff' : '#8a9bcb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',  letterSpacing: '0.02em' }}>{s.titre}</div>
            </Link>
          )
        })}
      </div>
      {next ? (
        <Link href={href(next.id)} aria-label={t('next')} style={arrowStyle}>›</Link>
      ) : (
        <span aria-hidden="true" style={{ ...arrowStyle, opacity: 0.25, cursor: 'default', pointerEvents: 'none' }}>›</span>
      )}
    </div>
  )
}

const arrowStyle: React.CSSProperties = {
  flex: 'none', width: 42, height: 52, borderRadius: 10, border: '1px solid rgba(150,180,255,0.2)',
  background: 'rgba(31,46,92,0.6)', color: '#cdd8f5', fontSize: 18, display: 'flex',
  alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
}
