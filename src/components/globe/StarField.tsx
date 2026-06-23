// StarField — pure server-renderable component, no hooks
// Uses a deterministic seeded LCG PRNG to avoid hydration mismatch

const STAR_COLORS = ['#9fb2e6','#7e95d6','#b8c6ee','#6377b0','#aab9e4','#8ea4df']
const STAR_COUNT = 46
const STAR_PATH = 'M50 2 Q50 50 65.6 34.4 Q50 50 98 50 Q50 50 65.6 65.6 Q50 50 50 98 Q50 50 34.4 65.6 Q50 50 2 50 Q50 50 34.4 34.4 Q50 50 50 2 Z'

function seededLCG(seed: number) {
  let s = seed >>> 0
  return () => {
    s = ((s * 1664525 + 1013904223) >>> 0)
    return s / 2 ** 32
  }
}

export function StarField() {
  const rand = seededLCG(7)

  const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
    const left = rand() * 100
    const top  = rand() * 94
    const sizeRaw = rand()
    // Size buckets: small (6–12), medium (13–22), large (23–31)
    const size = sizeRaw < 0.55 ? 6 + sizeRaw / 0.55 * 6 : sizeRaw < 0.85 ? 13 + (sizeRaw - 0.55) / 0.3 * 9 : 23 + (sizeRaw - 0.85) / 0.15 * 8
    const opacity = 0.12 + rand() * 0.3
    const rotation = rand() * 45
    const colorIdx = Math.floor(rand() * STAR_COLORS.length)
    const twinkleDuration = 6 + rand() * 14
    const twinkleDelay = rand() * 14
    const isBig = size >= 23

    return { i, left, top, size, opacity, rotation, colorIdx, twinkleDuration, twinkleDelay, isBig }
  })

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {stars.map(star => (
        <svg
          key={star.i}
          viewBox="0 0 100 100"
          width={star.size}
          height={star.size}
          style={{
            position: 'absolute',
            left: `${star.left}%`,
            top: `${star.top}%`,
            opacity: star.opacity,
            transform: `rotate(${star.rotation}deg)`,
            animation: `fameTwinkle ${star.twinkleDuration.toFixed(1)}s ease-in-out ${star.twinkleDelay.toFixed(1)}s infinite`,
            filter: star.isBig ? `drop-shadow(0 0 3px ${STAR_COLORS[star.colorIdx]})` : undefined,
          }}
        >
          <path d={STAR_PATH} fill={STAR_COLORS[star.colorIdx]} />
        </svg>
      ))}
    </div>
  )
}
