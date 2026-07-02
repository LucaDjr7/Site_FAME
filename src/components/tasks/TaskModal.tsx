'use client'
import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { AssistButton } from '@/components/ui/AssistButton'
import { FORM_INPUT_STYLE, FORM_BTN_CANCEL_STYLE, FORM_BTN_SUBMIT_STYLE } from '@/components/ui/form-styles'
import { buildTaskFieldPrompt, type TaskAssistField } from '@/lib/tasks/field-prompts'
import { localizedTask, localizedSubtaskLabel } from '@/lib/tasks/localized'
import { DiffDots, DIFF_LEVEL, TASK_STATUS_COLOR, STATUS_KEY, ProgressBar, taskProgress } from './kanban-shared'
import type { TaskWithRelations, TaskStatus, Difficulty } from '@/types'

const STATUS_OPTS: TaskStatus[] = ['to-do', 'in-progress', 'done']
const DIFF_OPTS: Difficulty[] = ['easy', 'intermediate', 'advanced']

type Props = {
  task: TaskWithRelations | null
  subjectTitle: string
  isMember: boolean
  currentMemberId: string | null
  onClose: () => void
  onPatch: (taskId: string, fields: { statut?: TaskStatus; difficulte?: Difficulty; titre?: string; description?: string }) => void
  onToggleSubtask: (taskId: string, subtaskId: string, done: boolean) => void
  onClaim: (taskId: string) => void
}

const labelStyle: React.CSSProperties = {
   fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', marginBottom: 7,
}

