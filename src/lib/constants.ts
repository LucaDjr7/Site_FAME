import type { Lab } from '@/types'

export const VALID_LABS: Lab[] = ['paris', 'montreal']
export const LAB_LABELS: Record<Lab, string> = { paris: 'Paris', montreal: 'Montréal' }
export const FAME_PAGE_BG =
  'radial-gradient(110% 80% at 50% 0%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 55%), #F9F9FA'

// Research domains offered in the Propose form's dropdown.
// Stored verbatim as `proposals.domaine` (text). Labels are translated in the
// UI via the `domains.*` i18n namespace; these are the stable string values.
export const PROPOSAL_DOMAINS = [
  'macroeconomics',
  'microeconomics',
  'finance',
  'econometrics',
  'behavioral',
  'political-economy',
  'history',
  'other',
] as const

export type ProposalDomain = (typeof PROPOSAL_DOMAINS)[number]
