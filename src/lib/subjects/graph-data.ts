import type { Subject, SubjectRelation, Locale2, RelationGraphNode, RelationGraphEdge } from '@/types'
import { localizedSubject } from './localized'

export function buildGraphData(subjects: Subject[], relations: SubjectRelation[], locale: Locale2): {
  nodes: RelationGraphNode[]; edges: RelationGraphEdge[]
} {
  const present = new Set(subjects.map(s => s.id))
  const nodes: RelationGraphNode[] = subjects.map(s => ({
    id: s.id, titre: localizedSubject(s, locale).titre, labo: s.labo, statut: s.statut, is_transversal: s.is_transversal,
  }))
  const edges: RelationGraphEdge[] = relations
    .filter(r => present.has(r.source_id) && present.has(r.target_id))
    .map(r => ({
      id: r.id, source: r.source_id, target: r.target_id, kind: r.kind,
      label: r.label_i18n?.[locale]?.label ?? r.label,
    }))
  return { nodes, edges }
}
