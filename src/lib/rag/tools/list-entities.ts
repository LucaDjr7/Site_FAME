import type { RegisteredTool, ToolContext, ToolResult } from './types'

async function handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
  const labo = args.labo === 'paris' || args.labo === 'montreal' ? args.labo : undefined

  if (args.entity === 'subjects') {
    let query = ctx.service.from('subjects').select('id, titre, statut, labo, confidentiel').limit(50)
    if (labo) query = query.eq('labo', labo)
    const { data } = await query
    const rows: any[] = data ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
    const subjects = rows
      .filter(r => ctx.tier === 'member' || !r.confidentiel) // visiteur : pas de confidentiel
      .map(r => ({ id: r.id, titre: r.titre, statut: r.statut, labo: r.labo }))
    return { subjects }
  }

  if (args.entity === 'members') {
    // PII : ne JAMAIS sélectionner ni renvoyer l'email. Équipe publique (sans email).
    let query = ctx.service.from('members').select('prenom, nom, role, labo').limit(100)
    if (labo) query = query.eq('labo', labo)
    const { data } = await query
    const rows: any[] = data ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
    const members = rows.map(r => ({ prenom: r.prenom, nom: r.nom, role: r.role, labo: r.labo }))
    return { members }
  }

  if (args.entity === 'publications') {
    let query = ctx.service.from('publications').select('titre, auteurs, annee, type, lien, labo').limit(50)
    if (labo) query = query.eq('labo', labo)
    const { data } = await query
    const rows: any[] = data ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
    const publications = rows.map(r => ({ titre: r.titre, auteurs: r.auteurs, annee: r.annee, type: r.type, lien: r.lien, labo: r.labo }))
    return { publications }
  }

  return { error: 'unknown_entity' }
}

export const listEntities: RegisteredTool = {
  def: {
    name: 'list_entities',
    description: 'List FAME research subjects, team members, or publications. Use this when the user asks which subjects exist or are in progress, who is on the team, or what has been published. Optionally filter by lab (paris/montreal).',
    parameters: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: ['subjects', 'members', 'publications'] },
        labo: { type: 'string', enum: ['paris', 'montreal'] },
      },
      required: ['entity'],
    },
  },
  handler,
}
