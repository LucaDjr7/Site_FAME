'use client'
import { useTranslations } from 'next-intl'
import type { Subject, SubjectStatus, Difficulty, MemberRef, DateBucket } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { DiffDots } from '@/components/ui/DiffDots'
import { dateBucket } from '@/lib/utils'

// Count subjects matching all filters except one dimension
function countExcluding(
  subjects: Subject[],
  q: string,
  fStatus: Set<SubjectStatus>,
  fDiff: Set<Difficulty>,
  fPerson: Set<string>,
  fDate: Set<DateBucket>,
  ignoreDim: 'status' | 'diff' | 'person' | 'date',
  value: string,
): number {
  return subjects.filter(s => {
    if (q && !s.titre.toLowerCase().includes(q.toLowerCase())) return false
    if (ignoreDim !== 'status' && fStatus.size > 0 && !fStatus.has(s.statut)) return false
    if (ignoreDim !== 'diff' && fDiff.size > 0 && !fDiff.has(s.difficulte)) return false
    if (ignoreDim !== 'person' && fPerson.size > 0 && !s.auteurs.some(id => fPerson.has(id))) return false
    if (ignoreDim !== 'date' && fDate.size > 0 && !fDate.has(dateBucket(s.created_at))) return false
    // Now check if this subject matches the "value" for the ignored dimension
    if (ignoreDim === 'status') return s.statut === value
    if (ignoreDim === 'diff') return s.difficulte === value
    if (ignoreDim === 'person') return s.auteurs.includes(value)
    if (ignoreDim === 'date') return dateBucket(s.created_at) === value
    return true
  }).length
}

const STATUS_DOT: Record<string, string> = {
  active: '#1e9b7e',
  'on-hold': '#e8b149',
  done: '#2f4486',
}


type Props = {
  subjects: Subject[]
  members: MemberRef[]
  q: string
  fStatus: Set<SubjectStatus>
  fDiff: Set<Difficulty>
  fPerson: Set<string>
  fDate: Set<DateBucket>
  open: boolean
  onToggle: () => void
  onToggleStatus: (v: SubjectStatus) => void
  onToggleDiff: (v: Difficulty) => void
  onTogglePerson: (v: string) => void
  onToggleDate: (v: DateBucket) => void
  onReset: () => void
}

const ACTIVE_FILTER_STYLE: React.CSSProperties = {
  background: 'rgba(47,68,134,0.12)',
  border: '1px solid',
}

const INACTIVE_FILTER_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(87,104,172,0.25)',
}

