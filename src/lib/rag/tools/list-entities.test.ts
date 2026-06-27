import { describe, it, expect } from 'vitest'
import { listEntities } from './list-entities'
import type { ToolContext } from './types'

// Builds a fake ToolContext whose query chain resolves to `data`,
// while capturing the column string passed to `.select(...)`.
function ctx(tier: 'visitor' | 'member', data: unknown, captured?: { select?: string }): ToolContext {
  const builder: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    select: (cols: string) => {
      if (captured) captured.select = cols
      return builder
    },
    eq: () => builder,
    limit: () => builder,
    then: (res: (v: { data: unknown; error: null }) => void) => res({ data, error: null }),
  }
  return { tier, service: { from: () => builder } as never }
}

describe('list_entities', () => {
  it('members — l\'email est public et communiqué (annuaire d\'équipe)', async () => {
    const captured: { select?: string } = {}
    const memberRows = [
      { prenom: 'Ada', nom: 'Lovelace', role: 'researcher', labo: 'paris', email: 'ada@fame.org' },
    ]
    const r = await listEntities.handler({ entity: 'members' }, ctx('member', memberRows, captured))
    const members = r.members as { prenom: string; nom: string; email: string; role: string; labo: string }[]
    expect(members).toEqual([{ prenom: 'Ada', nom: 'Lovelace', email: 'ada@fame.org', role: 'researcher', labo: 'paris' }])
    // La sortie DOIT contenir l'email (donnée publique).
    expect(JSON.stringify(r)).toContain('ada@fame.org')
    // Le select DOIT demander l'email.
    expect(captured.select).toBeDefined()
    expect(captured.select).toContain('email')
  })

  it('subjects — un visiteur ne voit jamais un sujet confidentiel', async () => {
    const subjectRows = [
      { id: 's1', titre: 'Public study', statut: 'active', labo: 'paris', confidentiel: false },
      { id: 's2', titre: 'Secret study', statut: 'active', labo: 'paris', confidentiel: true },
    ]
    const visitor = await listEntities.handler({ entity: 'subjects' }, ctx('visitor', subjectRows))
    const vSubjects = visitor.subjects as { id: string }[]
    expect(vSubjects.map(s => s.id)).toEqual(['s1'])
    // Le champ confidentiel ne doit pas être renvoyé.
    expect(JSON.stringify(visitor)).not.toContain('confidentiel')

    const member = await listEntities.handler({ entity: 'subjects' }, ctx('member', subjectRows))
    expect((member.subjects as unknown[]).length).toBe(2)
    expect(JSON.stringify(member)).not.toContain('confidentiel')
  })

  it('publications — mappe titre/auteurs/annee/type/lien', async () => {
    const pubRows = [
      { titre: 'On Engines', auteurs: ['Ada L'], annee: 1843, type: 'article', lien: 'http://x', labo: 'paris' },
    ]
    const r = await listEntities.handler({ entity: 'publications' }, ctx('visitor', pubRows))
    expect(r.publications).toEqual([
      { titre: 'On Engines', auteurs: ['Ada L'], annee: 1843, type: 'article', lien: 'http://x', labo: 'paris' },
    ])
  })

  it('entity inconnu → { error: "unknown_entity" }', async () => {
    const r = await listEntities.handler({ entity: 'wombats' }, ctx('member', []))
    expect(r).toEqual({ error: 'unknown_entity' })
  })
})
