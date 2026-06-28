import { buildFieldPrompt, type AssistField, type FieldDraft, type Locale } from './field-prompts'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const MAX_OUT = 220

export interface GenerateDeps {
  provider?: ChatProvider
  record?: (tokensIn: number, tokensOut: number) => Promise<void>
}

export async function generateField(
  field: AssistField,
  draft: FieldDraft,
  locale: Locale,
  deps: GenerateDeps = {},
): Promise<string> {
  const { system, user } = buildFieldPrompt(field, draft, locale)
  const provider = deps.provider ?? getChatProvider()
  const completion = await provider.complete(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens: MAX_OUT },
  )
  const text = (completion.content ?? '').trim()
  // Estimation grossière de tokens (le provider ne renvoie pas l'usage ici) : ~4 chars/token.
  const tokensIn = Math.ceil((system.length + user.length) / 4)
  const tokensOut = Math.ceil(text.length / 4)
  await (deps.record ?? recordUsage)(tokensIn, tokensOut)
  return text
}
