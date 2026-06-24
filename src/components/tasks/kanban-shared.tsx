import type { TaskWithRelations, MemberRef, TaskStatus } from '@/types'

export const TASK_STATUS_COLOR: Record<string, string> = {
  'to-do': '#5768ac',
  'in-progress': '#e8b149',
  done: '#1e9b7e',
}

export const SUBJECT_STATUS_COLOR: Record<string, string> = {
  active: '#1e9b7e',
  'on-hold': '#e8b149',
  done: '#2f4486',
}

export const DIFF_LEVEL: Record<string, number> = {
  easy: 1,
  intermediate: 2,
  advanced: 3,
}

// status enum value → i18n key suffix (status.todo / status.inProgress / status.done)
export const STATUS_KEY: Record<TaskStatus, string> = {
  'to-do': 'todo',
  'in-progress': 'inProgress',
  done: 'done',
}

const DIFF_COLOR = '#15203f'
const DIFF_FAINT = 'rgba(120,140,190,0.28)'

export function DiffDots({ level }: { level: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2.5, alignItems: 'center' }}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          style={{ display: 'inline-block', width: 5, height: 5, background: i <= level ? DIFF_COLOR : DIFF_FAINT }}
        />
      ))}
    </span>
  )
}

// Progress derived from subtasks (NO stored prog column).
export function taskProgress(task: TaskWithRelations): number {
  const subs = task.subtasks ?? []
  if (subs.length === 0) return task.statut === 'done' ? 100 : 0
  return Math.round((subs.filter(s => s.done).length / subs.length) * 100)
}

export function ProgressBar({ pct, height = 4 }: { pct: number; height?: number }) {
  return (
    <div style={{ width: '100%', height, borderRadius: height, background: 'rgba(87,104,172,0.18)', overflow: 'hidden' }}>
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: height,
          background: 'linear-gradient(90deg,#5670be,#2f4486,#151e3c)',
          transition: 'width 0.2s',
        }}
      />
    </div>
  )
}

// Flatten GET /api/tasks rows (task_assignees(members)) → assignees: MemberRef[]
// Mirrors the flatten in app/[locale]/[lab]/paper/[id]/page.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenTasks(raw: any[]): TaskWithRelations[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (raw ?? []).map((t: any) => {
    const ta = (t.task_assignees as { members: MemberRef | null }[] | null) ?? []
    const assignees = ta.map(a => a.members).filter((m): m is MemberRef => !!m)
    const { task_assignees, ...rest } = t
    void task_assignees
    return { ...rest, assignees, subtasks: t.subtasks ?? [] } as TaskWithRelations
  })
}
