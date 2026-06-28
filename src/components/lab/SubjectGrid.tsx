'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import type { Subject, MemberRef, Lab, SubjectStatus, Difficulty, DateBucket } from '@/types'
import { SubjectVitrine } from './SubjectVitrine'
import { FilterSidebar } from './FilterSidebar'
import { VitrineEditor } from './VitrineEditor'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { dateBucket } from '@/lib/utils'
import { subjectSearchText, toLocale2 } from '@/lib/subjects/localized'

function passesFilters(
  s: Subject,
  q: string,
  fStatus: Set<SubjectStatus>,
  fDiff: Set<Difficulty>,
  fPerson: Set<string>,
  fDate: Set<DateBucket>,
): boolean {
  if (q && !subjectSearchText(s).includes(q.toLowerCase())) return false
  if (fStatus.size > 0 && !fStatus.has(s.statut)) return false
  if (fDiff.size > 0 && !fDiff.has(s.difficulte)) return false
  if (fPerson.size > 0 && !s.auteurs.some(id => fPerson.has(id))) return false
  if (fDate.size > 0 && !fDate.has(dateBucket(s.created_at))) return false
  return true
}

type SortMode = 'ordre' | 'recent' | 'oldest'

function sorted(subjects: Subject[], sort: SortMode): Subject[] {
  const copy = [...subjects]
  if (sort === 'ordre') return copy.sort((a, b) => a.ordre - b.ordre)
  if (sort === 'recent') return copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return copy.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

type Props = {
  lab: Lab
  initialSubjects: Subject[]
  members: MemberRef[]
  canEdit: boolean
}

export function SubjectGrid({ lab, initialSubjects, members, canEdit }: Props) {
  const t = useTranslations('lab')
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) ?? 'en'
  const { addToast } = useToast()

  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects)
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState<Set<SubjectStatus>>(new Set())
  const [fDiff, setFDiff] = useState<Set<Difficulty>>(new Set())
  const [fPerson, setFPerson] = useState<Set<string>>(new Set())
  const [fDate, setFDate] = useState<Set<DateBucket>>(new Set())
  const [sort, setSort] = useState<SortMode>('ordre')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // This page has a bottom toolbar (count / sort / Tasks link) above the footer;
  // lift the global assistant bubble above it.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--fame-bubble-bottom', '100px')
    return () => { root.style.removeProperty('--fame-bubble-bottom') }
  }, [])

  // Drag state — managed via refs to avoid re-renders during drag
  const dragIdRef = useRef<string | null>(null)
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const orderRef = useRef<string[]>([])
  const didMoveRef = useRef(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Computed filtered + sorted list
  const filtersActive = fStatus.size > 0 || fDiff.size > 0 || fPerson.size > 0 || fDate.size > 0
  const canDrag = canEdit && sort === 'ordre' && !filtersActive && q === ''

  const displaySubjects = sorted(
    subjects.filter(s => passesFilters(s, q, fStatus, fDiff, fPerson, fDate)),
    sort,
  )

  // Toggle filters
  function toggleStatus(v: SubjectStatus) {
    setFStatus(prev => {
      const n = new Set(prev)
      if (n.has(v)) { n.delete(v) } else { n.add(v) }
      return n
    })
  }
  function toggleDiff(v: Difficulty) {
    setFDiff(prev => {
      const n = new Set(prev)
      if (n.has(v)) { n.delete(v) } else { n.add(v) }
      return n
    })
  }
  function togglePerson(v: string) {
    setFPerson(prev => {
      const n = new Set(prev)
      if (n.has(v)) { n.delete(v) } else { n.add(v) }
      return n
    })
  }
  function toggleDate(v: DateBucket) {
    setFDate(prev => {
      const n = new Set(prev)
      if (n.has(v)) { n.delete(v) } else { n.add(v) }
      return n
    })
  }
  function resetFilters() {
    setFStatus(new Set())
    setFDiff(new Set())
    setFPerson(new Set())
    setFDate(new Set())
  }

  // Add / edit subject
  function openCreate() { setEditing(null); setEditorOpen(true) }
  function openEdit(s: Subject) { setEditing(s); setEditorOpen(true) }

  function handleSaved(saved: Subject, isNew: boolean) {
    setSubjects(prev => isNew ? [...prev, saved] : prev.map(s => s.id === saved.id ? saved : s))
    setEditorOpen(false)
    addToast(isNew ? t('toast.added') : t('toast.updated'), 'success')
  }

  // Delete subject
  const pendingSubject = pendingDeleteId ? subjects.find(s => s.id === pendingDeleteId) : null

  async function handleDelete() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    try {
      const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setSubjects(prev => prev.filter(s => s.id !== id))
      addToast(t('toast.deleted'), 'info')
    } catch {
      addToast(t('error.deleteFailed'), 'error')
    }
  }

  // Open paper
  function openPaper(id: string) {
    router.push(`/${locale}/${lab}/paper/${id}`)
  }

  // Drag-to-reorder (pointer events, window listeners)
  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (!canDrag || editMode) return
    dragIdRef.current = id
    dragStartPosRef.current = { x: e.clientX, y: e.clientY }
    didMoveRef.current = false
    orderRef.current = sorted(subjects, 'ordre').map(s => s.id)
    setDraggingId(id)
  }, [canDrag, editMode, subjects])

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragIdRef.current || !dragStartPosRef.current) return
      const dx = e.clientX - dragStartPosRef.current.x
      const dy = e.clientY - dragStartPosRef.current.y
      if (!didMoveRef.current && Math.sqrt(dx * dx + dy * dy) < 5) return
      didMoveRef.current = true

      // Find element under pointer (excluding the dragged card)
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      const targetEl = els.find(el =>
        el !== e.target &&
        el.closest('[data-subject-id]') !== null &&
        (el.closest('[data-subject-id]') as HTMLElement)?.dataset.subjectId !== dragIdRef.current
      )
      if (targetEl) {
        const targetWrapper = targetEl.closest('[data-subject-id]') as HTMLElement | null
        if (targetWrapper) {
          const targetId = targetWrapper.dataset.subjectId!
          const currentOrder = [...orderRef.current]
          const fromIdx = currentOrder.indexOf(dragIdRef.current!)
          const toIdx = currentOrder.indexOf(targetId)
          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            currentOrder.splice(fromIdx, 1)
            currentOrder.splice(toIdx, 0, dragIdRef.current!)
            orderRef.current = currentOrder
            // Reorder subjects in state visually
            setSubjects(prev => {
              const map = new Map(prev.map(s => [s.id, s]))
              const reordered = currentOrder.map((sid, i) => {
                const s = map.get(sid)
                if (!s) return null
                return { ...s, ordre: i }
              }).filter(Boolean) as Subject[]
              // Keep subjects not in orderRef (shouldn't happen) at the end
              return reordered
            })
          }
        }
      }
    }

    async function onPointerUp() {
      if (!dragIdRef.current) return
      const moved = didMoveRef.current
      const draggedId = dragIdRef.current
      const finalOrder = [...orderRef.current]

      dragIdRef.current = null
      dragStartPosRef.current = null
      didMoveRef.current = false
      setDraggingId(null)

      if (moved && finalOrder.length > 0) {
        // Persist reorder
        try {
          await fetch(`/api/subjects/${draggedId}/order`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds: finalOrder }),
          })
        } catch {
          // Silently fail — local state is already updated
        }
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  // Subject to delete title for confirm dialog
  const deleteTitle = pendingSubject?.titre ?? ''

  return (
    <>
      {/* Poster card CSS */}
      <style>{`
        .poster { transition: transform .18s cubic-bezier(.2,.7,.2,1); }
        .poster:hover { z-index: 50; }
        .poster:hover .poster-inner { transform: scale(1.4); box-shadow: 0 34px 70px -22px rgba(0,5,30,0.85); }
        .editing .poster:hover .poster-inner { transform: none; }
        .editing .poster { cursor: default; }
        .poster.dragging { z-index: 200; transition: none; }
        .poster.dragging .poster-inner { transform: none !important; box-shadow: 0 28px 64px -18px rgba(0,5,30,0.82) !important; }
      `}</style>

      <div style={{
        minHeight: 'calc(100vh - 6rem)',
        background: [
          'radial-gradient(110% 80% at 30% 10%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%)',
          'radial-gradient(120% 110% at 72% 110%, rgba(113,120,132,0.22) 0%, rgba(113,120,132,0) 60%)',
          'radial-gradient(140% 120% at 90% 46%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%)',
          '#F9F9FA',
        ].join(', '),
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Secondary toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px 14px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(20,40,90,0.1)',
        }}>
          {/* Left: title block */}
          <div>
            <div className="font-mono text-fame-text-muted" style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}>
              {t('kicker')}
            </div>
            <h1 className="font-serif text-fame-text-dark" style={{
              fontSize: 20,
              fontWeight: 600,
              margin: 0,
            }}>
              {t(`title.${lab}`)}
            </h1>
          </div>

          {/* Right cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search */}
            <input className="font-mono text-fame-text-dark"
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t('search')}
              aria-label={t('searchLabel')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(20,40,90,0.15)',
                background: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                width: 180,
                outline: 'none',
              }}
            />
            {/* Edit mode toggle — member only */}
            {canEdit && (
              <button className="font-mono"
                onClick={() => setEditMode(v => !v)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: editMode ? '1.5px solid #e8b149' : '1px solid rgba(20,40,90,0.15)',
                  background: editMode ? 'rgba(232,177,73,0.12)' : 'rgba(255,255,255,0.6)',
                  color: editMode ? '#b88c30' : '#6b7596',
                  fontSize: 10,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  transition: 'all 0.14s',
                }}
              >
                {editMode ? t('editModeOn') : t('editMode')}
              </button>
            )}
            {/* Add subject — member only */}
            {canEdit && (
              <button className="font-mono bg-fame-blue text-fame-text-light"
                onClick={openCreate}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 10,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                ＋ {t('addSubject')}
              </button>
            )}
            {/* Propose (visitor) link */}
            <Link className="font-mono"
              href={`/${locale}/${lab}/propose`}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(20,40,90,0.15)',
                color: '#6b7596',
                fontSize: 10,
                textDecoration: 'none',
                letterSpacing: '0.06em',
              }}
            >
              {t('proposeVisitor')}
            </Link>
          </div>
        </div>

        {/* Main content area: grid + sidebar */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          {/* Grid area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 24px 0' }}>
            {displaySubjects.length === 0 && (
              <div className="font-mono text-fame-text-muted" style={{ fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
                {t('empty')}
              </div>
            )}
            {(displaySubjects.length > 0 || canEdit) && (
              <div
                className={editMode ? 'editing' : ''}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: '30px 26px',
                  paddingBottom: 16,
                }}
              >
                {displaySubjects.map(s => (
                  <div
                    key={s.id}
                    data-subject-id={s.id}
                    style={{ position: 'relative' }}
                    onPointerDown={canDrag ? (e) => handlePointerDown(e, s.id) : undefined}
                  >
                    <SubjectVitrine
                      subject={s}
                      locale={toLocale2(locale)}
                      members={members}
                      editMode={editMode}
                      isDragging={draggingId === s.id}
                      statusLabel={t(`status.${s.statut}`)}
                      doneLabel={t('done')}
                      ficheLabel={t('vitrine.ficheLabel')}
                      questionLabel={t('vitrine.theQuestion')}
                      readLabel={t('vitrine.readSubject')}
                      transversalLabel={t('transversalBadge')}
                      deleteTitle={t('delete.confirm')}
                      editTitle={t('editor.editTitle')}
                      onDelete={canEdit && editMode ? () => setPendingDeleteId(s.id) : undefined}
                      onEdit={canEdit && editMode ? () => openEdit(s) : undefined}
                      onCardClick={!editMode ? () => openPaper(s.id) : undefined}
                    />
                  </div>
                ))}

                {canEdit && (
                  <button className="font-mono" onClick={openCreate}
                    style={{
                      aspectRatio: '1 / 1.414', width: '100%', borderRadius: 6,
                      border: '2px dashed rgba(47,68,134,0.35)', background: 'rgba(47,68,134,0.03)',
                      color: '#2f4486', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'fameFade 0.3s ease',
                    }}>
                    <span style={{ fontSize: 36, lineHeight: 1 }}>＋</span>
                    <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('vitrine.addCard')}</span>
                  </button>
                )}
              </div>
            )}
          </div>


          {/* Filter sidebar */}
          <FilterSidebar
            subjects={subjects}
            members={members}
            q={q}
            fStatus={fStatus}
            fDiff={fDiff}
            fPerson={fPerson}
            fDate={fDate}
            open={filtersOpen}
            onToggle={() => setFiltersOpen(v => !v)}
            onToggleStatus={toggleStatus}
            onToggleDiff={toggleDiff}
            onTogglePerson={togglePerson}
            onToggleDate={toggleDate}
            onReset={resetFilters}
          />
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          borderTop: '1px solid rgba(20,40,90,0.1)',
          flexShrink: 0,
        }}>
          {/* Left: count + sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="font-mono" style={{
               fontSize: 11, color: '#6b7596',
            }}>
              {t('count', { n: displaySubjects.length })}
            </span>
            <button className="font-mono"
              onClick={() => setSort(s => s === 'recent' ? 'oldest' : 'recent')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', cursor: 'pointer',
                 fontSize: 10,
                color: sort === 'ordre' ? 'rgba(90,100,140,0.45)' : '#5a6486',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 13 }}>{sort === 'oldest' ? '↑' : '↓'}</span>
              {sort === 'oldest' ? t('sortOldest') : t('sortRecent')}
            </button>
          </div>
          {/* Right: tasks link */}
          <Link className="font-mono"
            href={`/${locale}/${lab}/tasks`}
            style={{
               fontSize: 10,
              color: '#6b7596', textDecoration: 'none',
              letterSpacing: '0.06em',
            }}
          >
            {t('tasksLink')}
          </Link>
        </div>
      </div>

      {/* Subject editor (create + edit) */}
      {editorOpen && (
        <VitrineEditor
          key={editing?.id ?? 'new'}
          open
          lab={lab}
          members={members}
          subject={editing}
          locale={locale === 'fr' ? 'fr' : 'en'}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        message={t('delete.body', { title: deleteTitle })}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        danger
        confirmLabel={t('delete.confirm')}
        cancelLabel={t('delete.cancel')}
      />
    </>
  )
}
