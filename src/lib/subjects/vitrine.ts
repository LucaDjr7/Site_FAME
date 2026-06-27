import type { Subject } from '@/types'

/** Gros titre : la question si présente, sinon le titre académique (fallback). */
export function vitrineHeadline(s: Pick<Subject, 'question' | 'titre'>): string {
  return s.question && s.question.trim() ? s.question : s.titre
}

/** Sous-titre italique : le titre académique, seulement si la question occupe le gros titre. */
export function vitrineSubtitle(s: Pick<Subject, 'question' | 'titre'>): string {
  return s.question && s.question.trim() ? s.titre : ''
}

/** Numéro d'index affiché (ordre 0 → "001"). */
export function vitrineNumber(ordre: number): string {
  return String(ordre + 1).padStart(3, '0')
}
