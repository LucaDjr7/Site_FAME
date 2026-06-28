import type { Subject, MemberRef } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { FitText } from './FitText'
import { CornerRibbon } from './CornerRibbon'
import { vitrineHeadline, vitrineSubtitle, vitrineNumber } from '@/lib/subjects/vitrine'
import { localizedSubject } from '@/lib/subjects/localized'
import type { Locale2 } from '@/types'

type Props = {
  subject: Subject
  locale: Locale2
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
  subject, locale, members, editMode, isDragging = false,
  statusLabel, doneLabel, ficheLabel, questionLabel, readLabel,
  transversalLabel, deleteTitle, editTitle, onDelete, onEdit, onCardClick,
}: Props) {
  const L = localizedSubject(subject, locale)
  const author = subject.auteurs[0] ? members.find(m => m.id === subject.auteurs[0]) : null
  const authorName = author ? `${author.prenom} ${author.nom}` : null
  const headline = vitrineHeadline({ question: L.question, titre: L.titre })
  const subtitle = vitrineSubtitle({ question: L.question, titre: L.titre })
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
          <div style={{ flex: '1.85 1 0', padding: '14px 15px 11px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#3a5a8a', textTransform: 'uppercase', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingLeft: subject.is_transversal ? 30 : 0 }}>{L.kicker || statusLabel}</span>
              <span className="font-mono" style={{ fontSize: 8.5, letterSpacing: '0.08em', color: '#b3ada0', textTransform: 'uppercase', flexShrink: 0, marginLeft: 6, paddingRight: subject.statut === 'done' ? 30 : 0 }}>{ficheLabel}</span>
            </div>
            <div style={{ height: 1, background: '#16263f', margin: '7px 0 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="font-serif" style={{ fontWeight: 300, fontSize: 46, lineHeight: 1, color: '#16263f', letterSpacing: '-0.02em', marginTop: 2 }}>{number}</span>
              <span className="font-mono" style={{ fontSize: 8.5, letterSpacing: '0.05em', color: '#a9a395', textTransform: 'uppercase', textAlign: 'right', marginTop: 4, lineHeight: 1.6 }}>
                {subject.periode}{subject.periode ? <br /> : null}{statusLabel}
              </span>
            </div>
            {/* Bloc question (bas de section) : police auto-réduite (FitText borné par
                l'espace dispo) → label + titre + sous-titre visibles sans troncature.
                Le label garde une taille fixe (px) ; seuls titre/sous-titre scalent (em). */}
            <FitText maxPx={21} minPx={11} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <span className="font-mono" style={{ fontSize: '8.5px', letterSpacing: '0.1em', color: '#9a9485', textTransform: 'uppercase', marginBottom: 5 }}>{questionLabel}</span>
              <span className="font-serif" style={{ fontWeight: 700, fontSize: '1em', lineHeight: 1.05, color: '#16263f', letterSpacing: '-0.02em', display: 'block' }}>{headline}</span>
              {subtitle && <span className="font-serif" style={{ fontStyle: 'italic', fontSize: '0.55em', color: '#6a7589', marginTop: '0.3em', lineHeight: 1.2, display: 'block' }}>{subtitle}</span>}
            </FitText>
          </div>
          {/* Navy bottom */}
          <div style={{ flex: '1 1 0', background: '#15203f', padding: '12px 15px 11px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Accroche : police auto-réduite pour tenir sans troncature dans l'espace dispo. */}
            {L.accroche
              ? <FitText maxPx={12} minPx={8} style={{ flex: 1, minHeight: 0 }}>
                  <span className="font-serif" style={{ fontStyle: 'italic', fontSize: '1em', lineHeight: 1.4, color: '#cdd8ea', display: 'block' }}>{L.accroche}</span>
                </FitText>
              : <div style={{ flex: 1 }} />}
            {L.keywords.length > 0 && (
              <div className="font-mono" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', fontSize: 8.5, color: '#7fa3d4', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 7, maxHeight: 24, overflow: 'hidden' }}>
                {L.keywords.slice(0, 3).map((k, i) => <span key={i}>{k}</span>)}
              </div>
            )}
            <div style={{ height: 1, background: '#23344f', marginBottom: 7 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {authorName ? <Avatar name={authorName} photoUrl={author?.photo_url} size={20} /> : null}
                <span className="font-mono" style={{ fontSize: 9.5, color: '#e7ecf4', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{authorName ?? ''}</span>
              </div>
              <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, color: '#7fa3d4', flexShrink: 0 }}>{readLabel}</span>
            </div>
          </div>

          {/* Rubans d'angle (label auto-fit) : transversal haut-gauche (teal),
              done haut-droite (coral) — coins opposés. */}
          {subject.is_transversal && transversalLabel && (
            <CornerRibbon side="left" color="#1e9b7e" label={transversalLabel} />
          )}
          {subject.statut === 'done' && (
            <CornerRibbon side="right" color="#ff6f61" label={doneLabel} />
          )}
        </div>
      </button>
    </div>
  )
}
