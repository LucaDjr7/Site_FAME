import { interpolate, useCurrentFrame } from 'remotion'
import { FAME, FONT_SERIF } from './theme'

export function Captions({ text }: { text: string }) {
  const frame = useCurrentFrame()
  const appear = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 54,
        left: '50%',
        transform: `translateX(-50%) translateY(${(1 - appear) * 14}px)`,
        opacity: appear,
        maxWidth: 1240,
        background: `${FAME.sand}F2`,
        border: `1px solid ${FAME.ecru}`,
        borderRadius: 16,
        padding: '18px 30px',
        boxShadow: '0 18px 40px -18px rgba(0,5,30,0.5)',
        fontFamily: FONT_SERIF,
        fontSize: 32,
        color: FAME.textBody,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  )
}
