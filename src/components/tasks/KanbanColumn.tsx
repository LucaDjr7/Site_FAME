'use client'
import { useTranslations, useLocale } from 'next-intl'
import type { Subject, TaskWithRelations } from '@/types'
import { TaskCard } from './TaskCard'
import { SUBJECT_STATUS_COLOR } from './kanban-shared'
import { localizedSubject, toLocale2 } from '@/lib/subjects/localized'

type Props = {
  subject: Subject
  tasks: TaskWithRelations[]
  isMember: boolean
  currentMemberId: string | null
  editMode: boolean
  onOpenTask: (t: TaskWithRelations) => void
  onClaim: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onAddTask: (subjectId: string) => void
  onRemoveSubject: (subjectId: string) => void
}

export function KanbanColumn({
  subject, tasks, isMember, currentMemberId, editMode, onOpenTask, onClaim, onDeleteTask, onAddTask, onRemoveSubject,
}: Props) {
  const t = useTranslations('tasks')
  const locale = useLocale()

  return (
    <div style={{ flexShrink: 0, width: 300, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px 14px', flexShrink: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: SUBJECT_STATUS_COLOR[subject.statut], flexShrink: 0 }} />
        <h3 className="font-serif text-fame-text-dark" style={{
           fontSize: 13, fontWeight: 600,
          margin: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {localizedSubject(subject, toLocale2(locale)).titre}
        </h3>
        <span className="font-mono" style={{
           fontSize: 11, color: '#5c678a', flexShrink: 0,
          background: 'rgba(20,40,90,0.08)', padding: '2px 8px', borderRadius: 20,
        }}>{tasks.length}</span>
      </div>

      {/* remove from board (edit mode, member) */}
      {isMember && editMode && (
        <button className="bg-fame-red text-white"
          onClick={() => onRemoveSubject(subject.id)}
          aria-label={t('removeSubject')}
          title={t('removeSubject')}
          style={{
            position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: '50%',
            border: 'none', fontSize: 11, lineHeight: '18px',
            cursor: 'pointer', padding: 0,
          }}
        >
          ×
        </button>
      )}

      {/* cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', padding: 8 }}>
        {tasks.map(tk => (
          <TaskCard
            key={tk.id}
            task={tk}
            isMember={isMember}
            currentMemberId={currentMemberId}
            editMode={editMode}
            onOpen={onOpenTask}
            onClaim={onClaim}
            onDelete={onDeleteTask}
          />
        ))}
        {isMember && (
          <button className="font-mono text-fame-slate"
            onClick={() => onAddTask(subject.id)}
            style={{
              border: '1px dashed rgba(87,104,172,0.4)', borderRadius: 7, padding: 8, background: 'transparent',
              cursor: 'pointer',  fontSize: 10, letterSpacing: '0.04em',
            }}
          >
            ＋ {t('addTask')}
          </button>
        )}
      </div>
    </div>
  )
}
