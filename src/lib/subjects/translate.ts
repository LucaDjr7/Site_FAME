import type { SubjectI18nFields, Locale2, SubjectI18n } from '@/types'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const LANG_NAME: Record<Locale2, string> = { en: 'English', fr: 'French' }
const MAX_OUT = 2000

export interface TranslateDeps {
  provider?: ChatProvider
  record?: (tokensIn: number, tokensOut: number) => Promise<void>
}

function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

function mergeFields(src: SubjectI18nFields, p: Partial<SubjectI18nFields>): SubjectI18nFields {
  const d = p.dimensions
  return {
    titre: typeof p.titre === 'string' ? p.titre : src.titre,
    question: typeof p.question === 'string' ? p.question : src.question,
    accroche: typeof p.accroche === 'string' ? p.accroche : src.accroche,
    context: typeof p.context === 'string' ? p.context : src.context,
    method: typeof p.method === 'string' ? p.method : src.method,
    results: typeof p.results === 'string' ? p.results : src.results,
    keywords: Array.isArray(p.keywords) ? p.keywords.map(String) : src.keywords,
    dimensions: d && typeof d === 'object' ? {
      method: typeof d.method === 'string' ? d.method : src.dimensions.method,
      data: typeof d.data === 'string' ? d.data : src.dimensions.data,
      theory: typeof d.theory === 'string' ? d.theory : src.dimensions.theory,
      writing: typeof d.writing === 'string' ? d.writing : src.dimensions.writing,
    } : src.dimensions,
  }
}

export async function translateSubjectFields(
  src: SubjectI18nFields,
  to: Locale2,
  deps: TranslateDeps = {},
): Promise<SubjectI18nFields> {
  const provider = deps.provider ?? getChatProvider()
  const system = `You are a professional translator for an academic research lab (finance, economics, and AI). Translate every value of the given JSON object into ${LANG_NAME[to]}.

Translate idiomatically, NOT word-for-word: the result must read as if originally written by a researcher in ${LANG_NAME[to]}.

Keep VERBATIM (do not translate) any term that researchers in ${LANG_NAME[to]} conventionally leave in its original form:
- acronyms and initialisms — e.g. LLM, LLMs, NLP, GPT, RAG, API, ML, GDP, VAR (keep exactly as written, including plural "s");
- established English technical terms commonly used as-is in the field — e.g. machine learning, deep learning, embedding, transformer, benchmark, dataset, prompt;
- proper nouns, brand / product / model / library / dataset names, code, tickers, math symbols, numbers and units.
Do not expand or "explain" these terms — leave them as they are.

For "keywords", translate only those that have a natural, commonly-used equivalent in ${LANG_NAME[to]}; leave technical terms and acronyms unchanged. If a whole value is already in ${LANG_NAME[to]}, return it unchanged. Keep "keywords" an array of strings and "dimensions" an object with the same keys. Reply with ONLY a JSON object with exactly the same keys — no markdown, no commentary.`
  const user = JSON.stringify(src)
  try {
    const completion = await provider.complete(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { maxTokens: MAX_OUT },
    )
    const out = (completion.content ?? '').trim()
    const parsed = JSON.parse(stripFences(out)) as Partial<SubjectI18nFields>
    const tokensIn = Math.ceil((system.length + user.length) / 4)
    const tokensOut = Math.ceil(out.length / 4)
    await (deps.record ?? recordUsage)(tokensIn, tokensOut)
    return mergeFields(src, parsed)
  } catch (e) {
    console.error('translateSubjectFields: falling back to source', e instanceof Error ? e.message : e)
    return src
  }
}

export async function buildSubjectI18n(
  src: SubjectI18nFields,
  sourceLocale: Locale2,
  deps: TranslateDeps & { disabled?: boolean; overBudget?: boolean } = {},
): Promise<SubjectI18n> {
  const other: Locale2 = sourceLocale === 'en' ? 'fr' : 'en'
  if (deps.disabled || deps.overBudget) {
    return { [sourceLocale]: src, [other]: src } as SubjectI18n
  }
  const translated = await translateSubjectFields(src, other, deps)
  return { [sourceLocale]: src, [other]: translated } as SubjectI18n
}
