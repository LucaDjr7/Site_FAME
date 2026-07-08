import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { AstraMascot } from './AstraMascot'
import { FAME, FONT_MONO, FONT_SERIF } from './theme'

// Étoiles de fond déterministes (pas de Math.random : rendu stable frame à frame)
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 137.5) % 100,
  y: (i * 61.8) % 100,
  r: 0.6 + (i % 3) * 0.5,
}))

export function ChapterCard({ title, index }: { title: string; index: number }) {
  const frame = useCurrentFrame()
  const appear = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${FAME.navy}, ${FAME.navyLight})`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg style={{ position: 'absolute', inset: 0 }} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} fill={FAME.textLight} opacity={0.5} />
        ))}
      </svg>
      <div
        style={{
          opacity: appear,
          transform: `translateY(${(1 - appear) * 24}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}
      >
        <AstraMascot size={130} mood="happy" />
        <div style={{ fontFamily: FONT_MONO, color: FAME.gold, letterSpacing: '0.3em', fontSize: 26 }}>
          {String(index).padStart(2, '0')}
        </div>
        <h1 style={{ fontFamily: FONT_SERIF, color: FAME.textLight, fontSize: 84, margin: 0 }}>{title}</h1>
      </div>
    </AbsoluteFill>
  )
}
