'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { FORM_INPUT_STYLE, FORM_LABEL_STYLE, FORM_BTN_CANCEL_STYLE, FORM_BTN_SUBMIT_STYLE } from '@/components/ui/form-styles'
import type { MemberRef, TaskStatus, Difficulty, Lab } from '@/types'

type PillProps<T extends string> = { value: T; current: T; label: string; onChange: (v: T) => void }
function Pill<T extends string>({ value, current, label, onChange }: PillProps<T>) {
  const active = value === current
  return (
    <button className="font-mono"
      type="button"
      onClick={() => onChange(value)}
      style={{
        padding: '4px 10px', borderRadius: 20, fontSize: 10,  cursor: 'pointer',
        border: active ? '1.5px solid #2f4486' : '1px solid #eceadf',
        background: active ? 'rgba(47,68,134,0.1)' : 'transparent',
        color: active ? '#2f4486' : '#7e95d6', transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  )
}

type Props = {
  open: boolean
  lab: Lab
  subjectId: string | null
  members: MemberRef[]
  onClose: () => void
  onAdded: () => void
}

const inputStyle = FORM_INPUT_STYLE
const labelStyle = FORM_LABEL_STYLE

export function AddTaskModal({ open, lab, subjectId, members, onClose, onAdded }: Props) {
  const t = useTranslations('tasks')
  const [titre, setTitre] = useState('')
  const [statut, setStatut] = useState<TaskStatus>('to-do')
  const [difficulte, setDifficulte] = useState<Difficulty>('easy')
  const [assignee, setAssignee] = useState('')
  const [description, setDescription] = useState('')
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setTitre(''); setStatut('to-do'); setDifficulte('easy'); setAssignee('')
    setDescription(''); setSubtasks([]); setSubtaskDraft(''); setError('')
  }
  function handleClose() { reset(); onClose() }

  function addSubtaskDraft() {
    const v = subtaskDraft.trim()
    if (!v) return
    setSubtasks(prev => [...prev, v])
    setSubtaskDraft('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) { setError(t('modal.error')); return }
    if (!subjectId) { setError(t('modal.error')); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labo: lab,
          titre: titre.trim(),
          sujet_id: subjectId,
          statut,
          difficulte,
          description: description.trim(),
          assignee_ids: assignee ? [assignee] : [],
          subtask_labels: subtasks,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error ?? t('modal.error'))
        return
      }
      reset()
      onAdded()
    } catch {
      setError(t('modal.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="font-serif" style={{  fontSize: 18, fontWeight: 600, color: '#15203f', marginBottom: 18 }}>
          {t('modal.title')}
        </div>

        {/* Titre */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-task-title" className="font-mono" style={labelStyle}>{t('modal.fTitle')} *</label>
          <input className="font-mono" id="add-task-title" type="text" value={titre} onChange={e => setTitre(e.target.value)} placeholder={t('modal.fTitle')} style={inputStyle} autoFocus />
        </div>

        {/* Statut */}
        <div style={{ marginBottom: 14 }}>
          <label className="font-mono" style={labelStyle}>{t('modal.fStatus')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['to-do', 'in-progress', 'done'] as TaskStatus[]).map(s => (
              <Pill key={s} value={s} current={statut} label={t(`status.${s === 'to-do' ? 'todo' : s === 'in-progress' ? 'inProgress' : 'done'}`)} onChange={setStatut} />
            ))}
          </div>
        </div>

        {/* Difficulté */}
        <div style={{ marginBottom: 14 }}>
          <label className="font-mono" style={labelStyle}>{t('modal.fDifficulty')}</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['easy', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
              <Pill key={d} value={d} current={difficulte} label={t(`difficulty.${d}`)} onChange={setDifficulte} />
            ))}
          </div>
        </div>

        {/* Assigné à */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-task-assignee" className="font-mono" style={labelStyle}>{t('modal.fAssignee')}</label>
          <select className="font-mono" id="add-task-assignee" value={assignee} onChange={e => setAssignee(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
            <option value="">{t('modal.none')}</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
          </select>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-task-description" className="font-mono" style={labelStyle}>{t('modal.fDescription')}</label>
          <textarea className="font-mono" id="add-task-description" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('modal.fDescription')} rows={3}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {/* Sous-tâches */}
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="add-task-subtask-input" className="font-mono" style={labelStyle}>{t('modal.fSubtasks')}</label>
          {subtasks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {subtasks.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 12, color: '#2a3457' }}>{s}</span>
                  <button type="button" onClick={() => setSubtasks(prev => prev.filter((_, j) => j !== i))}
                    aria-label={t('delete.confirm')}
                    style={{ background: 'none', border: 'none', color: '#c0473b', cursor: 'pointer', fontSize: 13 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="font-mono"
              id="add-task-subtask-input"
              type="text" value={subtaskDraft} onChange={e => setSubtaskDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtaskDraft() } }}
              placeholder={t('modal.subtaskPlaceholder')} style={inputStyle}
            />
            <button className="font-mono" type="button" onClick={addSubtaskDraft}
              style={{ padding: '7px 12px', borderRadius: 5, border: '1px solid #eceadf', background: 'transparent',
                 fontSize: 11, color: '#2f4486', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {t('modal.addSubtask')}
            </button>
          </div>
        </div>

        {error && (
          <div className="font-mono" style={{  fontSize: 11, color: '#c0473b', marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleClose} className="font-mono" style={FORM_BTN_CANCEL_STYLE}>
            {t('modal.cancel')}
          </button>
          <button type="submit" disabled={submitting}
            className="font-mono" style={{ ...FORM_BTN_SUBMIT_STYLE, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {t('modal.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
