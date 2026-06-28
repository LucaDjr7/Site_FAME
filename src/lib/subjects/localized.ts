import type { Subject, Locale2 } from '@/types'
import { DOMAIN_OPTIONS } from './domains'

export function toLocale2(locale: string): Locale2 {
  return locale === 'fr' ? 'fr' : 'en'
}

export interface LocalizedSubject {
  titre: string
  question: string
  accroche: string
  context: string
  method: string
  results: string
  keywords: string[]
  dimensions: Subject['dimensions']
  kicker: string
}

function localizedKicker(kicker: string, locale: Locale2): string {
  if (!kicker) return kicker
  for (const src of ['en', 'fr'] as Locale2[]) {
    const idx = DOMAIN_OPTIONS[src].indexOf(kicker)
    if (idx !== -1) return DOMAIN_OPTIONS[locale][idx] ?? kicker
  }
  return kicker
}

export function localizedSubject(s: Subject, locale: Locale2): LocalizedSubject {
  const t = s.i18n?.[locale]
  return {
    titre: t?.titre ?? s.titre,
    question: t?.question ?? s.question,
    accroche: t?.accroche ?? s.accroche,
    context: t?.context ?? s.context,
    method: t?.method ?? s.method,
    results: t?.results ?? s.results,
    keywords: t?.keywords ?? s.keywords,
    dimensions: t?.dimensions ?? s.dimensions,
    kicker: localizedKicker(s.kicker, locale),
  }
}

export function subjectSearchText(s: Subject): string {
  const parts: string[] = [s.titre, s.question]
  for (const loc of ['en', 'fr'] as Locale2[]) {
    const t = s.i18n?.[loc]
    if (t?.titre) parts.push(t.titre)
    if (t?.question) parts.push(t.question)
  }
  return parts.join(' ').toLowerCase()
}
