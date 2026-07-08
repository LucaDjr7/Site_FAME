import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile } from 'remotion'
import { AstraMascot } from './AstraMascot'
import { Captions } from './Captions'
import { ChapterCard } from './ChapterCard'
import { computeSchedule, type TimelineJson } from './timing'
import { NARRATION as FR } from '../scenario/narration.fr'
import { NARRATION as EN } from '../scenario/narration.en'

export function GuideVideo({ locale, timeline }: { locale: 'fr' | 'en'; timeline: TimelineJson }) {
  const narration = locale === 'fr' ? FR : EN
  const schedule = computeSchedule(timeline, 30)

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {schedule.chapters.map((ch, i) => (
        <Sequence key={ch.id} from={ch.cardFrom} durationInFrames={ch.cardDuration + ch.videoDuration} name={ch.id}>
          <Sequence from={0} durationInFrames={ch.cardDuration}>
            <ChapterCard title={narration[`chapter.${ch.id}.title`]} index={i + 1} />
          </Sequence>
          <Sequence from={ch.cardDuration} durationInFrames={ch.videoDuration}>
            <OffthreadVideo src={staticFile(`recordings/${locale}/${ch.id}.webm`)} muted />
            {ch.beats.map(b => (
              <Sequence key={b.line} from={b.from - ch.videoFrom} durationInFrames={b.duration}>
                <Audio src={staticFile(`audio/${locale}/${b.line}.wav`)} />
                <Captions text={narration[b.line]} />
              </Sequence>
            ))}
            {/* Mascotte en surimpression permanente, coin bas-gauche (la bulle réelle du site est bas-gauche aussi) */}
            <div style={{ position: 'absolute', left: 42, bottom: 150 }}>
              <AstraMascot size={110} mood={ch.id === 'reflexes' || ch.id === 'outro' ? 'happy' : 'idle'} />
            </div>
          </Sequence>
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
