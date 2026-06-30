import { describe, it, expect } from 'vitest'
import { parseRelationBody, resolveParentEnds } from './route'

describe('parseRelationBody', () => {
  it('rejette un kind invalide', () => {
    expect(parseRelationBody({ kind: 'x', otherId: 'b' }).error).toBeTruthy()
  })
  it('rejette otherId manquant', () => {
    expect(parseRelationBody({ kind: 'assoc' }).error).toBeTruthy()
  })
  it('accepte un assoc valide', () => {
    const r = parseRelationBody({ kind: 'assoc', otherId: 'b' })
    expect(r.error).toBeFalsy()
    expect(r.value).toMatchObject({ kind: 'assoc', otherId: 'b' })
  })
})

describe('resolveParentEnds', () => {
  it('direction=child : id est la mère', () => {
    expect(resolveParentEnds('id', 'other', 'child')).toEqual({ source_id: 'id', target_id: 'other' })
  })
  it('direction=mother : id est la fille', () => {
    expect(resolveParentEnds('id', 'other', 'mother')).toEqual({ source_id: 'other', target_id: 'id' })
  })
})
