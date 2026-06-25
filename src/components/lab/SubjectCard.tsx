import type { Subject, MemberRef, Difficulty } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { DiffDots } from '@/components/ui/DiffDots'

const STATUS_DOT: Record<string, string> = {
  active: '#1e9b7e',
  'on-hold': '#e8b149',
  done: '#2f4486',
}

function diffLevel(d: Difficulty): number {
  return d === 'easy' ? 1 : d === 'intermediate' ? 2 : 3
}

type Props = {
  subject: Subject
  members: MemberRef[]
  editMode: boolean
  isDragging?: boolean
  statusLabel: string
  doneLabel: string
  transversalLabel?: string
  onDelete?: () => void
  onCardClick?: () => void
}

export function SubjectCard({
  subject,
  members,
  editMode,
  isDragging = false,
  statusLabel,
  doneLabel,
  transversalLabel,
  onDelete,
  onCardClick,
}: Props) {
  const firstAuteurId = subject.auteurs[0]
  const author = firstAuteurId ? members.find(m => m.id === firstAuteurId) : null
  const authorName = author ? `${author.prenom} ${author.nom}` : null
  const dateStr = subject.created_at.slice(0, 7)

  return (
    <div style={{ position: 'relative' }}>
      {/* Delete button — only in edit mode */}
      {editMode && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Delete"
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            zIndex: 10,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#c0473b',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'IBM Plex Mono, monospace',
          }}
        >
          ✕
        </button>
      )}

      {/* Poster card */}
      <button
        className={`poster${isDragging ? ' dragging' : ''}${editMode ? '' : ''}`}
        onClick={editMode ? undefined : onCardClick}
        style={{
          aspectRatio: '1 / 1.34',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: editMode ? 'default' : 'pointer',
          position: 'relative',
          display: 'block',
        }}
      >
        <div
          className="poster-inner"
          style={{
            background: '#f5f4ee',
            borderRadius: 6,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            transition: 'transform 0.25s cubic-bezier(.2,.7,.2,1), box-shadow 0.25s ease',
          }}
        >
          {/* Status bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px 4px' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: STATUS_DOT[subject.statut] ?? '#ccc',
            }} />
            <span style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: STATUS_DOT[subject.statut] ?? '#666',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {subject.kicker || statusLabel}
            </span>
            {subject.is_transversal && transversalLabel && (
              <span style={{
                marginLeft: 'auto',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#1e9b7e',
                background: 'rgba(30,155,126,0.12)',
                border: '1px solid rgba(30,155,126,0.3)',
                borderRadius: 10,
                padding: '1px 5px',
                lineHeight: 1.4,
                whiteSpace: 'nowrap',
              }}>
                {transversalLabel}
              </span>
            )}
          </div>

          {/* Title */}
          <div style={{ padding: '2px 10px 6px' }}>
            <span style={{
              fontFamily: 'Roboto Slab, Georgia, serif',
              fontSize: 12,
              fontWeight: 600,
              color: '#15203f',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {subject.titre}
            </span>
          </div>

          {/* Figure placeholder */}
          <div style={{
            flex: '0 0 auto',
            height: 52,
            margin: '0 10px',
            borderRadius: 3,
            background: 'repeating-linear-gradient(135deg, #e4e2d6 0 7px, #eceadf 7px 14px)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* A10 exemption: "fig." is a purely decorative watermark, not
                functional text — opacity 0.55 on a patterned background further
                reduces its legibility expectation. Kept at 7px intentionally. */}
            <span style={{
              position: 'absolute',
              bottom: 3,
              right: 5,
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 7,
              color: 'rgba(90,100,140,0.55)',
              fontStyle: 'italic',
            }}>
              fig.
            </span>
          </div>

          {/* Abstract */}
          {subject.context && (
            <div style={{ padding: '5px 10px 4px' }}>
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                color: '#43507a',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {subject.context}
              </span>
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 10px 8px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {authorName ? (
                <Avatar name={authorName} photoUrl={author?.photo_url} size={18} />
              ) : (
                <span style={{ fontSize: 8, color: '#aaa', fontFamily: 'IBM Plex Mono, monospace' }}>—</span>
              )}
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 8.5,
                color: '#43507a',
              }}>
                {dateStr}
              </span>
            </div>
            <DiffDots level={diffLevel(subject.difficulte)} />
          </div>

          {/* DONE stamp overlay */}
          {subject.statut === 'done' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                transform: 'rotate(-15deg)',
                border: '2.5px solid #ff6f61',
                borderRadius: 4,
                padding: '3px 8px',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 14,
                fontWeight: 700,
                color: '#ff6f61',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.7,
              }}>
                {doneLabel}
              </div>
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
