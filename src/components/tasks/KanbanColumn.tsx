'use client'
import { useTranslations } from 'next-intl'
import type { Subject, TaskWithRelations } from '@/types'
import { TaskCard } from './TaskCard'
import { SUBJECT_STATUS_COLOR } from './kanban-shared'

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
}

export function KanbanColumn({
  subject, tasks, isMember, currentMemberId, editMode, onOpenTask, onClaim, onDeleteTask, onAddTask,
}: Props) {
  const t = useTranslations('tasks')

  return (
    <div style={{ flexShrink: 0, width: 300, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px 14px', flexShrink: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: SUBJECT_STATUS_COLOR[subject.statut], flexShrink: 0 }} />
        <h3 style={{
          fontFamily: 'Roboto Slab, Georgia, serif', fontSize: 13, fontWeight: 600, color: '#15203f',
          margin: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {subject.titre}
        </h3>
        <span style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#5c678a', flexShrink: 0,
          background: 'rgba(20,40,90,0.08)', padding: '2px 8px', borderRadius: 20,
        }}>{tasks.length}</span>
      </div>

      {/* cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingBottom: 8 }}>
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
          <button
            onClick={() => onAddTask(subject.id)}
            style={{
              border: '1px dashed rgba(87,104,172,0.4)', borderRadius: 7, padding: 8, background: 'transparent',
              cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#5768ac', letterSpacing: '0.04em',
            }}
          >
            ＋ {t('addTask')}
          </button>
        )}
      </div>
    </div>
  )
}
