'use client'
import { useTranslations } from 'next-intl'
import type { Subject, TaskWithRelations, MemberRef, TaskStatus, Difficulty, DateBucket } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { DiffDots, DIFF_LEVEL, TASK_STATUS_COLOR, STATUS_KEY, SUBJECT_STATUS_COLOR } from './kanban-shared'
import { dateBucket } from '@/lib/utils'

type Dim = 'subject' | 'status' | 'diff' | 'person' | 'date'

function passes(
  t: TaskWithRelations, q: string,
  fSubject: Set<string>, fStatus: Set<TaskStatus>, fDiff: Set<Difficulty>, fPerson: Set<string>, fDate: Set<DateBucket>,
  ignore: Dim,
): boolean {
  if (q && !t.titre.toLowerCase().includes(q.toLowerCase())) return false
  if (ignore !== 'subject' && fSubject.size > 0 && !fSubject.has(t.sujet_id)) return false
  if (ignore !== 'status' && fStatus.size > 0 && !fStatus.has(t.statut)) return false
  if (ignore !== 'diff' && fDiff.size > 0 && !fDiff.has(t.difficulte)) return false
  if (ignore !== 'person' && fPerson.size > 0 && !t.assignees.some(a => fPerson.has(a.id))) return false
  if (ignore !== 'date' && fDate.size > 0 && !fDate.has(dateBucket(t.date_creation ?? ''))) return false
  return true
}

function countFor(
  tasks: TaskWithRelations[], q: string,
  fSubject: Set<string>, fStatus: Set<TaskStatus>, fDiff: Set<Difficulty>, fPerson: Set<string>, fDate: Set<DateBucket>,
  dim: Dim, value: string,
): number {
  return tasks.filter(t => {
    if (!passes(t, q, fSubject, fStatus, fDiff, fPerson, fDate, dim)) return false
    if (dim === 'subject') return t.sujet_id === value
    if (dim === 'status') return t.statut === value
    if (dim === 'diff') return t.difficulte === value
    if (dim === 'person') return t.assignees.some(a => a.id === value)
    if (dim === 'date') return dateBucket(t.date_creation ?? '') === value
    return true
  }).length
}

type Props = {
  subjects: Subject[]
  tasks: TaskWithRelations[]
  members: MemberRef[]
  q: string
  fSubject: Set<string>
  fStatus: Set<TaskStatus>
  fDiff: Set<Difficulty>
  fPerson: Set<string>
  fDate: Set<DateBucket>
  open: boolean
  onToggle: () => void
  onToggleSubject: (v: string) => void
  onToggleStatus: (v: TaskStatus) => void
  onToggleDiff: (v: Difficulty) => void
  onTogglePerson: (v: string) => void
  onToggleDate: (v: DateBucket) => void
  onReset: () => void
}

const ACTIVE: React.CSSProperties = { background: 'rgba(47,68,134,0.12)', border: '1px solid #2f4486', color: '#2f4486' }
const INACTIVE: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(87,104,172,0.25)', color: '#7e95d6' }

