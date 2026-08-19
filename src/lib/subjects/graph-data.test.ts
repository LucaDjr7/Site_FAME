import { describe, it, expect } from 'vitest'
import { buildGraphData } from './graph-data'
import type { Subject, SubjectRelation } from '@/types'

function sub(id: string, over: Partial<Subject> = {}): Subject {
  return { id, labo: 'paris', titre: id.toUpperCase(), kicker: '', question: '', accroche: '', periode: '',
    statut: 'active', context: '', method: '', results: '', keywords: [], auteurs: [], difficulte: 'intermediate',
    dimensions: { method: '', data: '', theory: '', writing: '' }, ordre: 0, is_transversal: false,
    confidentiel: false, show_in_tasks: false, i18n: {}, inherits: {}, created_at: '', updated_at: '', ...over }
}
function rel(over: Partial<SubjectRelation>): SubjectRelation {
  return { id: 'r', source_id: 'a', target_id: 'b', kind: 'assoc', label: '', label_i18n: {}, created_at: '', ...over }
}

describe('buildGraphData', () => {
  it('produit un nœud par sujet et conserve le titre localisé', () => {
    const subs = [sub('a', { i18n: { fr: { titre: 'A-FR' } } })]
    const { nodes } = buildGraphData(subs, [], 'fr')
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.titre).toBe('A-FR')
  })

  it('garde l’arête quand les deux extrémités existent', () => {
    const subs = [sub('a'), sub('b')]
    const { edges } = buildGraphData(subs, [rel({ id: 'r1', source_id: 'a', target_id: 'b', kind: 'parent' })], 'en')
    expect(edges).toHaveLength(1)
    expect(edges[0]?.kind).toBe('parent')
  })

  it('écarte l’arête vers un sujet absent (confidentiel masqué)', () => {
    const subs = [sub('a')]
    const { edges } = buildGraphData(subs, [rel({ id: 'r2', source_id: 'a', target_id: 'secret' })], 'en')
    expect(edges).toHaveLength(0)
  })

  it('localise le libellé d’arête', () => {
    const subs = [sub('a'), sub('b')]
    const r = rel({ id: 'r3', label: 'same data', label_i18n: { fr: { label: 'mêmes données' } } })
    expect(buildGraphData(subs, [r], 'fr').edges[0]?.label).toBe('mêmes données')
    expect(buildGraphData(subs, [r], 'en').edges[0]?.label).toBe('same data')
  })
})
