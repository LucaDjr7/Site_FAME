'use client'
import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import type { Lab, Role } from '@/types'
import { ROLE_KEY, ROLES } from './team-shared'

type Props = {
  open: boolean
  lab: Lab
  onClose: () => void
  onInvited: () => void
}

export function InviteModal({ open, lab, onClose, onInvited }: Props) {
  const t = useTranslations('team')

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('researcher')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activationUrl, setActivationUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPrenom('')
    setNom('')
    setEmail('')
    setRole('researcher')
    setError(null)
    setActivationUrl(null)
    setCopied(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prenom.trim() || !nom.trim() || !email.trim()) {
      setError(t('errorRequired'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, nom, email, role, labo: lab }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('errorGeneric'))
      } else {
        setActivationUrl(data.activationUrl)
        onInvited()
      }
    } catch {
      setError(t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!activationUrl) return
    try {
      await navigator.clipboard.writeText(activationUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      urlRef.current?.select()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 7,
    border: '1px solid rgba(20,40,90,0.18)',
    background: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    color: '#15203f',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#2f4486',
    marginBottom: 5,
    display: 'block',
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('inviteTitle')}>
      {activationUrl ? (
        /* ── Success: show activation URL ─────────────────────────── */
        <div>
          <div className="font-mono"
            style={{
              fontSize: 11,
              color: '#1e9b7e',
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            ✓ {t('inviteSent')}
          </div>
          <div className="font-mono"
            style={{
              fontSize: 10,
              color: '#6b7596',
              marginBottom: 8,
            }}
          >
            {t('activationNote')}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input
              ref={urlRef}
              readOnly
              value={activationUrl}
              style={{
                ...inputStyle,
                flex: 1,
                background: 'rgba(20,40,90,0.04)',
                fontSize: 10,
                color: '#43507a',
              }}
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button className="font-mono"
              onClick={handleCopy}
              style={{
                padding: '8px 12px',
                borderRadius: 7,
                border: copied ? '1px solid #1e9b7e' : '1px solid rgba(20,40,90,0.18)',
                background: copied ? 'rgba(30,155,126,0.08)' : 'rgba(47,68,134,0.08)',
                color: copied ? '#1e9b7e' : '#2f4486',
                fontSize: 10,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="font-mono"
              onClick={handleClose}
              style={{
                padding: '8px 16px',
                borderRadius: 7,
                border: '1px solid rgba(20,40,90,0.15)',
                background: 'rgba(255,255,255,0.6)',
                color: '#6b7596',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      ) : (
        /* ── Invite form ──────────────────────────────────────────── */
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px', marginBottom: 14 }}>
            <div>
              <label htmlFor="invite-firstname" style={labelStyle}>{t('fFirstName')} *</label>
              <input
                id="invite-firstname"
                value={prenom}
                onChange={e => setPrenom(e.target.value)}
                style={inputStyle}
                placeholder="Éric"
                required
              />
            </div>
            <div>
              <label htmlFor="invite-lastname" style={labelStyle}>{t('fLastName')} *</label>
              <input
                id="invite-lastname"
                value={nom}
                onChange={e => setNom(e.target.value)}
                style={inputStyle}
                placeholder="Dupont"
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="invite-email" style={labelStyle}>{t('fEmail')} *</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="eric.dupont@cnrs.fr"
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="invite-role" style={labelStyle}>{t('fRole')}</label>
            <select
              id="invite-role"
              value={role}
              onChange={e => setRole(e.target.value as Role)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {t(ROLE_KEY[r] as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="font-mono"
              style={{
                fontSize: 11,
                color: '#c0473b',
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="font-mono"
              type="button"
              onClick={handleClose}
              style={{
                padding: '8px 16px',
                borderRadius: 7,
                border: '1px solid rgba(20,40,90,0.15)',
                background: 'rgba(255,255,255,0.6)',
                color: '#6b7596',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {t('cancel')}
            </button>
            <button className="font-mono"
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 18px',
                borderRadius: 7,
                border: 'none',
                background: loading ? 'rgba(47,68,134,0.5)' : '#2f4486',
                color: '#eef3ff',
                fontSize: 11,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.06em',
              }}
            >
              {loading ? '…' : t('send')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
