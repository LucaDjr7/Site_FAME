import { useTranslations } from 'next-intl'
import type { ResearchPaper, ResearchSource } from '@/types'

type BadgeCfg = { hex: string; bg: string; border: string }

const SOURCE_BADGE: Record<ResearchSource, BadgeCfg> = {
  arxiv:             { hex: '#5768ac', bg: 'rgba(87,104,172,0.08)',  border: 'rgba(87,104,172,0.3)' },
  openalex:          { hex: '#1e9b7e', bg: 'rgba(30,155,126,0.08)', border: 'rgba(30,155,126,0.3)' },
  repec:             { hex: '#e8b149', bg: 'rgba(232,177,73,0.1)',  border: 'rgba(232,177,73,0.35)' },
  semantic_scholar:  { hex: '#ec6553', bg: 'rgba(236,101,83,0.08)', border: 'rgba(236,101,83,0.3)' },
  manual:            { hex: '#28b8ce', bg: 'rgba(40,184,206,0.08)', border: 'rgba(40,184,206,0.3)' },
}

export function ResearchCard({ paper, actions }: { paper: ResearchPaper; actions?: React.ReactNode }) {
  const t = useTranslations('research')
  const badge = SOURCE_BADGE[paper.source]

  return (
    <article
      className="bg-fame-sand"
      style={{
        position: 'relative',
        borderRadius: 9,
        boxShadow: '0 14px 34px -20px rgba(0,5,30,0.4), inset 0 0 0 1px rgba(0,0,0,0.05)',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Meta row: source badge + venue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="font-mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 9px', borderRadius: 6, border: `1px solid ${badge.border}`, background: badge.bg,
          fontSize: 9.5, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: badge.hex,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.hex, flexShrink: 0 }} />
          {paper.source}
        </span>
        {paper.venue && (
          <span className="font-mono" style={{ fontSize: 10, color: '#6b7596' }}>{paper.venue}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-serif text-fame-text-dark" style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.28, letterSpacing: '-0.005em' }}>
        {paper.title}
      </h3>

      {/* Authors */}
      {paper.authors.length > 0 && (
        <div className="font-serif" style={{ fontSize: 12.5, color: '#43507a' }}>
          {paper.authors.join(', ')}
        </div>
      )}

      {/* Abstract preview */}
      {paper.abstract && (
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#2a3457', margin: 0 }}>
          {paper.abstract.length > 320 ? `${paper.abstract.slice(0, 320)}…` : paper.abstract}
        </p>
      )}

      {/* Theme chips + FAME score */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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

      {/* Link chip + member actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <a className="font-mono text-fame-blue" href={paper.url} target="_blank" rel="noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5,
          border: '1px solid rgba(47,68,134,0.28)', fontSize: 10, textDecoration: 'none', background: 'rgba(47,68,134,0.04)',
        }}>
          ↗ {t('viewSource')}
        </a>
        {actions}
      </div>
    </article>
  )
}
