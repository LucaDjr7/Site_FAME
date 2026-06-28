import type { Subject, Lab } from '@/types'

export type AssistField =
  | 'question' | 'titre' | 'accroche' | 'kicker' | 'keywords'
  | 'context' | 'method' | 'results'
  | 'dimensions.method' | 'dimensions.data' | 'dimensions.theory' | 'dimensions.writing'

export const ASSIST_FIELDS: AssistField[] = [
  'question', 'titre', 'accroche', 'kicker', 'keywords', 'context', 'method', 'results',
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
  keywords: {
    en: 'Write 3 to 5 short keyword tags describing this subject, separated by commas. No numbering, no sentences — just the tags.',
    fr: 'Écris 3 à 5 mots-clés courts décrivant ce sujet, séparés par des virgules. Pas de numérotation, pas de phrases — juste les tags.',
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
    [fr ? 'Contexte' : 'Context', draft.context],
    [fr ? 'Méthode' : 'Method', draft.method],
    [fr ? 'Résultats' : 'Results', draft.results],
    [fr ? 'Mots-clés' : 'Keywords', draft.keywords?.length ? draft.keywords.join(', ') : undefined],
  ]
  const lines = rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (lines.length === 0) return fr ? '(aucune information saisie pour le moment)' : '(no information entered yet)'
  return lines.join('\n')
}

export function buildFieldPrompt(field: AssistField, draft: FieldDraft, locale: Locale, context?: string): FieldPrompt {
  const fr = locale === 'fr'
  const system = fr
    ? "Tu es un assistant de redaction scientifique pour un laboratoire de recherche (finance, economie, IA). Ecris dans un francais idiomatique, mais garde tels quels les termes que les chercheurs laissent en l'etat : sigles/acronymes (LLM, LLMs, NLP, GPT, RAG, API, ML...), termes techniques anglais usuels (machine learning, embedding, transformer, dataset, benchmark, prompt...), noms propres, produits, modeles, jeux de donnees, code, symboles et unites. Ne traduis pas et n'explicite pas ces termes. Reponds uniquement avec le texte demande : pas de guillemets, pas de preambule, pas d'explication."
    : 'You are a scientific writing assistant for a research lab (finance, economics, AI). Write idiomatically, but keep verbatim the terms researchers leave as-is: acronyms/initialisms (LLM, LLMs, NLP, GPT, RAG, API, ML...), established English technical terms (machine learning, embedding, transformer, dataset, benchmark, prompt...), proper nouns, products, models, datasets, code, symbols and units. Do not translate or expand these terms. Reply with only the requested text: no quotes, no preamble, no explanation.'
  const ctxLabel = fr ? 'Informations du sujet' : 'Subject information'
  let user = `${INSTRUCTIONS[field][locale]}\n\n${ctxLabel} :\n${draftContext(draft, locale)}`
  if (context && context.trim()) {
    const docLabel = fr ? 'Extraits des documents joints (utilise-les si pertinents)' : 'Excerpts from attached documents (use if relevant)'
    user += `\n\n${docLabel} :\n${context.trim().slice(0, 3000)}`
  }
  return { system, user, displayPrompt: user }
}
