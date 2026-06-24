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