export function FilterSidebar({
  subjects, members, q,
  fStatus, fDiff, fPerson, fDate,
  open, onToggle, onToggleStatus, onToggleDiff, onTogglePerson, onToggleDate, onReset,
}: Props) {
  const t = useTranslations('lab')

  const hasActiveFilters = fStatus.size > 0 || fDiff.size > 0 || fPerson.size > 0 || fDate.size > 0

  // Members that appear in at least one subject's auteurs
  const personIds = new Set(subjects.flatMap(s => s.auteurs))
  const filteredMembers = members.filter(m => personIds.has(m.id))

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
    borderRadius: 5, cursor: 'pointer', fontSize: 11, 
    transition: 'all 0.12s', width: '100%', textAlign: 'left',
  }

  if (!open) {
    // Collapsed rail
    return (
      <div
        style={{
          width: 46,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 16,
          background: 'rgba(244,243,236,0.92)',
          backdropFilter: 'blur(8px)',
          borderLeft: '1px solid rgba(87,104,172,0.15)',
          cursor: 'pointer',
        }}
        onClick={onToggle}
        title={t('filters')}
      >
        <span className="font-mono text-fame-slate" style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          writingMode: 'vertical-rl',
          marginTop: 8,
        }}>
          {t('filters')}
        </span>
        {hasActiveFilters && (
          <span className="bg-fame-blue" style={{
            width: 7, height: 7, borderRadius: '50%',
            marginTop: 10,
          }} />
        )}
      </div>
    )
  }

  const statuses: SubjectStatus[] = ['active', 'on-hold', 'done']
  const difficulties: Array<{ key: Difficulty; level: number }> = [
    { key: 'easy', level: 1 },
    { key: 'intermediate', level: 2 },
    { key: 'advanced', level: 3 },
  ]
  const dates: DateBucket[] = ['2025', '2024', 'older']

  return (
    <div style={{
      width: 230,
      flexShrink: 0,
      background: 'rgba(244,243,236,0.92)',
      backdropFilter: 'blur(8px)',
      borderLeft: '1px solid rgba(87,104,172,0.15)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 12px' }}>
        <span className="font-mono text-fame-text-body" style={{
           fontSize: 10,
          fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {t('filters')}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasActiveFilters && (
            <button className="font-mono text-fame-slate"
              onClick={onReset}
              style={{
                 fontSize: 9,
                background: 'none', border: 'none', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}
            >
              {t('reset')}
            </button>
          )}
          <button className="font-mono text-fame-slate"
            onClick={onToggle}
            style={{
               fontSize: 12,
              background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            »
          </button>
        </div>
      </div>

      {/* Statut */}
      <div style={{ padding: '0 14px 14px' }}>
        <div className="font-mono text-fame-slate" style={{
           fontSize: 8,
          fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          {t('section.status')}
        </div>
        {statuses.map(s => {
          const count = countExcluding(subjects, q, fStatus, fDiff, fPerson, fDate, 'status', s)
          const active = fStatus.has(s)
          return (
            <button
              key={s}
              onClick={() => onToggleStatus(s)}
              aria-pressed={active}
              className={`font-mono ${active ? 'text-fame-blue border-fame-blue' : 'text-fame-text-muted'}`} style={{ ...btnBase, ...(active ? ACTIVE_FILTER_STYLE : INACTIVE_FILTER_STYLE) }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[s], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 10 }}>{t(`status.${s}`)}</span>
              <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Difficulté */}
      <div style={{ padding: '0 14px 14px' }}>
        <div className="font-mono text-fame-slate" style={{
           fontSize: 8,
          fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          {t('section.difficulty')}
        </div>
        {difficulties.map(({ key, level }) => {
          const count = countExcluding(subjects, q, fStatus, fDiff, fPerson, fDate, 'diff', key)
          const active = fDiff.has(key)
          return (
            <button
              key={key}
              onClick={() => onToggleDiff(key)}
              aria-pressed={active}
              className={`font-mono ${active ? 'text-fame-blue border-fame-blue' : 'text-fame-text-muted'}`} style={{ ...btnBase, ...(active ? ACTIVE_FILTER_STYLE : INACTIVE_FILTER_STYLE) }}
            >
              <DiffDots level={level} />
              <span style={{ flex: 1, fontSize: 10 }}>{t(`difficulty.${key}`)}</span>
              <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Personnes — hidden if no members in subjects */}
      {filteredMembers.length > 0 && (
        <div style={{ padding: '0 14px 14px' }}>
          <div className="font-mono text-fame-slate" style={{
             fontSize: 8,
            fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            {t('section.people')}
          </div>
          {filteredMembers.map(m => {
            const count = countExcluding(subjects, q, fStatus, fDiff, fPerson, fDate, 'person', m.id)
            const active = fPerson.has(m.id)
            const name = `${m.prenom} ${m.nom}`
            return (
              <button
                key={m.id}
                onClick={() => onTogglePerson(m.id)}
                aria-pressed={active}
                className={`font-mono ${active ? 'text-fame-blue border-fame-blue' : 'text-fame-text-muted'}`} style={{ ...btnBase, ...(active ? ACTIVE_FILTER_STYLE : INACTIVE_FILTER_STYLE) }}
              >
                <Avatar name={name} photoUrl={m.photo_url} size={16} />
                <span style={{ flex: 1, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {name}
                </span>
                <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Date d'existence */}
      <div style={{ padding: '0 14px 14px' }}>
        <div className="font-mono text-fame-slate" style={{
           fontSize: 8,
          fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          {t('section.date')}
        </div>
        {dates.map(d => {
          const count = countExcluding(subjects, q, fStatus, fDiff, fPerson, fDate, 'date', d)
          const active = fDate.has(d)
          return (
            <button
              key={d}
              onClick={() => onToggleDate(d)}
              aria-pressed={active}
              className={`font-mono ${active ? 'text-fame-blue border-fame-blue' : 'text-fame-text-muted'}`} style={{ ...btnBase, ...(active ? ACTIVE_FILTER_STYLE : INACTIVE_FILTER_STYLE) }}
            >
              <span style={{ flex: 1, fontSize: 10 }}>{t(`date.${d}`)}</span>
              <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
