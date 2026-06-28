import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const modal = (rel: string) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8')

describe('A2 — modal labels paired with htmlFor', () => {
  it('AddTaskModal has htmlFor', () => {
    expect(modal('./tasks/AddTaskModal.tsx')).toContain('htmlFor=')
  })
  it('InviteModal has htmlFor', () => {
    expect(modal('./team/InviteModal.tsx')).toContain('htmlFor=')
  })
  it('EditMemberModal has htmlFor', () => {
    expect(modal('./team/EditMemberModal.tsx')).toContain('htmlFor=')
  })
  it('AddPublicationModal has htmlFor', () => {
    expect(modal('./publications/AddPublicationModal.tsx')).toContain('htmlFor=')
  })
  it('VitrineEditor has htmlFor', () => {
    expect(modal('./lab/VitrineEditor.tsx')).toContain('htmlFor=')
  })
})

describe('U8 — sidebar filter buttons have aria-pressed', () => {
  it('FilterSidebar has aria-pressed', () => {
    expect(modal('./lab/FilterSidebar.tsx')).toContain('aria-pressed')
  })
  it('TaskFilterSidebar has aria-pressed', () => {
    expect(modal('./tasks/TaskFilterSidebar.tsx')).toContain('aria-pressed')
  })
})
