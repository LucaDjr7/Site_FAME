import type { Locale2 } from '@/types'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const LANG_NAME: Record<Locale2, string> = { en: 'English', fr: 'French' }

export async function buildLabelI18n(
  label: string,
  sourceLocale: Locale2,
  deps: { provider?: ChatProvider; record?: (i: number, o: number) => Promise<void>; disabled?: boolean; overBudget?: boolean } = {},
): Promise<Partial<Record<Locale2, { label: string }>>> {
  const src = label.trim()
  if (!src) return {}
  const other: Locale2 = sourceLocale === 'en' ? 'fr' : 'en'
  if (deps.disabled || deps.overBudget) {
    return { [sourceLocale]: { label: src }, [other]: { label: src } }
  }
  const provider = deps.provider ?? getChatProvider()
  const system = `Translate the following short relationship label for an academic research graph into ${LANG_NAME[other]}. Keep it short (1–4 words). Keep acronyms/technical terms verbatim. Reply with ONLY the translated label, no quotes, no commentary.`
  try {
    const completion = await provider.complete(
      [{ role: 'system', content: system }, { role: 'user', content: src }],
      { maxTokens: 60 },
    )
    const out = (completion.content ?? '').trim()
    await (deps.record ?? recordUsage)(Math.ceil((system.length + src.length) / 4), Math.ceil(out.length / 4))
    return { [sourceLocale]: { label: src }, [other]: { label: out || src } }
  } catch (e) {
    console.error('buildLabelI18n: falling back to source', e instanceof Error ? e.message : e)
    return { [sourceLocale]: { label: src }, [other]: { label: src } }
  }
}
