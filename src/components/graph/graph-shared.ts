import type { SubjectStatus, Lab } from '@/types'

/** Node fill color by subject status — mirrors SUBJECT_STATUS_COLOR in kanban-shared */
export const NODE_STATUS_COLOR: Record<SubjectStatus, string> = {
  active: '#1e9b7e',    // fame-teal
  'on-hold': '#e8b149', // fame-gold
  done: '#2f4486',       // fame-blue
}

/** Node stroke color by lab */
export const LAB_STROKE: Record<Lab, string> = {
  paris: '#e8b149',    // gold — Paris
  montreal: '#5768ac', // slate — Montréal
}