export function TaskModal({ task, subjectTitle, isMember, currentMemberId, onClose, onPatch, onToggleSubtask, onClaim }: Props) {
  const t = useTranslations('tasks')
  const { addToast } = useToast()
  const locale = useLocale() === 'fr' ? 'fr' : 'en'
  const L = task ? localizedTask(task, locale) : { titre: '', description: '' }
  const [editing, setEditing] = useState(false)
  const [titre, setTitre] = useState(L.titre)
  const [description, setDescription] = useState(L.description)
  const [genField, setGenField] = useState<TaskAssistField | null>(null)
  const [promptField, setPromptField] = useState<string | null>(null)

  if (!task) return null

  const pct = taskProgress(task)
  const claimedByMe = !!currentMemberId && task.assignees.some(a => a.id === currentMemberId)
  const subs = task.subtasks ?? []

  const draft = () => ({ titre, description, labo: task.labo })
  async function generate(field: TaskAssistField, apply: (v: string) => void) {
    setGenField(field)
    try {
      const res = await fetch('/api/tasks/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, draft: draft(), locale }),
      })
      if (res.ok) {
        const d = await res.json() as { text?: string }
        if (d.text) apply(d.text)
        else addToast(t('editor.genError'), 'error') // réponse vide
      } else {
        addToast(t('editor.genError'), 'error')
      }
    } catch {
      addToast(t('editor.genError'), 'error')
    } finally { setGenField(null) }
  }
  function saveEdits() {
    onPatch(task!.id, { titre: titre.trim(), description: description.trim() })
    setEditing(false)
  }

  return (
    <Modal open={!!task} onClose={onClose}>
      {/* kicker = subject */}
      <div className="font-mono text-fame-slate" style={{
         fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {subjectTitle}
      </div>

      {/* Title — read or edit */}
      {isMember && editing ? (
        <div style={{ marginBottom: 18 }}>
          <input
            className="font-serif text-fame-text-dark"
            type="text"
            value={titre}
            onChange={e => setTitre(e.target.value)}
            style={{ ...FORM_INPUT_STYLE, fontSize: 18, fontWeight: 600 }}
          />
          <AssistButton
            generating={genField === 'titre'}
            busy={genField !== null}
            displayPrompt={buildTaskFieldPrompt('titre', draft(), locale).displayPrompt}
            showingPrompt={promptField === 'titre'}
            labels={{ generate: t('editor.generate'), generating: t('editor.generating'), viewPrompt: t('editor.viewPrompt'), hidePrompt: t('editor.hidePrompt'), copyPrompt: t('editor.copyPrompt') }}
            onGenerate={() => generate('titre', setTitre)}
            onTogglePrompt={() => setPromptField(p => p === 'titre' ? null : 'titre')}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
          <div className="font-serif text-fame-text-dark" style={{ fontSize: 18, fontWeight: 600 }}>
            {L.titre}
          </div>
          {isMember && (
            <button
              type="button"
              aria-label={t('editTitle')}
              onClick={() => { setTitre(L.titre); setDescription(L.description); setEditing(true) }}
              className="font-mono text-fame-text-muted"
              style={{ fontSize: 9, background: 'none', border: '1px solid rgba(87,104,172,0.3)', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {t('editTitle')}
            </button>
          )}
        </div>
      )}

      {/* Status */}
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono text-fame-slate" style={labelStyle}>{t('section.status')}</div>
        {isMember ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_OPTS.map(s => {
              const active = task.statut === s
              return (
                <button
                  className={`font-mono ${active ? 'text-fame-text-body' : 'text-fame-text-muted border-fame-ecru'}`}
                  key={s}
                  onClick={() => onPatch(task.id, { statut: s })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20,
                     fontSize: 10, cursor: 'pointer',
                    border: active ? `1.5px solid ${TASK_STATUS_COLOR[s]}` : '1px solid',
                    background: active ? 'rgba(47,68,134,0.08)' : 'transparent',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: TASK_STATUS_COLOR[s] }} />
                  {t(`status.${STATUS_KEY[s]}`)}
                </button>
              )
            })}
          </div>
        ) : (
          <span className="font-mono text-fame-text-body" style={{ display: 'inline-flex', alignItems: 'center', gap: 6,  fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TASK_STATUS_COLOR[task.statut] }} />
            {t(`status.${STATUS_KEY[task.statut]}`)}
          </span>
        )}
      </div>

      {/* Difficulty */}
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono text-fame-slate" style={labelStyle}>{t('section.difficulty')}</div>
        {isMember ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DIFF_OPTS.map(d => {
              const active = task.difficulte === d
              return (
                <button
                  className={`font-mono ${active ? 'text-fame-blue border-fame-blue' : 'text-fame-text-muted border-fame-ecru'}`}
                  key={d}
                  onClick={() => onPatch(task.id, { difficulte: d })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20,
                     fontSize: 10, cursor: 'pointer',
                    border: active ? '1.5px solid' : '1px solid',
                    background: active ? 'rgba(47,68,134,0.08)' : 'transparent',
                  }}
                >
                  <DiffDots level={DIFF_LEVEL[d] ?? 0} />
                  {t(`difficulty.${d}`)}
                </button>
              )
            })}
          </div>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <DiffDots level={DIFF_LEVEL[task.difficulte] ?? 0} />
            <span className="font-mono text-fame-text-body" style={{  fontSize: 10 }}>{t(`difficulty.${task.difficulte}`)}</span>
          </span>
        )}
      </div>

      {/* Progress (derived, read-only) */}
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono text-fame-slate" style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
          <span>{t('progress')}</span>
          <span>{pct}%</span>
        </div>
        <ProgressBar pct={pct} height={5} />
      </div>

      {/* Subtasks */}
      {subs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="font-mono text-fame-slate" style={labelStyle}>{t('subtasks')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {subs.map(s => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isMember ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={!isMember}
                  onChange={e => onToggleSubtask(task.id, s.id, e.target.checked)}
                  className="accent-fame-teal"
                />
                <span className={s.done ? 'text-fame-text-muted' : 'text-fame-text-body'} style={{ fontSize: 13, textDecoration: s.done ? 'line-through' : 'none' }}>
                  {localizedSubtaskLabel(s, locale)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Positioning */}
      <div style={{ marginBottom: 16 }}>
        <div className="font-mono text-fame-slate" style={labelStyle}>{t('positioning')}</div>
        {task.assignees.length > 0 ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: isMember ? 8 : 0 }}>
            {task.assignees.map(a => (
              <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Avatar name={`${a.prenom} ${a.nom}`} photoUrl={a.photo_url} size={22} />
                <span className="text-fame-text-body" style={{ fontSize: 12 }}>{a.prenom}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="font-mono text-fame-text-muted" style={{  fontSize: 11, marginBottom: isMember ? 8 : 0 }}>
            {t('noAssignees')}
          </div>
        )}
        {isMember && (
          <button className="font-mono text-fame-blue"
            onClick={() => onClaim(task.id)}
            style={{
               fontSize: 10, background: 'none',
              border: '1px solid rgba(47,68,134,0.35)', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >
            {claimedByMe ? t('unclaimTask') : t('claimTask')}
          </button>
        )}
      </div>

      {/* Description — read or edit */}
      {isMember && editing ? (
        <div>
          <div className="font-mono text-fame-slate" style={labelStyle}>{t('section.description')}</div>
          <textarea
            className="font-mono"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            style={{ ...FORM_INPUT_STYLE, resize: 'vertical' }}
          />
          <AssistButton
            generating={genField === 'description'}
            busy={genField !== null}
            displayPrompt={buildTaskFieldPrompt('description', draft(), locale).displayPrompt}
            showingPrompt={promptField === 'description'}
            labels={{ generate: t('editor.generate'), generating: t('editor.generating'), viewPrompt: t('editor.viewPrompt'), hidePrompt: t('editor.hidePrompt'), copyPrompt: t('editor.copyPrompt') }}
            onGenerate={() => generate('description', setDescription)}
            onTogglePrompt={() => setPromptField(p => p === 'description' ? null : 'description')}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={() => setEditing(false)} className="font-mono" style={FORM_BTN_CANCEL_STYLE}>
              {t('editor.cancel')}
            </button>
            <button type="button" onClick={saveEdits} className="font-mono" style={{ ...FORM_BTN_SUBMIT_STYLE, cursor: 'pointer' }}>
              {t('editor.save')}
            </button>
          </div>
        </div>
      ) : (
        L.description ? (
          <div>
            <div className="font-mono text-fame-slate" style={labelStyle}>{t('section.description')}</div>
            <p className="text-fame-text-body" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{L.description}</p>
          </div>
        ) : null
      )}
    </Modal>
  )
}
