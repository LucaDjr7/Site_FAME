import { describe, it, expect } from 'vitest'
import { computeSchedule, CARD_FRAMES } from './timing'

const timeline = { chapters: [
  { id: 'welcome', durationMs: 10000, beats: [{ line: 'w.1', startMs: 0, durationMs: 10000 }] },
  { id: 'tour', durationMs: 5000, beats: [{ line: 't.1', startMs: 0, durationMs: 5000 }] },
] }

describe('computeSchedule', () => {
  it('carte 2s puis vidéo, chapitres bout à bout', () => {
    const s = computeSchedule(timeline, 30)
    expect(CARD_FRAMES).toBe(60)
    expect(s.chapters[0]).toMatchObject({ cardFrom: 0, cardDuration: 60, videoFrom: 60, videoDuration: 300 })
    expect(s.chapters[1].cardFrom).toBe(360)
    expect(s.totalFrames).toBe(60 + 300 + 60 + 150)
  })
  it('les beats sont positionnés relativement au début vidéo du chapitre', () => {
    const s = computeSchedule(timeline, 30)
    expect(s.chapters[1].beats[0]).toMatchObject({ from: 420, duration: 150 })
  })
})
