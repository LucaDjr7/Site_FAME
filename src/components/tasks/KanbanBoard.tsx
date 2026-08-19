'use client'
import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { Subject, TaskWithRelations, MemberRef, Lab, TaskStatus, Difficulty, DateBucket } from '@/types'
import { KanbanColumn } from './KanbanColumn'
import { TaskModal } from './TaskModal'
import { AddTaskModal } from './AddTaskModal'
import { AddSubjectModal } from './AddSubjectModal'
import { TaskFilterSidebar } from './TaskFilterSidebar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { flattenTasks } from './kanban-shared'
import { dateBucket } from '@/lib/utils'
import { apiFetch } from '@/lib/api-fetch'
import { localizedSubject, toLocale2 } from '@/lib/subjects/localized'
import { localizedTask } from '@/lib/tasks/localized'

type Props = {
  lab: Lab
  locale: string
  subjects: Subject[]
  initialTasks: TaskWithRelations[]
  members: MemberRef[]
  isMember: boolean
  currentMemberId: string | null
}

export function KanbanBoard({ lab, locale, subjects, initialTasks, members, isMember, currentMemberId }: Props) {
  const t = useTranslations('tasks')
  const loc = toLocale2(locale)
  const { addToast } = useToast()

  // This page has a bottom toolbar above the footer; lift the global assistant
  // bubble above it (matches the subjects page).
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--fame-bubble-bottom', '100px')
    return () => { root.style.removeProperty('--fame-bubble-bottom') }
  }, [])

  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks)
  const [subjectsState, setSubjectsState] = useState<Subject[]>(subjects)
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false)
  const [q, setQ] = useState('')
  const [fSubject, setFSubject] = useState<Set<string>>(new Set())
  const [fStatus, setFStatus] = useState<Set<TaskStatus>>(new Set())
  const [fDiff, setFDiff] = useState<Set<Difficulty>>(new Set())
  const [fPerson, setFPerson] = useState<Set<string>>(new Set())
  const [fDate, setFDate] = useState<Set<DateBucket>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [addSubjectId, setAddSubjectId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function refresh() {
    // Rafraîchir par les ids des sujets affichés sur le tableau (show_in_tasks),
    // pas par ?lab — sinon les tâches des sujets transversaux de l'autre labo disparaissent.
    const ids = subjectsState.filter(s => s.show_in_tasks).map(s => s.id)
    if (ids.length === 0) { setTasks([]); return }
    const res = await fetch(`/api/tasks?subject_ids=${ids.join(',')}`)
    if (!res.ok) return
    const raw = await res.json()
    setTasks(flattenTasks(raw))
  }

  async function handleAddSubject(subjectId: string) {
    const result = await apiFetch<unknown>(`/api/subjects/${subjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_in_tasks: true }),
    }, (msg) => addToast(msg, 'error'), t('toast.error'))
    if (result === null) return
    setSubjectsState(prev => prev.map(s => s.id === subjectId ? { ...s, show_in_tasks: true } : s))
    setAddSubjectModalOpen(false)
    await refresh()
  }

  async function handleRemoveSubject(subjectId: string) {
    const result = await apiFetch<unknown>(`/api/subjects/${subjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_in_tasks: false }),
    }, (msg) => addToast(msg, 'error'), t('toast.error'))
    if (result === null) return
    setSubjectsState(prev => prev.map(s => s.id === subjectId ? { ...s, show_in_tasks: false } : s))
    setTasks(prev => prev.filter(tk => tk.sujet_id !== subjectId))
  }

  async function handleClaim(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}/claim`, { method: 'POST' })
    if (!res.ok) { addToast(t('toast.error'), 'error'); return }
    const body = await res.json().catch(() => ({}))
    await refresh()
    addToast((body as { claimed?: boolean }).claimed ? t('toast.claimed') : t('toast.unclaimed'), 'info')
  }

  async function handlePatch(taskId: string, fields: { statut?: TaskStatus; difficulte?: Difficulty; titre?: string; description?: string }) {
    const result = await apiFetch<unknown>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }, (msg) => addToast(msg, 'error'), t('toast.error'))
    if (result === null) return
    await refresh()
  }

  async function handleToggleSubtask(taskId: string, subtaskId: string, done: boolean) {
    const result = await apiFetch<unknown>(`/api/tasks/${taskId}/subtasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtask_id: subtaskId, done }),
    }, (msg) => addToast(msg, 'error'), t('toast.error'))
    if (result === null) return
    await refresh()
  }

  async function handleDelete() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      await refresh()
      addToast(t('toast.deleted'), 'info')
    } catch {
      addToast(t('toast.error'), 'error')
    }
  }

  function toggle<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, v: T) {
    setter(prev => {
      const n = new Set(prev)
      if (n.has(v)) n.delete(v); else n.add(v)
      return n
    })
  }
  function resetFilters() {
    setFSubject(new Set()); setFStatus(new Set()); setFDiff(new Set()); setFPerson(new Set()); setFDate(new Set())
  }

  const filtered = useMemo(() => tasks.filter(tk => {
    if (q) {
      const needle = q.toLowerCase()
      if (!tk.titre.toLowerCase().includes(needle) && !localizedTask(tk, loc).titre.toLowerCase().includes(needle)) return false
    }
    if (hideDone && tk.statut === 'done') return false
    if (fSubject.size > 0 && !fSubject.has(tk.sujet_id)) return false
    if (fStatus.size > 0 && !fStatus.has(tk.statut)) return false
    if (fDiff.size > 0 && !fDiff.has(tk.difficulte)) return false
    if (fPerson.size > 0 && !tk.assignees.some(a => fPerson.has(a.id))) return false
    if (fDate.size > 0 && !fDate.has(dateBucket(tk.date_creation ?? ''))) return false
    return true
  }), [tasks, q, hideDone, fSubject, fStatus, fDiff, fPerson, fDate, loc])

  const displayedSubjects = subjectsState.filter(s => s.show_in_tasks)
  const hiddenSubjects = subjectsState.filter(s => !s.show_in_tasks)
  const visibleSubjects = displayedSubjects.filter(s => fSubject.size === 0 || fSubject.has(s.id))
  const totalCount = filtered.length
  const openCount = filtered.filter(tk => tk.assignees.length === 0).length
  const selectedTask = tasks.find(tk => tk.id === selectedTaskId) ?? null
  const selectedSubject = selectedTask ? subjectsState.find(s => s.id === selectedTask.sujet_id) : undefined
  const selectedSubjectTitle = selectedSubject ? localizedSubject(selectedSubject, loc).titre : ''

  return (
    <>
      <div style={{
        height: 'calc(100vh - 6rem)',
        background: [
          'radial-gradient(110% 80% at 20% 12%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%)',
          'radial-gradient(120% 110% at 80% 110%, rgba(113,120,132,0.22) 0%, rgba(113,120,132,0) 60%)',
          'radial-gradient(140% 120% at 14% 48%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%)',
          '#F9F9FA',
        ].join(', '),
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Secondary toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 12px', flexShrink: 0, borderBottom: '1px solid rgba(20,40,90,0.1)' }}>
          <div>
            <div className="font-mono text-fame-text-muted" style={{
               fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
              marginBottom: 3,
            }}>
              {t('kicker')}
            </div>
            <h1 className="font-serif text-fame-text-dark" style={{  fontSize: 20, fontWeight: 600, margin: 0 }}>
              {t('pageTitle')}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input className="font-mono text-fame-text-body border-fame-ecru"
              type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('search')} aria-label={t('searchLabel')}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid', background: '#fff',
                 fontSize: 11, width: 180, outline: 'none',
              }}
            />
            {isMember && (
              <button className="font-mono"
                onClick={() => setEditMode(v => !v)}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: editMode ? '1.5px solid #e8b149' : '1px solid #eceadf',
                  background: editMode ? 'rgba(232,177,73,0.15)' : '#fff',
                  color: editMode ? '#b9852a' : '#7e95d6',
                   fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em',
                }}
              >
                {editMode ? t('editModeOn') : t('editMode')}
              </button>
            )}
          </div>
        </div>

        {/* Board + sidebar */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '18px 28px 0', display: 'flex', gap: 22, alignItems: 'stretch' }}>
            {visibleSubjects.length === 0 && (
              <div className="font-mono text-fame-text-muted" style={
                isMember
                  ? { fontSize: 13, alignSelf: 'center', flexShrink: 0, marginRight: 22 }
                  : { fontSize: 13, margin: 'auto' }
              }>
                {t('empty')}
              </div>
            )}
            {visibleSubjects.map(s => (
              <KanbanColumn
                key={s.id}
                subject={s}
                tasks={filtered.filter(tk => tk.sujet_id === s.id)}
                isMember={isMember}
                currentMemberId={currentMemberId}
                editMode={editMode}
                onOpenTask={tk => setSelectedTaskId(tk.id)}
                onClaim={handleClaim}
                onDeleteTask={id => setPendingDeleteId(id)}
                onAddTask={id => setAddSubjectId(id)}
                onRemoveSubject={handleRemoveSubject}
              />
            ))}
            {isMember && (
              <button className="font-mono"
                onClick={() => setAddSubjectModalOpen(true)}
                style={{
                  flexShrink: 0, width: 300, alignSelf: 'stretch', borderRadius: 10,
                  border: '2px dashed rgba(47,68,134,0.35)', background: 'rgba(47,68,134,0.03)',
                  color: '#2f4486', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>＋</span>
                <span style={{  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {t('addSubject')}
                </span>
              </button>
            )}
          </div>

          <TaskFilterSidebar
            subjects={displayedSubjects}
            tasks={tasks}
            members={members}
            q={q}
            fSubject={fSubject}
            fStatus={fStatus}
            fDiff={fDiff}
            fPerson={fPerson}
            fDate={fDate}
            open={filtersOpen}
            onToggle={() => setFiltersOpen(v => !v)}
            onToggleSubject={v => toggle(setFSubject, v)}
            onToggleStatus={v => toggle(setFStatus, v)}
            onToggleDiff={v => toggle(setFDiff, v)}
            onTogglePerson={v => toggle(setFPerson, v)}
            onToggleDate={v => toggle(setFDate, v)}
            onReset={resetFilters}
          />
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 24px',
          borderTop: '1px solid rgba(20,40,90,0.1)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="font-mono" style={{  fontSize: 11, color: '#6b7596' }}>
              {t('countTasks', { n: totalCount })} · {t('countOpen', { n: openCount })}
            </span>
            <button className={`font-mono ${hideDone ? 'text-fame-blue' : ''}`}
              onClick={() => setHideDone(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer',
                 fontSize: 10, color: hideDone ? undefined : 'rgba(87,104,172,0.7)', padding: 0,
              }}
            >
              <span style={{ fontSize: 12 }}>{hideDone ? '☑' : '☐'}</span>
              {t('hideCompleted')}
            </button>
          </div>
          <Link className="font-mono text-fame-slate"
            href={`/${locale}/${lab}`}
            style={{  fontSize: 10, textDecoration: 'none', letterSpacing: '0.06em' }}
          >
            {t('subjectsLink')}
          </Link>
        </div>
      </div>

      <TaskModal
        task={selectedTask}
        subjectTitle={selectedSubjectTitle}
        isMember={isMember}
        currentMemberId={currentMemberId}
        onClose={() => setSelectedTaskId(null)}
        onPatch={handlePatch}
        onToggleSubtask={handleToggleSubtask}
        onClaim={handleClaim}
      />

      <AddTaskModal
        open={addSubjectId !== null}
        lab={lab}
        subjectId={addSubjectId}
        members={members}
        onClose={() => setAddSubjectId(null)}
        onAdded={() => { setAddSubjectId(null); refresh(); addToast(t('toast.added'), 'success') }}
      />

      <AddSubjectModal
        open={addSubjectModalOpen}
        subjects={hiddenSubjects}
        onClose={() => setAddSubjectModalOpen(false)}
        onAdd={handleAddSubject}
      />

      <ConfirmDialog
        open={!!pendingDeleteId}
        message={t('delete.body')}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        danger
        confirmLabel={t('delete.confirm')}
        cancelLabel={t('delete.cancel')}
      />
    </>
  )
}
