import type { Subject, Locale2, InheritableField } from '@/types'
import { INHERITABLE_FIELDS } from '@/types'
import { localizedSubject, type LocalizedSubject } from './localized'

export function isInheritableField(f: string): f is InheritableField {
  return (INHERITABLE_FIELDS as readonly string[]).includes(f)
}

export function normalizeAssocPair(a: string, b: string): { source_id: string; target_id: string } {
  return a < b ? { source_id: a, target_id: b } : { source_id: b, target_id: a }
}

/** edges = relations 'parent' existantes (source = mère, target = fille).
 *  Ajouter mother→child crée un cycle si child est déjà un ancêtre de mother. */
export function wouldCreateCycle(
  motherId: string, childId: string,
  parentEdges: { source_id: string; target_id: string }[],
): boolean {
  if (motherId === childId) return true
  // Remonter les ancêtres de mother (en suivant target→source) ; si on atteint child, cycle.
  const parentsOf = new Map<string, string[]>()
  for (const e of parentEdges) {
    const arr = parentsOf.get(e.target_id) ?? []
    arr.push(e.source_id)
    parentsOf.set(e.target_id, arr)
  }
  const stack = [motherId]
  const seen = new Set<string>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === childId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const p of parentsOf.get(cur) ?? []) stack.push(p)
  }
  return false
}

export function resolveInheritance(
  subject: Subject, byId: Map<string, Subject>, locale: Locale2,
  _seen: Set<string> = new Set(),
): LocalizedSubject {
  const own = localizedSubject(subject, locale)
  if (_seen.has(subject.id)) return own
  _seen.add(subject.id)

  const inh = subject.inherits ?? {}
  for (const field of Object.keys(inh)) {
    if (!isInheritableField(field)) continue
    const motherId = inh[field]
    if (!motherId) continue
    const mother = byId.get(motherId)
    if (!mother) continue // mère absente (visiteur/confidentiel) → garde la valeur propre
    // `_seen` doit être scopé au CHEMIN (anti-cycle), pas partagé entre les champs :
    // une copie par champ évite qu'un 2ᵉ champ hérité de la même mère court-circuite
    // la résolution (diamant / multi-champs).
    const mres = resolveInheritance(mother, byId, locale, new Set(_seen))
    ;(own as unknown as Record<string, unknown>)[field] = (mres as unknown as Record<string, unknown>)[field]
  }
  return own
}