export function TaskFilterSidebar({
  subjects, tasks, members, q,
  fSubject, fStatus, fDiff, fPerson, fDate,
  open, onToggle, onToggleSubject, onToggleStatus, onToggleDiff, onTogglePerson, onToggleDate, onReset,
}: Props) {
  const t = useTranslations('tasks')
  const hasActive = fSubject.size > 0 || fStatus.size > 0 || fDiff.size > 0 || fPerson.size > 0 || fDate.size > 0

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 5, cursor: 'pointer',
    fontSize: 11, fontFamily: 'IBM Plex Mono, monospace', transition: 'all 0.12s', width: '100%', textAlign: 'left',
  }
  const sectionLabel: React.CSSProperties = {
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, fontWeight: 600, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: '#5768ac', marginBottom: 6,
  }

  if (!open) {
    return (
      <div
        onClick={onToggle}
        title={t('filters')}
        style={{
          width: 46, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16,
          background: 'rgba(244,243,236,0.92)', backdropFilter: 'blur(8px)', borderLeft: '1px solid rgba(87,104,172,0.15)', cursor: 'pointer',
        }}
      >
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#5768ac', writingMode: 'vertical-rl', marginTop: 8,
        }}>
          {t('filters')}
        </span>
        {hasActive && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2f4486', marginTop: 10 }} />}
      </div>
    )
  }

  const statuses: TaskStatus[] = ['to-do', 'in-progress', 'done']
  const diffs: Array<{ key: Difficulty }> = [{ key: 'easy' }, { key: 'intermediate' }, { key: 'advanced' }]
  const dates: DateBucket[] = ['2025', '2024', 'older']
  const personIds = new Set(tasks.flatMap(t => t.assignees.map(a => a.id)))
  const people = members.filter(m => personIds.has(m.id))

  return (
    <div style={{
      width: 230, flexShrink: 0, background: 'rgba(244,243,236,0.92)', backdropFilter: 'blur(8px)',
      borderLeft: '1px solid rgba(87,104,172,0.15)', display: 'flex', flexDirection: 'column', padding: '16px 0', overflowY: 'auto',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px 12px' }}>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#2a3457',
        }}>
          {t('filters')}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {hasActive && (
            <button onClick={onReset} style={{
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: '#5768ac', background: 'none', border: 'none',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {t('reset')}
            </button>
          )}
          <button onClick={onToggle} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: '#5768ac', background: 'none', border: 'none', cursor: 'pointer' }}>
            »
          </button>
        </div>
      </div>

      {/* Sujet */}
      <div style={{ padding: '0 14px 14px' }}>
        <div style={sectionLabel}>{t('section.subject')}</div>
        {subjects.map(s => {
          const count = countFor(tasks, q, fSubject, fStatus, fDiff, fPerson, fDate, 'subject', s.id)
          const active = fSubject.has(s.id)
          return (
            <button key={s.id} onClick={() => onToggleSubject(s.id)} aria-pressed={active} style={{ ...btnBase, ...(active ? ACTIVE : INACTIVE) }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: SUBJECT_STATUS_COLOR[s.statut], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.titre}</span>
              <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Statut */}
      <div style={{ padding: '0 14px 14px' }}>
        <div style={sectionLabel}>{t('section.status')}</div>
        {statuses.map(s => {
          const count = countFor(tasks, q, fSubject, fStatus, fDiff, fPerson, fDate, 'status', s)
          const active = fStatus.has(s)
          return (
            <button key={s} onClick={() => onToggleStatus(s)} aria-pressed={active} style={{ ...btnBase, ...(active ? ACTIVE : INACTIVE) }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: TASK_STATUS_COLOR[s], flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 10 }}>{t(`status.${STATUS_KEY[s]}`)}</span>
              <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Difficulté */}
      <div style={{ padding: '0 14px 14px' }}>
        <div style={sectionLabel}>{t('section.difficulty')}</div>
        {diffs.map(({ key }) => {
          const count = countFor(tasks, q, fSubject, fStatus, fDiff, fPerson, fDate, 'diff', key)
          const active = fDiff.has(key)
          return (
            <button key={key} onClick={() => onToggleDiff(key)} aria-pressed={active} style={{ ...btnBase, ...(active ? ACTIVE : INACTIVE) }}>
              <DiffDots level={DIFF_LEVEL[key] ?? 0} />
              <span style={{ flex: 1, fontSize: 10 }}>{t(`difficulty.${key}`)}</span>
              <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Personnes */}
      {people.length > 0 && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={sectionLabel}>{t('section.people')}</div>
          {people.map(m => {
            const count = countFor(tasks, q, fSubject, fStatus, fDiff, fPerson, fDate, 'person', m.id)
            const active = fPerson.has(m.id)
            const name = `${m.prenom} ${m.nom}`
            return (
              <button key={m.id} onClick={() => onTogglePerson(m.id)} aria-pressed={active} style={{ ...btnBase, ...(active ? ACTIVE : INACTIVE) }}>
                <Avatar name={name} photoUrl={m.photo_url} size={16} />
                <span style={{ flex: 1, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Date */}
      <div style={{ padding: '0 14px 14px' }}>
        <div style={sectionLabel}>{t('section.date')}</div>
        {dates.map(d => {
          const count = countFor(tasks, q, fSubject, fStatus, fDiff, fPerson, fDate, 'date', d)
          const active = fDate.has(d)
          return (
            <button key={d} onClick={() => onToggleDate(d)} aria-pressed={active} style={{ ...btnBase, ...(active ? ACTIVE : INACTIVE) }}>
              <span style={{ flex: 1, fontSize: 10 }}>{t(`date.${d}`)}</span>
              <span style={{ fontSize: 9, opacity: 0.65 }}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
