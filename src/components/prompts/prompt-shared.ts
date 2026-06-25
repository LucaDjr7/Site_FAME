import type { PromptTarget } from '@/types'

/**
 * Maps each PromptTarget to its i18n key suffix and badge color.
 * i18nKey is used as: t(`types.${meta.i18nKey}`)
 * Shared across PromptCard and PromptLibrary.
 */
export const TARGET_META: Record<PromptTarget, { i18nKey: string; color: string }> = {
  subject:     { i18nKey: 'sujet',       color: '#2f4486' },
  publication: { i18nKey: 'publication', color: '#1e9b7e' },
  data:        { i18nKey: 'donnees',     color: '#0061ff' },
  member:      { i18nKey: 'membre',      color: '#28b8ce' },
  task:        { i18nKey: 'tache',       color: '#e8b149' },
}

/** Canonical display order for target type filters. */
export const TARGET_ORDER: PromptTarget[] = ['subject', 'publication', 'data', 'member', 'task']
