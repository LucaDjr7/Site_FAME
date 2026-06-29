import { describe, it, expect, vi } from 'vitest'

const insertMock = vi.fn()
vi.mock('@/lib/auth', () => ({ requireMember: vi.fn().mockResolvedValue({ session: { user: { id: 'u' } }, member: { prenom: 'A', nom: 'B' } }), getSession: vi.fn(), authErrorResponse: () => new Response('x', { status: 401 }) }))
vi.mock('@/lib/rag/usage', () => ({ isOverBudget: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/tasks/translate', () => ({ buildTaskI18n: vi.fn().mockResolvedValue({ en: { titre: 'T', description: 'D', subtasks: [] }, fr: { titre: 'Tr', description: 'Dr', subtasks: [] } }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: () => ({
      insert: (rows: unknown) => { insertMock(rows); return { select: () => ({ single: () => ({ data: { id: 't1' }, error: null }) }) } },
    }),
  }),
}))
vi.mock('@/lib/constants', () => ({ VALID_LABS: ['paris', 'montreal'] }))

import { POST } from './route'
function req(body: unknown) { return new Request('http://x/api/tasks', { method: 'POST', body: JSON.stringify(body) }) as never }

describe('POST /api/tasks auto-translate', () => {
  it('persiste i18n calculé par buildTaskI18n', async () => {
    const res = await POST(req({ labo: 'paris', titre: 'T', sujet_id: 's', description: 'D', locale: 'en' }))
    expect(res.status).toBe(201)
    const { buildTaskI18n } = await import('@/lib/tasks/translate')
    expect(buildTaskI18n).toHaveBeenCalledOnce()
    const taskRow = insertMock.mock.calls[0]![0]
    expect(taskRow.i18n).toBeDefined()
  })
})
