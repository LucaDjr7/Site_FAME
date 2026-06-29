import type { TaskI18nFields, Locale2, TaskI18n } from '@/types'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const LANG_NAME: Record<Locale2, string> = { en: 'English', fr: 'French' }
const MAX_OUT = 1200

export interface TranslateTaskDeps {
  provider?: ChatProvider
  record?: (tokensIn: number, tokensOut: number) => Promise<void>
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

function mergeFields(src: TaskI18nFields, p: Partial<TaskI18nFields>): TaskI18nFields {
  return {
    titre: typeof p.titre === 'string' ? p.titre : src.titre,
    description: typeof p.description === 'string' ? p.description : src.description,
    subtasks: Array.isArray(p.subtasks) && p.subtasks.length === src.subtasks.length
      ? p.subtasks.map(String)
      : src.subtasks,
  }
}

export async function translateTaskFields(
  src: TaskI18nFields,
  to: Locale2,
  deps: TranslateTaskDeps = {},
): Promise<TaskI18nFields> {
  const provider = deps.provider ?? getChatProvider()
  const system = `You are a professional translator for an academic research lab (finance, economics, and AI). Translate every value of the given JSON object into ${LANG_NAME[to]}.

Translate idiomatically, NOT word-for-word: the result must read as if originally written by a researcher in ${LANG_NAME[to]}.

Keep VERBATIM (do not translate) any term that researchers in ${LANG_NAME[to]} conventionally leave in its original form: acronyms and initialisms (LLM, NLP, GPT, RAG, API, ML…), established English technical terms used as-is (machine learning, embedding, transformer, benchmark, dataset, prompt), proper nouns, product/model/library/dataset names, code, tickers, math symbols, numbers and units. Do not expand or explain these terms.

Keep "subtasks" an array of strings with EXACTLY the same length and order. If a whole value is already in ${LANG_NAME[to]}, return it unchanged. Reply with ONLY a JSON object with exactly the same keys — no markdown, no commentary.`
  const user = JSON.stringify(src)
  try {
    const completion = await provider.complete(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { maxTokens: MAX_OUT },
    )
    const out = (completion.content ?? '').trim()
    const parsed = JSON.parse(stripFences(out)) as Partial<TaskI18nFields>
    const tokensIn = Math.ceil((system.length + user.length) / 4)
    const tokensOut = Math.ceil(out.length / 4)
    await (deps.record ?? recordUsage)(tokensIn, tokensOut)
    return mergeFields(src, parsed)
  } catch (e) {
    console.error('translateTaskFields: falling back to source', e instanceof Error ? e.message : e)
    return src
  }
}

export async function buildTaskI18n(
  src: TaskI18nFields,
  sourceLocale: Locale2,
  deps: TranslateTaskDeps & { disabled?: boolean; overBudget?: boolean } = {},
): Promise<TaskI18n> {
  const other: Locale2 = sourceLocale === 'en' ? 'fr' : 'en'
  if (deps.disabled || deps.overBudget) {
    return { [sourceLocale]: src, [other]: src } as TaskI18n
  }
  const translated = await translateTaskFields(src, other, deps)
  return { [sourceLocale]: src, [other]: translated } as TaskI18n
}
