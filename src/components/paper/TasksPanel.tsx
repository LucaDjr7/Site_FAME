'use client'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import type { TaskWithRelations, TaskStatus } from '@/types'

const STATUS_KEY: Record<TaskStatus, 'todo' | 'inProgress' | 'done'> = {
  'to-do': 'todo', 'in-progress': 'inProgress', done: 'done',
}

type Props = {
  tasks: TaskWithRelations[]
  isMember: boolean
  open: boolean
  onToggleOpen: () => void
  doneCount: number
  total: number
  onToggleTask: (taskId: string, nextDone: boolean) => void
}

export function TasksPanel({ tasks, isMember, open, onToggleOpen, doneCount, total, onToggleTask }: Props) {
  const t = useTranslations('paper')
  const tt = useTranslations('tasks')

  return (
    <section style={{
      position: 'absolute', left: 14, top: 118, width: 300, pointerEvents: 'auto',
      background: '#2f4486', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(150,180,255,0.18)', borderRadius: 14,
      boxShadow: '0 22px 60px -18px rgba(0,5,30,0.75)', overflow: 'hidden',
    }}>
      <button onClick={onToggleOpen} className="text-fame-text-light" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#5b7cf0' }} />{t('linkedTasks')}
        </span>
        <span className="font-mono text-fame-text-muted" style={{  fontSize: 11 }}>{doneCount}/{total} {open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="fame-scroll" style={{ maxHeight: 'min(60vh, 520px)', overflowY: 'auto', padding: '2px 12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {tasks.map(task => {
            const done = task.statut === 'done'
            const assignee = task.assignees[0]
            return (
              <button
                key={task.id}
                onClick={isMember ? () => onToggleTask(task.id, !done) : undefined}
                disabled={!isMember}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 11px', borderRadius: 10,
                  cursor: isMember ? 'pointer' : 'default', textAlign: 'left',
                  border: `1px solid ${done ? 'rgba(76,210,160,0.3)' : 'rgba(150,180,255,0.12)'}`,
                  background: done ? 'rgba(76,210,160,0.1)' : 'rgba(31,46,92,0.5)', transition: 'all .15s ease',
                }}
              >
                <span className={done ? 'bg-fame-teal border-fame-teal' : ''}
                  style={{
                  flex: 'none', marginTop: 1, width: 16, height: 16, borderRadius: 5,
                  border: done ? '1.5px solid' : '1.5px solid rgba(150,180,255,0.4)',
                  background: done ? undefined : 'transparent', color: '#06112e', fontSize: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{done ? '✓' : ''}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12.5, lineHeight: 1.35, color: done ? 'rgba(239,243,255,0.65)' : '#dfe7fb', textDecoration: done ? 'line-through' : 'none' }}>{task.titre}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    {assignee && <Avatar name={`${assignee.prenom} ${assignee.nom}`} photoUrl={assignee.photo_url} size={16} />}
                    <span className="font-mono text-fame-text-muted" style={{  fontSize: 9 }}>{tt(`status.${STATUS_KEY[task.statut]}`)}</span>
                  </span>
                </span>
              </button>
            )
          })}
          {tasks.length === 0 && <p className="font-mono text-fame-text-muted" style={{  fontSize: 11, padding: '6px 2px' }}>{t('noTasks')}</p>}
        </div>
      )}
    </section>
  )
}
