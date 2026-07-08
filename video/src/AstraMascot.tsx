import { useCurrentFrame } from 'remotion'
import { FAME } from './theme'

// Path de l'étoile 4 branches — copié de src/components/assistant/ChatBubble.tsx
const STAR_PATH =
  'M50 2 Q50 50 65.6 34.4 Q50 50 98 50 Q50 50 65.6 65.6 Q50 50 50 98 Q50 50 34.4 65.6 Q50 50 2 50 Q50 50 34.4 34.4 Q50 50 50 2 Z'

export function AstraMascot({
  size = 110,
  mood = 'idle',
}: {
  size?: number
  mood?: 'idle' | 'happy'
}) {
  const frame = useCurrentFrame()
  const float = Math.sin(frame / 22) * 6 // flottement
  const rot = mood === 'happy' ? Math.sin(frame / 6) * 8 : Math.sin(frame / 40) * 3
  const blink = frame % 105 < 4 // clignement ~3,5 s
  const eyeRy = blink ? 0.6 : 4.4

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{
        transform: `translateY(${float}px) rotate(${rot}deg)`,
        filter: `drop-shadow(0 6px 18px ${FAME.blue}66)`,
      }}
    >
      <path d={STAR_PATH} fill={FAME.star} />
      {/* halo */}
      <path
        d={STAR_PATH}
        fill="none"
        stroke={FAME.star}
        strokeOpacity={0.35}
        strokeWidth={3}
        transform="scale(1.06) translate(-3,-3)"
      />
      {/* yeux */}
      <ellipse cx={42} cy={48} rx={3.2} ry={eyeRy} fill={FAME.navy} />
      <ellipse cx={58} cy={48} rx={3.2} ry={eyeRy} fill={FAME.navy} />
      {/* sourire si happy */}
      {mood === 'happy' && (
        <path d="M43 58 Q50 64 57 58" stroke={FAME.navy} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      )}
    </svg>
  )
}
