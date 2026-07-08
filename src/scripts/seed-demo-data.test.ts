import { describe, it, expect } from 'vitest'
import { DEMO, DEMO_MEMBER_EMAIL } from './seed-demo-data'

describe('seed-demo-data', () => {
  it('tous les emails membres sont marqués demo-', () => {
    for (const m of DEMO.members) {
      expect(m.email).toMatch(/^demo-.+@fame-demo\.local$/)
    }
    expect(DEMO.members.map(m => m.email)).toContain(DEMO_MEMBER_EMAIL)
  })
  it('tous les ids sont des UUIDs fixes et uniques', () => {
    const ids = [
      ...DEMO.members.map(m => m.id),
      ...DEMO.subjects.map(s => s.id),
      ...DEMO.tasks.map(t => t.id),
      ...DEMO.subtasks.map(s => s.id),
      ...DEMO.comments.map(c => c.id),
      ...DEMO.publications.map(p => p.id),
      ...DEMO.relations.map(r => r.id),
    ]
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    for (const id of ids) expect(id).toMatch(uuidRe)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('exactement un sujet confidentiel (pour la démo du cadenas)', () => {
    expect(DEMO.subjects.filter(s => s.confidentiel)).toHaveLength(1)
  })
  it('chaque sujet a son i18n en et fr', () => {
    for (const s of DEMO.subjects) {
      expect(s.i18n.en?.titre).toBeTruthy()
      expect(s.i18n.fr?.titre).toBeTruthy()
    }
  })
  it('les FK internes pointent vers des ids du dataset', () => {
    const subjectIds = new Set(DEMO.subjects.map(s => s.id))
    const memberIds = new Set(DEMO.members.map(m => m.id))
    const taskIds = new Set(DEMO.tasks.map(t => t.id))
    for (const t of DEMO.tasks) expect(subjectIds.has(t.sujet_id)).toBe(true)
    for (const st of DEMO.subtasks) expect(taskIds.has(st.task_id)).toBe(true)
    for (const c of DEMO.comments) expect(subjectIds.has(c.sujet_id)).toBe(true)
    for (const r of DEMO.relations) {
      expect(subjectIds.has(r.source_id)).toBe(true)
      expect(subjectIds.has(r.target_id)).toBe(true)
    }
    for (const s of DEMO.subjects) for (const a of s.auteurs) expect(memberIds.has(a)).toBe(true)
  })
})
