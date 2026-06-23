'use client'
import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { Subject, TaskWithRelations, MemberRef, Lab, TaskStatus, Difficulty } from '@/types'
import { KanbanColumn } from './KanbanColumn'
import { TaskModal } from './TaskModal'
import { AddTaskModal } from './AddTaskModal'
import { TaskFilterSidebar } from './TaskFilterSidebar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { flattenTasks } from './kanban-shared'

type DateBucket = '2025' | '2024' | 'older'

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
  const { addToast } = useToast()

  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks)
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
    const res = await fetch(`/api/tasks?lab=${lab}`)
    if (!res.ok) return
    const raw = await res.json()
    setTasks(flattenTasks(raw))
  }

  async function handleClaim(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}/claim`, { method: 'POST' })
    if (!res.ok) { addToast(t('toast.error'), 'error'); return }
    const body = await res.json().catch(() => ({}))
    await refresh()
    addToast((body as { claimed?: boolean }).claimed ? t('toast.claimed') : t('toast.unclaimed'), 'info')
  }

  async function handlePatch(taskId: string, fields: { statut?: TaskStatus; difficulte?: Difficulty }) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (!res.ok) { addToast(t('toast.error'), 'error'); return }
    await refresh()
  }

  async function handleToggleSubtask(taskId: string, subtaskId: string, done: boolean) {
    const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtask_id: subtaskId, done }),
    })
    if (!res.ok) { addToast(t('toast.error'), 'error'); return }
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

  function bucket(t2: TaskWithRelations): DateBucket {
    const y = (t2.date_creation ?? '').slice(0, 4)
    if (y === '2025') return '2025'
    if (y === '2024') return '2024'
    return 'older'
  }

  const filtered = useMemo(() => tasks.filter(tk => {
    if (q && !tk.titre.toLowerCase().includes(q.toLowerCase())) return false
    if (hideDone && tk.statut === 'done') return false
    if (fSubject.size > 0 && !fSubject.has(tk.sujet_id)) return false
    if (fStatus.size > 0 && !fStatus.has(tk.statut)) return false
    if (fDiff.size > 0 && !fDiff.has(tk.difficulte)) return false
    if (fPerson.size > 0 && !tk.assignees.some(a => fPerson.has(a.id))) return false
    if (fDate.size > 0 && !fDate.has(bucket(tk))) return false
    return true
  }), [tasks, q, hideDone, fSubject, fStatus, fDiff, fPerson, fDate])

  const visibleSubjects = subjects.filter(s => fSubject.size === 0 || fSubject.has(s.id))
  const totalCount = filtered.length
  const openCount = filtered.filter(tk => tk.assignees.length === 0).length
  const selectedTask = tasks.find(tk => tk.id === selectedTaskId) ?? null
  const selectedSubjectTitle = selectedTask ? (subjects.find(s => s.id === selectedTask.sujet_id)?.titre ?? '') : ''

  return (
    <>
      <div style={{ height: 'calc(100vh - 3rem)', background: '#f4f3ee', display: 'flex', flexDirection: 'column' }}>
        {/* Secondary toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 12px', flexShrink: 0 }}>
          <div>
            <div style={{
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#5768ac', marginBottom: 3,
            }}>
              {t('kicker')}
            </div>
            <h1 style={{ fontFamily: 'Roboto Slab, Georgia, serif', fontSize: 20, fontWeight: 600, color: '#15203f', margin: 0 }}>
              {t('pageTitle')}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('search')}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #eceadf', background: '#fff',
                color: '#2a3457', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, width: 180, outline: 'none',
              }}
            />
            {isMember && (
              <button
                onClick={() => setEditMode(v => !v)}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: editMode ? '1.5px solid #e8b149' : '1px solid #eceadf',
                  background: editMode ? 'rgba(232,177,73,0.15)' : '#fff',
                  color: editMode ? '#b9852a' : '#7e95d6',
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, cursor: 'pointer', letterSpacing: '0.06em',
                }}
              >
                {editMode ? t('editModeOn') : t('editMode')}
              </button>
            )}
          </div>
        </div>

        {/* Board + sidebar */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '6px 24px 0', display: 'flex', gap: 18, alignItems: 'stretch' }}>
            {visibleSubjects.length === 0 ? (
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 13, color: '#7e95d6', margin: 'auto' }}>
                {t('empty')}
              </div>
            ) : (
              visibleSubjects.map(s => (
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
                />
              ))
            )}
          </div>

          <TaskFilterSidebar
            subjects={subjects}
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
          borderTop: '1px solid rgba(87,104,172,0.2)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#5768ac' }}>
              {t('countTasks', { n: totalCount })} · {t('countOpen', { n: openCount })}
            </span>
            <button
              onClick={() => setHideDone(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: hideDone ? '#2f4486' : 'rgba(87,104,172,0.7)', padding: 0,
              }}
            >
              <span style={{ fontSize: 12 }}>{hideDone ? '☑' : '☐'}</span>
              {t('hideCompleted')}
            </button>
          </div>
          <a
            href={`/${locale}/${lab}`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, color: '#5768ac', textDecoration: 'none', letterSpacing: '0.06em' }}
          >
            {t('subjectsLink')}
          </a>
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
