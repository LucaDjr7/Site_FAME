import type { Lab, Locale2 } from '@/types'

export type TaskAssistField = 'titre' | 'description' | 'subtask'
export const TASK_ASSIST_FIELDS: TaskAssistField[] = ['titre', 'description', 'subtask']
export function isTaskAssistField(v: unknown): v is TaskAssistField {
  return typeof v === 'string' && (TASK_ASSIST_FIELDS as string[]).includes(v)
}


export type TaskFieldDraft = {
  titre?: string
  description?: string
  subtask?: string
  subjectTitre?: string
  labo?: Lab
}

export interface TaskFieldPrompt {
  system: string
  user: string
  displayPrompt: string
}

const INSTRUCTIONS: Record<TaskAssistField, { en: string; fr: string }> = {
  titre: {
    en: 'Write a short, action-oriented task title (one line, imperative mood, max ~10 words).',
    fr: "Écris un titre de tâche court et orienté action (une ligne, à l'impératif, max ~10 mots).",
  },
  description: {
    en: 'Write a concise task description (2-4 sentences): what to do, expected outcome, and any constraint. No preamble.',
    fr: 'Écris une description de tâche concise (2 à 4 phrases) : quoi faire, résultat attendu, et toute contrainte. Pas de préambule.',
  },
  subtask: {
    en: 'Write a single short sub-task label (one line, imperative, max ~10 words). Just the label.',
    fr: "Écris un seul libellé de sous-tâche court (une ligne, à l'impératif, max ~10 mots). Juste le libellé.",
  },
}

function draftContext(draft: TaskFieldDraft, locale: Locale2): string {
  const fr = locale === 'fr'
  const rows: Array<[string, string | undefined]> = [
    [fr ? 'Sujet de recherche' : 'Research subject', draft.subjectTitre],
    [fr ? 'Titre de la tâche' : 'Task title', draft.titre],
    [fr ? 'Description' : 'Description', draft.description],
    [fr ? 'Sous-tâche en cours' : 'Current sub-task', draft.subtask],
  ]
  const lines = rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`)
  if (lines.length === 0) return fr ? '(aucune information saisie pour le moment)' : '(no information entered yet)'
  return lines.join('\n')
}

export function buildTaskFieldPrompt(field: TaskAssistField, draft: TaskFieldDraft, locale: Locale2, context?: string): TaskFieldPrompt {
  const fr = locale === 'fr'
  const system = fr
    ? "Tu es un assistant de gestion de projet pour un laboratoire de recherche (finance, économie, IA). Écris dans un français idiomatique, mais garde tels quels les termes que les chercheurs laissent en l'état : sigles/acronymes (LLM, LLMs, NLP, GPT, RAG, API, ML…), termes techniques anglais usuels (machine learning, embedding, transformer, dataset, benchmark, prompt…), noms propres, produits, modèles, jeux de données, code, symboles et unités. Ne traduis pas et n'explicite pas ces termes. Réponds uniquement avec le texte demandé : pas de guillemets, pas de préambule, pas d'explication."
    : 'You are a project-management assistant for a research lab (finance, economics, AI). Write idiomatically, but keep verbatim the terms researchers leave as-is: acronyms/initialisms (LLM, LLMs, NLP, GPT, RAG, API, ML…), established English technical terms (machine learning, embedding, transformer, dataset, benchmark, prompt…), proper nouns, products, models, datasets, code, symbols and units. Do not translate or expand these terms. Reply with only the requested text: no quotes, no preamble, no explanation.'
  const ctxLabel = fr ? 'Informations de la tâche' : 'Task information'
  let user = `${INSTRUCTIONS[field][locale]}\n\n${ctxLabel} :\n${draftContext(draft, locale)}`
  if (context && context.trim()) {
    const docLabel = fr ? 'Extraits des documents du sujet (utilise-les si pertinents)' : 'Excerpts from subject documents (use if relevant)'
    user += `\n\n${docLabel} :\n${context.trim().slice(0, 3000)}`
  }
  return { system, user, displayPrompt: user }
}
