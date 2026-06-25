'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Lab, PublicationType } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { FORM_INPUT_STYLE, FORM_LABEL_STYLE, FORM_BTN_CANCEL_STYLE, FORM_BTN_SUBMIT_STYLE } from '@/components/ui/form-styles'

type Props = {
  open: boolean
  lab: Lab
  onClose: () => void
  onCreated: (pub: unknown) => void
}

const TYPES: PublicationType[] = ['article', 'preprint', 'conference', 'working-paper']

const inputStyle: React.CSSProperties = { ...FORM_INPUT_STYLE, boxSizing: 'border-box' }
const labelStyle = FORM_LABEL_STYLE

export function AddPublicationModal({ open, lab, onClose, onCreated }: Props) {
  const t = useTranslations('publications')

  const [titre, setTitre] = useState('')
  const [authorsRaw, setAuthorsRaw] = useState('')
  const [annee, setAnnee] = useState<number>(new Date().getFullYear())
  const [type, setType] = useState<PublicationType>('article')
  const [revue, setRevue] = useState('')
  const [lien, setLien] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setTitre('')
    setAuthorsRaw('')
    setAnnee(new Date().getFullYear())
    setType('article')
    setRevue('')
    setLien('')
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || !authorsRaw.trim()) {
      setError(t('errorRequired'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const auteurs = authorsRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const body = {
        labo: lab,
        titre: titre.trim(),
        auteurs,
        annee,
        type,
        revue_ou_conf: revue.trim() || null,
        lien: lien.trim() || null,
      }
      const res = await fetch('/api/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error ?? t('errorGeneric'))
        return
      }
      const created = await res.json()
      onCreated(created)
      reset()
    } catch {
      setError(t('errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  // Type label key: working-paper → types.working, others → types.<type>
  function typeKey(tp: PublicationType) {
    return tp === 'working-paper' ? 'types.working' : `types.${tp}`
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('addTitle')}>
      <form onSubmit={handleSubmit} noValidate>
        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-pub-title" style={labelStyle}>{t('fTitle')} *</label>
          <input
            id="add-pub-title"
            type="text"
            value={titre}
            onChange={e => setTitre(e.target.value)}
            placeholder={t('fTitle')}
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Authors */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-pub-authors" style={labelStyle}>{t('fAuthors')} *</label>
          <input
            id="add-pub-authors"
            type="text"
            value={authorsRaw}
            onChange={e => setAuthorsRaw(e.target.value)}
            placeholder={t('fAuthorsPlaceholder')}
            style={inputStyle}
          />
        </div>

        {/* Year + Type row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="add-pub-year" style={labelStyle}>{t('fYear')} *</label>
            <input
              id="add-pub-year"
              type="number"
              value={annee}
              min={1900}
              max={2100}
              onChange={e => setAnnee(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="add-pub-type" style={labelStyle}>{t('type')} *</label>
            <select
              id="add-pub-type"
              value={type}
              onChange={e => setType(e.target.value as PublicationType)}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              {TYPES.map(tp => (
                <option key={tp} value={tp}>{t(typeKey(tp) as Parameters<typeof t>[0])}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Journal / Conference */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="add-pub-journal" style={labelStyle}>{t('fJournal')}</label>
          <input
            id="add-pub-journal"
            type="text"
            value={revue}
            onChange={e => setRevue(e.target.value)}
            placeholder={t('fJournal')}
            style={inputStyle}
          />
        </div>

        {/* DOI / URL */}
        <div style={{ marginBottom: 18 }}>
          <label htmlFor="add-pub-link" style={labelStyle}>{t('fLink')}</label>
          <input
            id="add-pub-link"
            type="url"
            value={lien}
            onChange={e => setLien(e.target.value)}
            placeholder="https://…"
            style={inputStyle}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 11,
            color: '#c0473b',
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={handleClose} style={FORM_BTN_CANCEL_STYLE}>
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{ ...FORM_BTN_SUBMIT_STYLE, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? '…' : t('add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
