'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Prompt, PromptTarget } from '@/types'
import { TARGET_META, TARGET_ORDER } from './prompt-shared'

type Props = {
  prompt: Prompt
  onSaved: (p: Prompt) => void
  onDeleted: (id: string) => void
  onCopied: () => void
  startEditing?: boolean
}

export function PromptCard({ prompt, onSaved, onDeleted, onCopied, startEditing = false }: Props) {
  const t = useTranslations('prompts')
  const [editing, setEditing] = useState(startEditing)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editTitre, setEditTitre] = useState(prompt.titre)
  const [editTypeCible, setEditTypeCible] = useState<PromptTarget>(prompt.type_cible)
  const [editTexte, setEditTexte] = useState(prompt.texte)
  const [editTransversal, setEditTransversal] = useState(prompt.is_transversal)

  const meta = TARGET_META[prompt.type_cible]

  function startEdit() {
    setEditTitre(prompt.titre)
    setEditTypeCible(prompt.type_cible)
    setEditTexte(prompt.texte)
    setEditTransversal(prompt.is_transversal)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt.texte)
    onCopied()
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: editTitre, type_cible: editTypeCible, texte: editTexte, is_transversal: editTransversal }),
      })
      if (res.ok) {
        const updated: Prompt = await res.json()
        setEditing(false)
        onSaved(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setConfirmOpen(false)
    const res = await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(prompt.id)
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 11,
    boxShadow:
      '0 20px 50px -28px rgba(0,5,30,0.45), inset 0 0 0 1px rgba(0,0,0,0.05)',
    overflow: 'hidden',
  }

  const iconBtnStyle = (danger = false): React.CSSProperties => ({
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: danger ? '1px solid rgba(220,68,55,0.2)' : '1px solid rgba(20,40,90,0.14)',
    background: '#fff',
    color: danger ? undefined : '#3a4d86',
    fontSize: danger ? 15 : 13,
    cursor: 'pointer',
    flexShrink: 0,
  })

  const inputStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid rgba(20,40,90,0.18)',
    borderRadius: 8,
    padding: '8px 11px',
    fontFamily: 'inherit',
    fontSize: 13,
    color: '#18244c',
    outline: 'none',
  }

  if (editing) {
    return (
      <>
        <div className="bg-fame-sand" style={cardStyle}>
          {/* Edit header */}
          <div
            style={{
              padding: '16px 18px 12px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <input
              value={editTitre}
              onChange={e => setEditTitre(e.target.value)}
              placeholder={t('titlePlaceholder')}
              style={{ ...inputStyle, flex: 1, minWidth: 200, fontSize: 14, fontWeight: 600 }}
            />
            <select className="font-mono"
              value={editTypeCible}
              onChange={e => setEditTypeCible(e.target.value as PromptTarget)}
              style={{ ...inputStyle, cursor: 'pointer',  fontSize: 12 }}
            >
              {TARGET_ORDER.map(tc => (
                <option key={tc} value={tc}>
                  {t(`types.${TARGET_META[tc].i18nKey}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          </div>

          {/* Edit body */}
          <div style={{ padding: '14px 18px 16px' }}>
            <textarea className="font-mono"
              value={editTexte}
              onChange={e => setEditTexte(e.target.value)}
              rows={8}
              placeholder={t('bodyPlaceholder')}
              style={{
                ...inputStyle,
                width: '100%',
                borderRadius: 9,
                padding: '12px 13px',
                fontSize: 12.5,
                lineHeight: 1.65,
                color: '#1f2a4d',
                minHeight: 150,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <label className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer',  fontSize: 11, color: '#5a6486' }}>
              <input type="checkbox" checked={editTransversal} onChange={e => setEditTransversal(e.target.checked)} />
              {t('transversalLabel')}
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className="font-mono"
                onClick={cancelEdit}
                style={{
                  padding: '9px 16px',
                  borderRadius: 9,
                  border: '1px solid rgba(20,40,90,0.16)',
                  background: '#fff',
                  color: '#5a6486',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
              <button className="font-serif bg-fame-blue text-fame-text-light"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '9px 18px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 12px 28px -14px rgba(47,68,134,0.7)',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          message={t('confirmDelete')}
          danger
          confirmLabel={t('delete')}
          onConfirm={handleDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      </>
    )
  }

  // View state
  return (
    <>
      <div className="bg-fame-sand" style={cardStyle}>
        {/* Card header */}
        <div
          style={{
            padding: '16px 18px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Target badge */}
            <div className="font-mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: meta.color,
                background: meta.color + '14',
                border: `1px solid ${meta.color}33`,
                borderRadius: 20,
                padding: '4px 9px',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: meta.color,
                  flexShrink: 0,
                }}
              />
              {t(`types.${meta.i18nKey}` as Parameters<typeof t>[0])}
            </div>
            {prompt.is_transversal && (
              <span className="font-mono text-fame-teal" style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginLeft: 7,
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                background: 'rgba(30,155,126,0.08)',
                border: '1px solid rgba(30,155,126,0.2)',
                borderRadius: 20,
                padding: '4px 9px',
              }}>
                {t('transversalBadge')}
              </span>
            )}
            <h3 className="font-serif"
              style={{
                margin: '9px 0 0',
                fontSize: 16.5,
                fontWeight: 700,
                color: '#18244c',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              {prompt.titre}
            </h3>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleCopy}
              title={t('copy')}
              style={iconBtnStyle()}
            >
              ⧉
            </button>
            <button
              onClick={startEdit}
              title={t('edit')}
              style={iconBtnStyle()}
            >
              ✎
            </button>
            <button
              className="text-fame-red"
              onClick={() => setConfirmOpen(true)}
              title={t('delete')}
              style={iconBtnStyle(true)}
            >
              ×
            </button>
          </div>
        </div>

        {/* Card body */}
        <div className="font-mono" style={{ padding: '14px 18px 16px' }}>
          <pre
            className="text-fame-text-body"
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12.5,
              lineHeight: 1.7,
            }}
          >
            {prompt.texte}
          </pre>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        message={t('confirmDelete')}
        danger
        confirmLabel={t('delete')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
