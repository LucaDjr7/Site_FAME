import type { Task, Subtask, Locale2 } from '@/types'

export function localizedTask(t: Task, locale: Locale2): { titre: string; description: string } {
  const tr = t.i18n?.[locale]
  return {
    titre: tr?.titre ?? t.titre,
    description: tr?.description ?? t.description,
  }
}

export function localizedSubtaskLabel(s: Pick<Subtask, 'label' | 'i18n'>, locale: Locale2): string {
  return s.i18n?.[locale]?.label ?? s.label
}
