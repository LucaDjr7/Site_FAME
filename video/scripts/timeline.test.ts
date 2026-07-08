import { describe, it, expect } from 'vitest'
import { buildTimeline, PAD_MS } from './capture'

const manifest = { 'a.1': { hash: 'x', durationMs: 3000 }, 'a.2': { hash: 'y', durationMs: 2000 } }
const chapters = [{ id: 'welcome' as const, beats: [{ line: 'a.1', actions: [] }, { line: 'a.2', actions: [] }] }]

describe('buildTimeline', () => {
  it('les beats s\'enchaînent avec le padding et couvrent la voix', () => {
    const tl = buildTimeline(chapters, manifest, PAD_MS)
    const [ch] = tl.chapters
    if (!ch) throw new Error('no chapter built')
    expect(ch.beats[0]).toEqual({ line: 'a.1', startMs: 0, durationMs: 3000 + PAD_MS })
    expect(ch.beats[1]?.startMs).toBe(3000 + PAD_MS)
    expect(ch.durationMs).toBe(5000 + 2 * PAD_MS)
  })
  it('échoue si une ligne manque au manifest', () => {
    expect(() => buildTimeline([{ id: 'welcome', beats: [{ line: 'zz', actions: [] }] }], manifest, PAD_MS)).toThrow('zz')
  })
})
