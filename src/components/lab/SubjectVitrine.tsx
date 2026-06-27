import type { Subject, MemberRef } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { vitrineHeadline, vitrineSubtitle, vitrineNumber } from '@/lib/subjects/vitrine'

type Props = {
  subject: Subject
  members: MemberRef[]
  editMode: boolean
  isDragging?: boolean
  statusLabel: string
  doneLabel: string
  ficheLabel: string
  questionLabel: string
  readLabel: string
  transversalLabel?: string
  deleteTitle?: string
  editTitle?: string
  onDelete?: () => void
  onEdit?: () => void
  onCardClick?: () => void
}

export function SubjectVitrine({
  subject, members, editMode, isDragging = false,
  statusLabel, doneLabel, ficheLabel, questionLabel, readLabel,
  transversalLabel, deleteTitle, editTitle, onDelete, onEdit, onCardClick,
}: Props) {
  const author = subject.auteurs[0] ? members.find(m => m.id === subject.auteurs[0]) : null
  const authorName = author ? `${author.prenom} ${author.nom}` : null
  const headline = vitrineHeadline(subject)
  const subtitle = vitrineSubtitle(subject)
  const number = vitrineNumber(subject.ordre)

  return (
    <div style={{ position: 'relative' }}>
      {editMode && onDelete && (
        <button className="font-mono bg-fame-red text-white" onClick={e => { e.stopPropagation(); onDelete() }} title={deleteTitle}
          style={{ position: 'absolute', top: -8, right: -8, zIndex: 10, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      )}
      {editMode && onEdit && (
        <button className="font-mono bg-fame-blue text-white" onClick={e => { e.stopPropagation(); onEdit() }} title={editTitle}
          style={{ position: 'absolute', top: -8, right: 20, zIndex: 10, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✎</button>
      )}

      <button className={`poster${isDragging ? ' dragging' : ''}`} onClick={editMode ? undefined : onCardClick}
        style={{ aspectRatio: '1 / 1.414', width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: editMode ? 'default' : 'pointer', position: 'relative', display: 'block' }}>
        <div className="poster-inner" style={{ background: '#faf9f5', borderRadius: 6, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', transition: 'transform 0.25s cubic-bezier(.2,.7,.2,1), box-shadow 0.25s ease' }}>
          {/* Light top */}
          <div style={{ flex: '1.85 1 0', padding: '10px 11px 8px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="font-mono" style={{ fontSize: 7.5, letterSpacing: '0.12em', color: '#3a5a8a', textTransform: 'uppercase', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{subject.kicker || statusLabel}</span>
              <span className="font-mono" style={{ fontSize: 7, letterSpacing: '0.08em', color: '#b3ada0', textTransform: 'uppercase', flexShrink: 0, marginLeft: 6 }}>{ficheLabel}</span>
            </div>
            <div style={{ height: 1, background: '#16263f', margin: '6px 0 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="font-serif" style={{ fontWeight: 300, fontSize: 34, lineHeight: 1, color: '#16263f', letterSpacing: '-0.02em', marginTop: 2 }}>{number}</span>
              <span className="font-mono" style={{ fontSize: 6.5, letterSpacing: '0.05em', color: '#a9a395', textTransform: 'uppercase', textAlign: 'right', marginTop: 4, lineHeight: 1.6 }}>
                {subject.periode}{subject.periode ? <br /> : null}{statusLabel}
              </span>
            </div>
            <div style={{ flex: 1 }} />
            <span className="font-mono" style={{ fontSize: 7, letterSpacing: '0.1em', color: '#9a9485', textTransform: 'uppercase', marginBottom: 4 }}>{questionLabel}</span>
            <span className="font-serif" style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.04, color: '#16263f', letterSpacing: '-0.02em', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{headline}</span>
            {subtitle && <span className="font-serif" style={{ fontStyle: 'italic', fontSize: 9, color: '#6a7589', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subtitle}</span>}
          </div>
          {/* Navy bottom */}
          <div style={{ flex: '1 1 0', background: '#15203f', padding: '9px 11px 8px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {subject.accroche && <span className="font-serif" style={{ fontStyle: 'italic', fontSize: 9.5, lineHeight: 1.4, color: '#cdd8ea', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subject.accroche}</span>}
            <div style={{ flex: 1 }} />
            {subject.keywords.length > 0 && (
              <div className="font-mono" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 6.5, color: '#7fa3d4', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6, maxHeight: 18, overflow: 'hidden' }}>
                {subject.keywords.slice(0, 3).map((k, i) => <span key={i}>{k}</span>)}
              </div>
            )}
            <div style={{ height: 1, background: '#23344f', marginBottom: 6 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                {authorName ? <Avatar name={authorName} photoUrl={author?.photo_url} size={16} /> : null}
                <span className="font-mono" style={{ fontSize: 7.5, color: '#e7ecf4', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{authorName ?? ''}</span>
              </div>
              <span className="font-mono" style={{ fontSize: 7.5, fontWeight: 700, color: '#7fa3d4', flexShrink: 0 }}>{readLabel}</span>
            </div>
          </div>

          {subject.is_transversal && transversalLabel && (
            <span className="font-mono text-fame-teal" style={{ position: 'absolute', top: 6, right: 6, fontSize: 7, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(30,155,126,0.14)', border: '1px solid rgba(30,155,126,0.35)', borderRadius: 8, padding: '1px 4px' }}>{transversalLabel}</span>
          )}
          {subject.statut === 'done' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="font-mono text-fame-coral" style={{ transform: 'rotate(-15deg)', border: '2.5px solid', borderRadius: 4, padding: '3px 8px', fontSize: 14, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 }}>{doneLabel}</div>
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
