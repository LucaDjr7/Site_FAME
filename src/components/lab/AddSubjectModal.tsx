'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { MemberRef, SubjectStatus, Difficulty, Lab } from '@/types'
import { Modal } from '@/components/ui/Modal'

type Props = {
  open: boolean
  lab: Lab
  members: MemberRef[]
  onClose: () => void
  onAdded: (subject: unknown) => void
}

export function AddSubjectModal({ open, lab, members, onClose, onAdded }: Props) {
  const t = useTranslations('lab')

  const [titre, setTitre] = useState('')
  const [kicker, setKicker] = useState('')
  const [responsable, setResponsable] = useState('')
  const [statut, setStatut] = useState<SubjectStatus>('active')
  const [difficulte, setDifficulte] = useState<Difficulty>('intermediate')
  const [context, setContext] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setTitre('')
    setKicker('')
    setResponsable('')
    setStatut('active')
    setDifficulte('intermediate')
    setContext('')
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
      }
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error ?? 'Error')
        return
      }
      const created = await res.json()
      onAdded(created)
      reset()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 5,
    border: '1px solid #eceadf',
    background: '#fff',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 12,
    color: '#2a3457',
    outline: 'none',
  }

  const btnGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  }

  function PillBtn<T extends string>({ value, current, label, onChange }: {
    value: T; current: T; label: string; onChange: (v: T) => void
  }) {
    const active = value === current
    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        style={{
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 10,
          fontFamily: 'IBM Plex Mono, monospace',
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#5768ac',
    marginBottom: 5,
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <form onSubmit={handleSubmit} noValidate>
        {/* Kicker */}
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace', fontSize: 8,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5768ac',
          marginBottom: 6,
        }}>
          {t('modal.newSubjectKicker')}
        </div>
        <div style={{
          fontFamily: 'Roboto Slab, Georgia, serif',
          fontSize: 18, fontWeight: 600, color: '#15203f', marginBottom: 20,
        }}>
          {t('modal.title')}
        </div>

        {/* Titre */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{t('modal.fTitle')} *</label>
          <input
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
          <label style={labelStyle}>{t('modal.fDomain')} *</label>
          <input
            type="text"
            value={kicker}
            onChange={e => setKicker(e.target.value)}
            placeholder={t('modal.fDomain')}
            style={inputStyle}
          />
        </div>

        {/* Responsable */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{t('modal.fResponsable')}</label>
          <select
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
          <label style={labelStyle}>{t('modal.fStatus')}</label>
          <div style={btnGroupStyle}>
            {(['active', 'on-hold', 'done'] as SubjectStatus[]).map(s => (
              <PillBtn key={s} value={s} current={statut} label={t(`status.${s}`)} onChange={setStatut} />
            ))}
          </div>
        </div>

        {/* Difficulté */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{t('modal.fDifficulty')}</label>
          <div style={btnGroupStyle}>
            {(['easy', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
              <PillBtn key={d} value={d} current={difficulte} label={t(`difficulty.${d}`)} onChange={setDifficulte} />
            ))}
          </div>
        </div>

        {/* Résumé */}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>{t('modal.fSummary')}</label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder={t('modal.fSummary')}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'IBM Plex Mono, monospace' }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#c0473b',
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #eceadf',
              background: 'transparent', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 11, color: '#7e95d6', cursor: 'pointer',
            }}
          >
            {t('modal.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              background: '#2f4486', color: '#fff',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {t('modal.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
