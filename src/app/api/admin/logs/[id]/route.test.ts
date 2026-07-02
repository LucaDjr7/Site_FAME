import { describe, it, expect, vi } from 'vitest'

const { updateEq, deleteEq, fromMock } = vi.hoisted(() => {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  const fromMock = vi.fn(() => ({ update: () => ({ eq: updateEq }), delete: () => ({ eq: deleteEq }) }))
  return { updateEq, deleteEq, fromMock }
})
vi.mock('@/lib/auth', () => ({ requireAdmin: vi.fn().mockResolvedValue({}), authErrorResponse: () => new Response('x', { status: 403 }) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn().mockResolvedValue({ from: fromMock }) }))

import { PATCH, DELETE } from './route'
import { NextRequest } from 'next/server'
function req(body: unknown) { return new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }) as never }
function delReq(url: string) { return new NextRequest(url, { method: 'DELETE' }) }

describe('PATCH /api/admin/logs/[id]', () => {
  it('met à jour resolved', async () => {
    const res = await PATCH(req({ resolved: true }), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(200)
    expect(updateEq).toHaveBeenCalled()
  })
  it('400 si resolved absent', async () => {
    const res = await PATCH(req({}), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/logs/[id]', () => {
  it('supprime une entrée unanswered', async () => {
    const res = await DELETE(delReq('http://x?type=unanswered'), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('chat_unanswered')
    expect(deleteEq).toHaveBeenCalled()
  })
  it('supprime une entrée flagged', async () => {
    const res = await DELETE(delReq('http://x?type=flagged'), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('chat_flagged')
  })
  it('400 si type invalide', async () => {
    const res = await DELETE(delReq('http://x?type=bogus'), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(400)
  })
  it('400 sur une propriété de prototype (constructor)', async () => {
    const res = await DELETE(delReq('http://x?type=constructor'), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(400)
  })
  it('400 sur __proto__', async () => {
    const res = await DELETE(delReq('http://x?type=__proto__'), { params: Promise.resolve({ id: 'x1' }) })
    expect(res.status).toBe(400)
  })
})
