import { describe, it, expect, vi, beforeEach } from 'vitest'

const afterMock = vi.fn((cb: () => unknown) => { void cb() })
vi.mock('next/server', () => ({ after: (cb: () => unknown) => afterMock(cb) }))
const indexSourceMock = vi.fn<(type: unknown, id: unknown) => Promise<void>>()
const markStaleMock = vi.fn<(type: unknown, id: unknown) => Promise<void>>()
indexSourceMock.mockResolvedValue(undefined)
markStaleMock.mockResolvedValue(undefined)
vi.mock('./index-source', () => ({
  indexSource: (type: unknown, id: unknown) => indexSourceMock(type, id),
  markSourceStale: (type: unknown, id: unknown) => markStaleMock(type, id),
}))

import { scheduleReindex } from './schedule'

beforeEach(() => { afterMock.mockClear(); indexSourceMock.mockClear(); markStaleMock.mockClear() })

describe('scheduleReindex', () => {
  it('planifie l’indexation via after()', async () => {
    scheduleReindex('subject', 's1')
    expect(afterMock).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(indexSourceMock).toHaveBeenCalledWith('subject', 's1')
  })
  it('si indexSource lève, marque la source stale (n’explose pas)', async () => {
    indexSourceMock.mockRejectedValueOnce(new Error('embed down'))
    scheduleReindex('subject', 's2')
    await new Promise(r => setTimeout(r, 0))
    expect(markStaleMock).toHaveBeenCalledWith('subject', 's2')
  })
})
