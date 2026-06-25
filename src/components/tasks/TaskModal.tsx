'use client'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { DiffDots, DIFF_LEVEL, TASK_STATUS_COLOR, STATUS_KEY, ProgressBar, taskProgress } from './kanban-shared'
import type { TaskWithRelations, TaskStatus, Difficulty } from '@/types'

const STATUS_OPTS: TaskStatus[] = ['to-do', 'in-progress', 'done']
const DIFF_OPTS: Difficulty[] = ['easy', 'intermediate', 'advanced']

type Props = {
  task: TaskWithRelations | null
  subjectTitle: string
  isMember: boolean
  currentMemberId: string | null
  onClose: () => void
  onPatch: (taskId: string, fields: { statut?: TaskStatus; difficulte?: Difficulty }) => void
  onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => void
  onClaim: (taskId: string) => void
}

const labelStyle: React.CSSProperties = {
   fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', marginBottom: 7,
}

export function TaskModal({ task, subjectTitle, isMember, currentMemberId, onClose, onPatch, onToggleSubtask, onClaim }: Props) {
  const t = useTranslations('tasks')
  if (!task) return null

  const pct = taskProgress(task)
  const claimedByMe = !!currentMemberId && task.assignees.some(a => a.id === currentMemberId)
  const subs = task.subtasks ?? []

  return (
    <Modal open={!!task} onClose={onClose}>
      {/* kicker = subject */}
      <div className="font-mono text-fame-slate" style={{
         fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {subjectTitle}
      </div>
      <div className="font-serif text-fame-text-dark" style={{  fontSize: 18, fontWeight: 600, marginBottom: 18 }}>
        {task.titre}
      </div>

      {/* Status */}
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono text-fame-slate" style={labelStyle}>{t('section.status')}</div>
        {isMember ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_OPTS.map(s => {
              const active = task.statut === s
              return (
                <button
                  className={`font-mono ${active ? 'text-fame-text-body' : 'text-fame-text-muted border-fame-ecru'}`}
                  key={s}
                  onClick={() => onPatch(task.id, { statut: s })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20,
                     fontSize: 10, cursor: 'pointer',
                    border: active ? `1.5px solid ${TASK_STATUS_COLOR[s]}` : '1px solid',
                    background: active ? 'rgba(47,68,134,0.08)' : 'transparent',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: TASK_STATUS_COLOR[s] }} />
                  {t(`status.${STATUS_KEY[s]}`)}
                </button>
              )
            })}
          </div>
        ) : (
          <span className="font-mono text-fame-text-body" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,  fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TASK_STATUS_COLOR[task.statut] }} />
            {t(`status.${STATUS_KEY[task.statut]}`)}
          </span>
        )}
      </div>

      {/* Difficulty */}
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono text-fame-slate" style={labelStyle}>{t('section.difficulty')}</div>
        {isMember ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DIFF_OPTS.map(d => {
              const active = task.difficulte === d
              return (
                <button
                  className={`font-mono ${active ? 'text-fame-blue border-fame-blue' : 'text-fame-text-muted border-fame-ecru'}`}
                  key={d}
                  onClick={() => onPatch(task.id, { difficulte: d })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20,
                     fontSize: 10, cursor: 'pointer',
                    border: active ? '1.5px solid' : '1px solid',
                    background: active ? 'rgba(47,68,134,0.08)' : 'transparent',
                  }}
                >
                  <DiffDots level={DIFF_LEVEL[d] ?? 0} />
                  {t(`difficulty.${d}`)}
                </button>
              )
            })}
          </div>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <DiffDots level={DIFF_LEVEL[task.difficulte] ?? 0} />
            <span className="font-mono text-fame-text-body" style={{  fontSize: 10 }}>{t(`difficulty.${task.difficulte}`)}</span>
          </span>
        )}
      </div>

      {/* Progress (derived, read-only) */}
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono text-fame-slate" style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('progress')}</span>
          <span>{pct}%</span>
        </div>
        <ProgressBar pct={pct} height={5} />
      </div>

      {/* Subtasks */}
      {subs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="font-mono text-fame-slate" style={labelStyle}>{t('subtasks')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {subs.map(s => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isMember ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={!isMember}
                  onChange={e => onToggleSubtask(task.id, s.id, e.target.checked)}
                  className="accent-fame-teal"
                />
                <span className={s.done ? 'text-fame-text-muted' : 'text-fame-text-body'} style={{ fontSize: 13, textDecoration: s.done ? 'line-through' : 'none' }}>
                  {s.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Positioning */}
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono text-fame-slate" style={labelStyle}>{t('positioning')}</div>
        {task.assignees.length > 0 ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: isMember ? 8 : 0 }}>
            {task.assignees.map(a => (
              <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Avatar name={`${a.prenom} ${a.nom}`} photoUrl={a.photo_url} size={22} />
                <span className="text-fame-text-body" style={{ fontSize: 12 }}>{a.prenom}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="font-mono text-fame-text-muted" style={{  fontSize: 11, marginBottom: isMember ? 8 : 0 }}>
            {t('noAssignees')}
          </div>
        )}
        {isMember && (
          <button className="font-mono text-fame-blue"
            onClick={() => onClaim(task.id)}
            style={{
               fontSize: 10, background: 'none',
              border: '1px solid rgba(47,68,134,0.35)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >
            {claimedByMe ? t('unclaimTask') : t('claimTask')}
          </button>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <div>
          <div className="font-mono text-fame-slate" style={labelStyle}>{t('section.description')}</div>
          <p className="text-fame-text-body" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{task.description}</p>
        </div>
      )}
    </Modal>
  )
}
