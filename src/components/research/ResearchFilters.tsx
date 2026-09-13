'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { THEMES, themeSlug } from '@/lib/research/themes'
import type { ResearchSource } from '@/types'

const SOURCES: ResearchSource[] = ['arxiv', 'openalex', 'repec', 'semantic_scholar', 'manual']

// One writer for the whole query string: every caller hands over the complete
// set of keys it wants changed, so two edits in the same event handler cannot
// each push a URL built from the same stale `searchParams` snapshot (the second
// push would win and silently drop the first — that is exactly how the Reset
// button used to clear `source` but leave `theme` in place).
function useSetParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value); else params.delete(key)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }
}

export function ResearchSearchInput() {
  const t = useTranslations('research')
  const searchParams = useSearchParams()
  const setParams = useSetParams()
  return (
    <input className="font-mono"
      type="search"
      placeholder={t('searchPlaceholder')}
      defaultValue={searchParams.get('q') ?? ''}
      onChange={(e) => setParams({ q: e.target.value })}
      style={{
        padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(20,40,90,0.15)',
        background: 'rgba(255,255,255,0.7)', fontSize: 11, width: 220, outline: 'none',
      }}
    />
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="font-mono text-fame-blue" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  )
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`font-mono ${active ? 'text-fame-blue border-fame-blue' : ''}`}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 6,
        border: active ? '1.5px solid' : '1px solid rgba(20,40,90,0.12)',
        background: active ? 'rgba(47,68,134,0.12)' : 'rgba(20,30,60,0.03)',
        color: active ? undefined : '#5a6486', fontSize: 11, cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      {children}
    </button>
  )
}

export function ResearchFilterSidebar({ paperCount }: { paperCount: number }) {
  const t = useTranslations('research')
  const searchParams = useSearchParams()
  const setParams = useSetParams()
  const activeTheme = searchParams.get('theme') ?? ''
  const activeSource = searchParams.get('source') ?? ''

  // Both keys cleared in a single push — see useSetParams.
  function reset() {
    setParams({ theme: '', source: '' })
  }

  return (
    <aside style={{
      width: 300, flexShrink: 0, background: 'rgba(244,243,236,0.92)', backdropFilter: 'blur(12px)',
      borderLeft: '1px solid rgba(20,40,90,0.1)', overflowY: 'auto', padding: '20px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="font-mono text-fame-blue" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {t('filters')}
        </span>
        <button className="font-mono" onClick={reset} style={{ fontSize: 9, color: '#6b7596', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', textDecoration: 'underline' }}>
          {t('reset')}
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid rgba(20,40,90,0.1)', borderRadius: 10, padding: '10px 12px', textAlign: 'center', marginBottom: 20 }}>
        <div className="font-serif text-fame-text-dark" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{paperCount}</div>
        <div className="font-mono" style={{ fontSize: 9, color: '#6b7596', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('statPapers')}</div>
      </div>

      {/* The theme name and the source slug stay the stable DB/query-param
          values; only the label shown here is translated. */}
      <FilterSection label={t('theme')}>
        {THEMES.map(({ name }) => (
          <FilterBtn key={name} active={activeTheme === name} onClick={() => setParams({ theme: activeTheme === name ? '' : name })}>
            {t(`themes.${themeSlug(name)}` as 'themes.llms')}
          </FilterBtn>
        ))}
      </FilterSection>

      <FilterSection label={t('source')}>
        {SOURCES.map((s) => (
          <FilterBtn key={s} active={activeSource === s} onClick={() => setParams({ source: activeSource === s ? '' : s })}>
            {t(`sources.${s}` as 'sources.arxiv')}
          </FilterBtn>
        ))}
      </FilterSection>
    </aside>
  )
}
