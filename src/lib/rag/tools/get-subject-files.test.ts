import { describe, it, expect } from 'vitest'
import { getSubjectFiles } from './get-subject-files'
import type { ToolContext } from './types'

function ctx(tier: 'visitor' | 'member', rows: unknown[]): ToolContext {
  return {
    tier,
    service: { from: () => ({ select: () => ({ eq: () => ({ data: rows, error: null }) }) }) } as never,
  }
}
const links = [{ node_name: 'data.csv', node_path: '/paris/s1/data.csv' }]

describe('get_subject_files', () => {
  it('refuse aux visiteurs', async () => {
    const r = await getSubjectFiles.handler({ subject_id: 's1' }, ctx('visitor', links))
    expect(r).toEqual({ allowed: false })
  })
  it('liste pour un membre', async () => {
    const r = await getSubjectFiles.handler({ subject_id: 's1' }, ctx('member', links))
    expect(r).toMatchObject({ allowed: true, files: [{ name: 'data.csv', path: '/paris/s1/data.csv' }] })
  })
})
