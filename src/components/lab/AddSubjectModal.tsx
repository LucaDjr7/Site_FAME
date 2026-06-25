'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { MemberRef, SubjectStatus, Difficulty, Lab, Subject } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { FORM_INPUT_STYLE, FORM_LABEL_STYLE, FORM_BTN_CANCEL_STYLE, FORM_BTN_SUBMIT_STYLE } from '@/components/ui/form-styles'

type PillBtnProps<T extends string> = {
  value: T
  current: T
  label: string
  onChange: (v: T) => void
}

function PillBtn<T extends string>({ value, current, label, onChange }: PillBtnProps<T>) {
  const active = value === current
  return (
    <button className="font-mono"
      type="button"
      onClick={() => onChange(value)}
      style={{
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 10,
        cursor: 'pointer',
        border: active ? '1.5px solid #2f4486' : '1px solid #eceadf',
        background: active ? 'rgba(47,68,134,0.1)' : 'transparent',
        color: active ? '#2f4486' : '#7e95d6',
        transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  )
}

type Props = {
  open: boolean
  lab: Lab
  members: MemberRef[]
  onClose: () => void
  onAdded: (subject: Subject) => void
}

export function AddSubjectModal({ open, lab, members, onClose, onAdded }: Props) {
  const t = useTranslations('lab')

  const [titre, setTitre] = useState('')
  const [kicker, setKicker] = useState('')
  const [responsable, setResponsable] = useState('')
  const [statut, setStatut] = useState<SubjectStatus>('active')
  const [difficulte, setDifficulte] = useState<Difficulty>('intermediate')
  const [context, setContext] = useState('')
  const [isTransversal, setIsTransversal] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setTitre('')
    setKicker('')
    setResponsable('')
    setStatut('active')
    setDifficulte('intermediate')
    setContext('')
    setIsTransversal(false)
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || !kicker.trim()) {
      setError(t('modal.error'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const body = {
        labo: lab,
        titre: titre.trim(),
        kicker: kicker.trim(),
        statut,
        difficulte,
        context: context.trim(),
        auteurs: responsable ? [responsable] : [],
        is_transversal: isTransversal,
      }
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error ?? t('error.server'))
        return
      }
      const created = (await res.json()) as Subject
      onAdded(created)
      reset()
    } catch {
      setError(t('error.network'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = FORM_INPUT_STYLE
  const labelStyle = FORM_LABEL_STYLE

  const btnGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <form onSubmit={handleSubmit} noValidate>
        {/* Kicker */}
        <div className="font-mono" style={{
           fontSize: 8,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5768ac',
          marginBottom: 6,
        }}>
          {t('modal.newSubjectKicker')}
        </div>
        <div className="font-serif" style={{
          fontSize: 18, fontWeight: 600, color: '#15203f', marginBottom: 20,
        }}>
          {t('modal.title')}
        </div>

        {/* Titre */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-subject-title" className="font-mono" style={labelStyle}>{t('modal.fTitle')} *</label>
          <input className="font-mono"
            id="add-subject-title"
            type="text"
            value={titre}
            onChange={e => setTitre(e.target.value)}
            placeholder={t('modal.fTitle')}
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Domaine / kicker */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-subject-domain" className="font-mono" style={labelStyle}>{t('modal.fDomain')} *</label>
          <input className="font-mono"
            id="add-subject-domain"
            type="text"
            value={kicker}
            onChange={e => setKicker(e.target.value)}
            placeholder={t('modal.fDomain')}
            style={inputStyle}
          />
        </div>

        {/* Responsable */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-subject-responsable" className="font-mono" style={labelStyle}>{t('modal.fResponsable')}</label>
          <select
            className="font-mono"
            id="add-subject-responsable"
            value={responsable}
            onChange={e => setResponsable(e.target.value)}
            style={{ ...inputStyle, appearance: 'none' }}
          >
            <option value="">{t('modal.none')}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
            ))}
          </select>
        </div>

        {/* Statut */}
        <div style={{ marginBottom: 14 }}>
          <label className="font-mono" style={labelStyle}>{t('modal.fStatus')}</label>
          <div style={btnGroupStyle}>
            {(['active', 'on-hold', 'done'] as SubjectStatus[]).map(s => (
              <PillBtn key={s} value={s} current={statut} label={t(`status.${s}`)} onChange={setStatut} />
            ))}
          </div>
        </div>

        {/* Difficulté */}
        <div style={{ marginBottom: 14 }}>
          <label className="font-mono" style={labelStyle}>{t('modal.fDifficulty')}</label>
          <div style={btnGroupStyle}>
            {(['easy', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
              <PillBtn key={d} value={d} current={difficulte} label={t(`difficulty.${d}`)} onChange={setDifficulte} />
            ))}
          </div>
        </div>

        {/* Résumé */}
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="add-subject-summary" className="font-mono" style={labelStyle}>{t('modal.fSummary')}</label>
          <textarea className="font-mono"
            id="add-subject-summary"
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder={t('modal.fSummary')}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Transversal */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', ...labelStyle, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
            <input
              type="checkbox"
              checked={isTransversal}
              onChange={e => setIsTransversal(e.target.checked)}
            />
            {t('transversalLabel')}
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="font-mono" style={{
             fontSize: 11, color: '#c0473b',
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleClose} className="font-mono" style={FORM_BTN_CANCEL_STYLE}>
            {t('modal.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="font-mono" style={{ ...FORM_BTN_SUBMIT_STYLE, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            {t('modal.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
