import type { SubjectStatus, TaskStatus, ProposalStatus } from '@/types'

const SUBJECT_COLORS: Record<SubjectStatus, string> = {
  'active':  'bg-fame-teal text-white',
  'done':    'bg-fame-blue text-white',
  'on-hold': 'bg-fame-gold text-white',
}

const TASK_COLORS: Record<TaskStatus, string> = {
  'to-do':      'bg-fame-ecru text-fame-blue-dark',
  'in-progress': 'bg-fame-slate text-white',
  'done':        'bg-fame-teal text-white',
}

export function SubjectStatusBadge({ status, label }: { status: SubjectStatus; label: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-widest ${SUBJECT_COLORS[status]}`}>
      {label}
    </span>
  )
}

export function TaskStatusBadge({ status, label }: { status: TaskStatus; label: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-widest ${TASK_COLORS[status]}`}>
      {label}
    </span>
  )
}

const PROPOSAL_COLORS: Record<ProposalStatus, string> = {
  'pending':  'bg-fame-gold text-white',
  'accepted': 'bg-fame-teal text-white',
  'rejected': 'bg-fame-red text-white',
}

export function ProposalStatusBadge({ status, label }: { status: ProposalStatus; label: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-widest ${PROPOSAL_COLORS[status]}`}>
      {label}
    </span>
  )
}
