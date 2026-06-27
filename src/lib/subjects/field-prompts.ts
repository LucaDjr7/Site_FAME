import type { Subject, Lab } from '@/types'

export type AssistField =
  | 'question' | 'titre' | 'accroche' | 'kicker'
  | 'context' | 'method' | 'results'
  | 'dimensions.method' | 'dimensions.data' | 'dimensions.theory' | 'dimensions.writing'

export const ASSIST_FIELDS: AssistField[] = [
  'question', 'titre', 'accroche', 'kicker', 'context', 'method', 'results',
  'dimensions.method', 'dimensions.data', 'dimensions.theory', 'dimensions.writing',
]

export function isAssistField(v: unknown): v is AssistField {
  return typeof v === 'string' && (ASSIST_FIELDS as string[]).includes(v)
}

export type Locale = 'en' | 'fr'

export type FieldDraft = Partial<Pick<Subject,
  'question' | 'titre' | 'accroche' | 'kicker' | 'context' | 'method' | 'results' | 'keywords'>>
  & { labo?: Lab }

export interface FieldPrompt {
  system: string
  user: string
  displayPrompt: string
}

const INSTRUCTIONS: Record<AssistField, { en: string; fr: string }> = {
  question: {
    en: 'Write a short, striking research question to use as a poster headline (max ~6 words, two fragments allowed). It should hook a curious reader.',
    fr: "Écris une question de recherche courte et frappante, en tête d'affiche (max ~6 mots, deux fragments possibles). Elle doit accrocher un lecteur curieux.",
  },
  titre: {
    en: 'Write a precise academic title for this research subject (one line, formal register).',
    fr: 'Écris un titre académique précis pour ce sujet de recherche (une ligne, registre formel).',
  },
  accroche: {
    en: 'Write a single accessible sentence (max ~20 words) conveying why this subject matters.',
    fr: 'Écris une seule phrase accessible (max ~20 mots) qui dit pourquoi ce sujet compte.',
  },
  kicker: {
    en: 'Write a short domain label of the form "Research · Field A & Field B" (max ~5 words).',
    fr: 'Écris un court intitulé de domaine de la forme « Recherche · Domaine A & Domaine B » (max ~5 mots).',
  },
  context: {
    en: 'Write a concise context paragraph (3-5 sentences) framing the problem and motivation.',
    fr: 'Écris un paragraphe de contexte concis (3 à 5 phrases) posant le problème et la motivation.',
  },
  method: {
    en: 'Write a concise paragraph describing the proposed method or approach.',
    fr: "Écris un paragraphe concis décrivant la méthode ou l'approche proposée.",
  },
  results: {
    en: 'Write a concise paragraph describing expected results or contributions.',
    fr: 'Écris un paragraphe concis décrivant les résultats ou contributions attendus.',
  },
  'dimensions.method': {
    en: 'Write a one-line note on the methodological dimension of this subject.',
    fr: 'Écris une note d’une ligne sur la dimension méthodologique de ce sujet.',
  },
  'dimensions.data': {
    en: 'Write a one-line note on the data dimension (sources, scale) of this subject.',
    fr: 'Écris une note d’une ligne sur la dimension données (sources, échelle) de ce sujet.',
  },
  'dimensions.theory': {
    en: 'Write a one-line note on the theoretical dimension of this subject.',
    fr: 'Écris une note d’une ligne sur la dimension théorique de ce sujet.',
  },
  'dimensions.writing': {
    en: 'Write a one-line note on the writing/output dimension (paper, report) of this subject.',
    fr: 'Écris une note d’une ligne sur la dimension rédaction/livrable (article, rapport) de ce sujet.',
  },
}

function draftContext(draft: FieldDraft, locale: Locale): string {
  const fr = locale === 'fr'
  const rows: Array<[string, string | undefined]> = [
    [fr ? 'Domaine' : 'Domain', draft.kicker],
    [fr ? 'Titre académique' : 'Academic title', draft.titre],
    [fr ? 'Question' : 'Question', draft.question],
    [fr ? 'Accroche' : 'Hook', draft.accroche],
    ['Context', draft.context],
    ['Method', draft.method],
    ['Results', draft.results],
    [fr ? 'Mots-clés' : 'Keywords', draft.keywords?.length ? draft.keywords.join(', ') : undefined],
  ]
  const lines = rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (lines.length === 0) return fr ? '(aucune information saisie pour le moment)' : '(no information entered yet)'
  return lines.join('\n')
}

export function buildFieldPrompt(field: AssistField, draft: FieldDraft, locale: Locale): FieldPrompt {
  const fr = locale === 'fr'
  const system = fr
    ? "Tu es un assistant de rédaction scientifique pour un laboratoire de recherche. Réponds uniquement avec le texte demandé : pas de guillemets, pas de préambule, pas d'explication."
    : 'You are a scientific writing assistant for a research lab. Reply with only the requested text: no quotes, no preamble, no explanation.'
  const ctxLabel = fr ? 'Informations du sujet' : 'Subject information'
  const user = `${INSTRUCTIONS[field][locale]}\n\n${ctxLabel} :\n${draftContext(draft, locale)}`
  return { system, user, displayPrompt: user }
}
