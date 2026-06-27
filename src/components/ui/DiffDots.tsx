const DIFF_COLOR = '#15203f'
const DIFF_FAINT = 'rgba(120,140,190,0.28)'

/**
 * DiffDots — three square dots indicating difficulty level (1–3 filled).
 * Shared across kanban-shared, FilterSidebar, and SubjectVitrine.
 * SubjectVitrine should convert its Difficulty enum locally:
 *   const level = d === 'easy' ? 1 : d === 'intermediate' ? 2 : 3
 */
export function DiffDots({ level }: { level: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2.5, alignItems: 'center' }}>
      {[1, 2, 3].map(i => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            background: i <= level ? DIFF_COLOR : DIFF_FAINT,
          }}
        />
      ))}
    </span>
  )
}
