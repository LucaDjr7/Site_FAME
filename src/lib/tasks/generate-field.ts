import { buildTaskFieldPrompt, type TaskAssistField, type TaskFieldDraft } from './field-prompts'
import type { Locale2 } from '@/types'
import { getChatProvider, type ChatProvider } from '@/lib/llm'
import { recordUsage } from '@/lib/rag/usage'

const MAX_OUT = 220

export interface GenerateTaskDeps {
  provider?: ChatProvider
  record?: (tokensIn: number, tokensOut: number) => Promise<void>
}

export async function generateTaskField(
  field: TaskAssistField,
  draft: TaskFieldDraft,
  locale: Locale2,
  deps: GenerateTaskDeps = {},
  context?: string,
): Promise<string> {
  const { system, user } = buildTaskFieldPrompt(field, draft, locale, context)
  const provider = deps.provider ?? getChatProvider()
  const completion = await provider.complete(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { maxTokens: MAX_OUT },
  )
  const text = (completion.content ?? '').trim()
  const tokensIn = Math.ceil((system.length + user.length) / 4)
  const tokensOut = Math.ceil(text.length / 4)
  await (deps.record ?? recordUsage)(tokensIn, tokensOut)
  return text
}
