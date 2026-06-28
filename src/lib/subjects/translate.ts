import type { SubjectI18nFields, Locale2, SubjectI18n } from '@/types'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const LANG_NAME: Record<Locale2, string> = { en: 'English', fr: 'French' }
const MAX_OUT = 900

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
  const system = `You are a professional translator for an academic research lab website. Translate every value of the given JSON object into ${LANG_NAME[to]}. Preserve meaning and technical terminology. If a value is already in ${LANG_NAME[to]}, return it unchanged. Keep "keywords" an array of strings and "dimensions" an object with the same keys. Reply with ONLY a JSON object with exactly the same keys — no markdown, no commentary.`
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
  } catch {
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
