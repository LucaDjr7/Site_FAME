// Root.tsx — enregistre GuideVideo-fr / GuideVideo-en.
// La timeline est lue au moment du bundling via calculateMetadata (fetch de staticFile).
import { Composition, staticFile } from 'remotion'
import { GuideVideo } from './GuideVideo'
import { computeSchedule, type TimelineJson } from './timing'

const EMPTY: TimelineJson = { chapters: [] }

function makeComposition(locale: 'fr' | 'en') {
  return (
    <Composition
      key={locale}
      id={`GuideVideo-${locale}`}
      component={GuideVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={300}
      defaultProps={{ locale, timeline: EMPTY }}
      calculateMetadata={async () => {
        const res = await fetch(staticFile(`recordings/${locale}/timeline.json`))
        const timeline = (await res.json()) as TimelineJson
        return { durationInFrames: Math.max(1, computeSchedule(timeline, 30).totalFrames), props: { locale, timeline } }
      }}
    />
  )
}

export function Root() {
  return (
    <>
      {makeComposition('fr')}
      {makeComposition('en')}
    </>
  )
}
