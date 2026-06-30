'use client'
import { useTranslations, useLocale } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { DiffDots, DIFF_LEVEL, TASK_STATUS_COLOR, STATUS_KEY, ProgressBar, taskProgress } from './kanban-shared'
import { localizedTask } from '@/lib/tasks/localized'
import { toLocale2 } from '@/lib/subjects/localized'
import type { TaskWithRelations } from '@/types'

type Props = {
  task: TaskWithRelations
  isMember: boolean
  currentMemberId: string | null
  editMode: boolean
  onOpen: (task: TaskWithRelations) => void
  onClaim: (taskId: string) => void
  onDelete: (taskId: string) => void
}

export function TaskCard({ task, isMember, currentMemberId, editMode, onOpen, onClaim, onDelete }: Props) {
  const t = useTranslations('tasks')
  const locale = useLocale()
  const pct = taskProgress(task)
  const claimedByMe = !!currentMemberId && task.assignees.some(a => a.id === currentMemberId)

  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      style={{
        background: '#fbf8f1',
        borderRadius: 13,
        padding: 14,
        cursor: 'pointer',
        boxShadow: '0 8px 20px -12px rgba(20,40,90,0.32)',
        border: '1px solid rgba(20,40,90,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        position: 'relative',
        width: '100%',
        textAlign: 'left',
      }}
    >
      {/* status + difficulty */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: TASK_STATUS_COLOR[task.statut] }} />
          <span className="font-mono" style={{
             fontSize: 9, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: TASK_STATUS_COLOR[task.statut],
          }}>
            {t(`status.${STATUS_KEY[task.statut]}`)}
          </span>
        </span>
        <DiffDots level={DIFF_LEVEL[task.difficulte] ?? 0} />
      </div>

      {/* title */}
      <p className="font-serif" style={{  fontSize: 13, fontWeight: 500, color: '#18244c', margin: 0, lineHeight: 1.32 }}>
        {localizedTask(task, toLocale2(locale)).titre}
      </p>

      {/* progress */}
      <ProgressBar pct={pct} height={3} />

      {/* assignees + claim */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ display: 'flex', gap: 3 }}>
          {task.assignees.map(a => (
            <Avatar key={a.id} name={`${a.prenom} ${a.nom}`} photoUrl={a.photo_url} size={20} />
          ))}
        </span>
        {isMember && !claimedByMe && (
          <button className="font-mono text-fame-blue"
            onClick={e => { e.stopPropagation(); onClaim(task.id) }}
            style={{
               fontSize: 9,
              background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap',
            }}
          >
            ＋ {t('claimTask')}
          </button>
        )}
      </div>

      {/* delete (edit mode, member) */}
      {isMember && editMode && (
        <button className="bg-fame-red text-white"
          onClick={e => { e.stopPropagation(); onDelete(task.id) }}
          aria-label={t('delete.confirm')}
          style={{
            position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: '50%',
            border: 'none', fontSize: 11, lineHeight: '18px',
            cursor: 'pointer', padding: 0,
          }}
        >
          ×
        </button>
      )}
    </button>
  )
}
