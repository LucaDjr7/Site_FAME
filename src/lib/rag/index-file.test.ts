import { describe, it, expect, beforeEach } from 'vitest'

let fileRow: unknown = { id: 'f1', subject_id: 's1', storage_path: 's1/u', file_name: 'doc.pdf', mime_type: 'application/pdf' }
let subjectRow: unknown = { confidentiel: false, labo: 'paris', is_transversal: false }
let inserted: Record<string, unknown>[] = []
const deletedBy: Array<[string, unknown]> = []
const updated: Array<{ vals: unknown; filters: Array<[string, unknown]> }> = []

function chain(table: string) {
  const filters: Array<[string, unknown]> = []
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.eq = (c: string, v: unknown) => { filters.push([c, v]); return b }
  b.single = () => Promise.resolve({ data: table === 'subjects' ? subjectRow : fileRow, error: null })
  b.insert = (rows: Record<string, unknown>[]) => { inserted = rows; return Promise.resolve({ error: null }) }
  b.delete = () => ({ eq: (c: string, v: unknown) => { deletedBy.push([c, v]); const e2 = { eq: (c2: string, v2: unknown) => { deletedBy.push([c2, v2]); return Promise.resolve({ error: null }) } }; return Object.assign(Promise.resolve({ error: null }), e2) } })
  b.update = (vals: unknown) => { const f: Array<[string, unknown]> = []; const u = { eq: (c: string, v: unknown) => { f.push([c, v]); return u } }; updated.push({ vals, filters: f }); return Object.assign(Promise.resolve({ error: null }), u) }
  return b
}
const service = {
  from: (t: string) => chain(t),
  storage: { from: () => ({ download: async () => ({ data: { arrayBuffer: async () => new TextEncoder().encode('x').buffer }, error: null }) }) },
}
const provider = { embed: async (texts: string[]) => texts.map(() => [0.1, 0.2]) }

import { indexSubjectFile, retierFile, syncSubjectFileVisibility } from './index-file'

beforeEach(() => {
  fileRow = { id: 'f1', subject_id: 's1', storage_path: 's1/u', file_name: 'doc.pdf', mime_type: 'application/pdf' }
  subjectRow = { confidentiel: false, labo: 'paris', is_transversal: false }
  inserted = []; deletedBy.length = 0; updated.length = 0
})

describe('indexSubjectFile', () => {
  it('insère des chunks publics avec metadata pour un sujet public', async () => {
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => 'contenu du document' })
    expect(inserted.length).toBeGreaterThan(0)
    expect(inserted[0]!.source_type).toBe('subject_file')
    expect(inserted[0]!.source_id).toBe('f1')
    expect(inserted[0]!.visibility).toBe('public')
    expect(inserted[0]!.metadata).toEqual({ subject_id: 's1', file_name: 'doc.pdf' })
  })
  it('hérite visibility=member d\'un sujet confidentiel', async () => {
    subjectRow = { confidentiel: true, labo: 'paris', is_transversal: false }
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => 'contenu' })
    expect(inserted[0]!.visibility).toBe('member')
    expect(inserted[0]!.confidentiel).toBe(true)
  })
  it('n\'insère rien si l\'extraction est vide', async () => {
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => '' })
    expect(inserted).toEqual([])
    expect(deletedBy).toContainEqual(['source_id', 'f1'])
  })
  it('traite un sujet introuvable comme confidentiel (fail-closed)', async () => {
    subjectRow = null
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => 'contenu' })
    expect(inserted[0]!.visibility).toBe('member')
    expect(inserted[0]!.confidentiel).toBe(true)
  })
  it('doc confidentiel sur sujet public → chunks visibility=member', async () => {
    fileRow = { id: 'f1', subject_id: 's1', storage_path: 's1/u', file_name: 'doc.pdf', mime_type: 'application/pdf', confidentiel: true }
    subjectRow = { confidentiel: false, labo: 'paris', is_transversal: false }
    await indexSubjectFile('f1', { service: service as never, provider: provider as never, extract: async () => 'contenu' })
    expect(inserted[0]!.visibility).toBe('member')
    expect(inserted[0]!.confidentiel).toBe(true)
  })
})

describe('syncSubjectFileVisibility', () => {
  function make(files: Array<{ id: string; confidentiel: boolean }>) {
    const ups: Array<{ vals: Record<string, unknown>; filters: Array<[string, unknown]> }> = []
    const svc = {
      from: (t: string) => ({
        select: () => ({ eq: () => Promise.resolve({ data: t === 'subject_files' ? files : [], error: null }) }),
        update: (vals: Record<string, unknown>) => {
          const filters: Array<[string, unknown]> = []
          const u = { eq: (c: string, v: unknown) => { filters.push([c, v]); return u } }
          ups.push({ vals, filters }); return Object.assign(Promise.resolve({ error: null }), u)
        },
      }),
    }
    return { svc, ups }
  }

  it('sujet confidentiel → blanket member', async () => {
    const { svc, ups } = make([])
    await syncSubjectFileVisibility('s1', { labo: 'paris', confidentiel: true, is_transversal: false }, { service: svc as never })
    expect(ups[0]!.vals).toMatchObject({ visibility: 'member', confidentiel: true })
  })

  it('sujet public → visibilité par fichier (confi reste member)', async () => {
    const { svc, ups } = make([{ id: 'fa', confidentiel: true }, { id: 'fb', confidentiel: false }])
    await syncSubjectFileVisibility('s1', { labo: 'paris', confidentiel: false, is_transversal: false }, { service: svc as never })
    const a = ups.find(u => u.filters.some(f => f[1] === 'fa'))!
    const b = ups.find(u => u.filters.some(f => f[1] === 'fb'))!
    expect(a.vals).toMatchObject({ visibility: 'member', confidentiel: true })
    expect(b.vals).toMatchObject({ visibility: 'public', confidentiel: false })
  })
})

describe('retierFile', () => {
  it('doc confidentiel sur sujet public → met les chunks en member, sans embed', async () => {
    fileRow = { id: 'f1', subject_id: 's1', confidentiel: true }
    subjectRow = { confidentiel: false }
    let embedded = false
    const prov = { embed: async (t: string[]) => { embedded = true; return t.map(() => [0.1]) } }
    await retierFile('f1', { service: service as never, provider: prov as never })
    expect(embedded).toBe(false)
    expect(updated.at(-1)!.vals).toMatchObject({ visibility: 'member', confidentiel: true })
    expect(updated.at(-1)!.filters).toEqual([['source_type', 'subject_file'], ['source_id', 'f1']])
  })
  it('doc public sur sujet public → chunks public', async () => {
    fileRow = { id: 'f1', subject_id: 's1', confidentiel: false }
    subjectRow = { confidentiel: false }
    await retierFile('f1', { service: service as never })
    expect(updated.at(-1)!.vals).toMatchObject({ visibility: 'public', confidentiel: false })
    expect(updated.at(-1)!.filters).toEqual([['source_type', 'subject_file'], ['source_id', 'f1']])
  })
})
