import { describe, it, expect } from 'vitest'
import { resolveInheritance, isInheritableField, normalizeAssocPair, wouldCreateCycle } from './inheritance'
import type { Subject } from '@/types'

function mk(over: Partial<Subject>): Subject {
  return {
    id: 'x', labo: 'paris', titre: '', kicker: '', question: '', accroche: '', periode: '',
    statut: 'active', context: '', method: '', results: '', keywords: [], auteurs: [],
    difficulte: 'intermediate', dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre: 0, is_transversal: false, confidentiel: false, i18n: {}, inherits: {},
    created_at: '', updated_at: '', ...over,
  }
}

describe('resolveInheritance', () => {
  it('garde la valeur propre quand rien n’est hérité', () => {
    const child = mk({ id: 'c', context: 'propre' })
    const L = resolveInheritance(child, new Map([['c', child]]), 'en')
    expect(L.context).toBe('propre')
  })

  it('hérite un champ depuis la mère (localisé)', () => {
    const mother = mk({ id: 'm', context: 'CTX mère', i18n: { fr: { context: 'CTX mère FR' } } })
    const child = mk({ id: 'c', context: 'ignoré', inherits: { context: 'm' } })
    const byId = new Map([['m', mother], ['c', child]])
    expect(resolveInheritance(child, byId, 'en').context).toBe('CTX mère')
    expect(resolveInheritance(child, byId, 'fr').context).toBe('CTX mère FR')
  })

  it('suit la chaîne mère→grand-mère', () => {
    const gm = mk({ id: 'gm', method: 'M gm' })
    const m = mk({ id: 'm', method: 'ignoré', inherits: { method: 'gm' } })
    const c = mk({ id: 'c', method: 'ignoré', inherits: { method: 'm' } })
    const byId = new Map([['gm', gm], ['m', m], ['c', c]])
    expect(resolveInheritance(c, byId, 'en').method).toBe('M gm')
  })

  it('retombe sur la valeur propre si la mère est absente du byId (visiteur/confidentiel)', () => {
    const child = mk({ id: 'c', context: 'repli', inherits: { context: 'secret' } })
    const L = resolveInheritance(child, new Map([['c', child]]), 'en')
    expect(L.context).toBe('repli')
  })

  it('ne boucle pas sur un cycle accidentel', () => {
    const a = mk({ id: 'a', context: 'A', inherits: { context: 'b' } })
    const b = mk({ id: 'b', context: 'B', inherits: { context: 'a' } })
    const byId = new Map([['a', a], ['b', b]])
    expect(() => resolveInheritance(a, byId, 'en')).not.toThrow()
  })
})

describe('isInheritableField', () => {
  it('accepte la liste blanche et rejette le reste', () => {
    expect(isInheritableField('context')).toBe(true)
    expect(isInheritableField('titre')).toBe(false)
    expect(isInheritableField('nimporte')).toBe(false)
  })
})

describe('normalizeAssocPair', () => {
  it('ordonne source < target (déterministe)', () => {
    expect(normalizeAssocPair('b', 'a')).toEqual({ source_id: 'a', target_id: 'b' })
    expect(normalizeAssocPair('a', 'b')).toEqual({ source_id: 'a', target_id: 'b' })
  })
})

describe('wouldCreateCycle', () => {
  it('détecte qu’ajouter mère→fille créerait un cycle', () => {
    // edges existants : a→b (a mère de b). Ajouter b→a recréerait un cycle.
    const edges = [{ source_id: 'a', target_id: 'b' }]
    expect(wouldCreateCycle('b', 'a', edges)).toBe(true)
    expect(wouldCreateCycle('a', 'c', edges)).toBe(false)
  })
})
