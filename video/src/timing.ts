export const CARD_FRAMES = 60 // 2 s à 30 fps

export interface TimelineJson {
  chapters: Array<{ id: string; durationMs: number; beats: Array<{ line: string; startMs: number; durationMs: number }> }>
}

export function computeSchedule(timeline: TimelineJson, fps: number) {
  const toFrames = (ms: number) => Math.round((ms * fps) / 1000)
  let cursor = 0
  const chapters = timeline.chapters.map(ch => {
    const cardFrom = cursor
    const videoFrom = cardFrom + CARD_FRAMES
    const videoDuration = toFrames(ch.durationMs)
    const beats = ch.beats.map(b => ({ line: b.line, from: videoFrom + toFrames(b.startMs), duration: toFrames(b.durationMs) }))
    cursor = videoFrom + videoDuration
    return { id: ch.id, cardFrom, cardDuration: CARD_FRAMES, videoFrom, videoDuration, beats }
  })
  return { chapters, totalFrames: cursor }
}
