type Props = {
  total: number
  done: number
  height?: number
  colorDone?: string
  colorEmpty?: string
}

export function SegmentedBar({
  total,
  done,
  height = 4,
  colorDone = '#1e9b7e',
  colorEmpty = '#eceadf',
}: Props) {
  if (total === 0) return (
    <div style={{ height, background: colorEmpty, borderRadius: 2, width: '100%' }} />
  )
  const segments = Array.from({ length: total }, (_, i) => i < done)
  return (
    <div style={{ display: 'flex', gap: 2, height, width: '100%' }}>
      {segments.map((filled, i) => (
        <div key={i} style={{
          flex: 1,
          height,
          borderRadius: 2,
          background: filled ? colorDone : colorEmpty,
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  )
}
