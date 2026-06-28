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

vi.mock('./index-file', () => ({
  indexSubjectFile: vi.fn(),
  deleteFileChunks: vi.fn(),
  deleteSubjectFileChunks: vi.fn(),
}))

import { scheduleIndexFile, scheduleDeleteFileChunks, scheduleDeleteSubjectFiles } from './schedule'
import * as indexFile from './index-file'

describe('schedule file helpers', () => {
  it('scheduleIndexFile appelle indexSubjectFile', async () => {
    const spy = vi.spyOn(indexFile, 'indexSubjectFile').mockResolvedValue()
    scheduleIndexFile('f1')
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith('f1')
  })
  it('scheduleDeleteFileChunks appelle deleteFileChunks', async () => {
    const spy = vi.spyOn(indexFile, 'deleteFileChunks').mockResolvedValue()
    scheduleDeleteFileChunks('f1')
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith('f1')
  })
  it('scheduleDeleteSubjectFiles appelle deleteSubjectFileChunks', async () => {
    const spy = vi.spyOn(indexFile, 'deleteSubjectFileChunks').mockResolvedValue()
    scheduleDeleteSubjectFiles('s1')
    await new Promise((r) => setTimeout(r, 0))
    expect(spy).toHaveBeenCalledWith('s1')
  })
})
