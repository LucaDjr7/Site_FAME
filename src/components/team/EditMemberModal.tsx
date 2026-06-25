'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import type { Member, Role } from '@/types'
import { ROLE_KEY, ROLES } from './team-shared'

type Props = {
  open: boolean
  member: Member | null
  isAdmin: boolean
  onClose: () => void
  onSaved: (member: Member) => void
}

// Inner form is mounted fresh each time the modal opens (key=member.id+open)
// so we can safely use initial state from props without useEffect sync.
type FormProps = {
  member: Member
  isAdmin: boolean
  onClose: () => void
  onSaved: (member: Member) => void
}

function EditForm({ member, isAdmin, onClose, onSaved }: FormProps) {
  const t = useTranslations('team')

  // The public /api/members projection omits email (PII), so member.email may be
  // undefined here. Track whether the field was populated to avoid blanking the
  // stored address on save when it was never loaded.
  const [email, setEmail] = useState(member.email ?? '')
  const [domainesStr, setDomainesStr] = useState(member.domaines.join(', '))
  const [photoUrl, setPhotoUrl] = useState(member.photo_url ?? '')
  // Admin-only
  const [prenom, setPrenom] = useState(member.prenom)
  const [nom, setNom] = useState(member.nom)
  const [role, setRole] = useState<Role>(member.role)
  const [isAdminFlag, setIsAdminFlag] = useState(member.is_admin)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const domaines = domainesStr
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    const body: Record<string, unknown> = {
      domaines,
      photo_url: photoUrl || null,
    }
    // Only send email when it was actually populated/edited. The public member
    // list omits email, so an empty field means "not loaded" — never overwrite.
    if (email.trim()) body.email = email
    if (isAdmin) {
      body.prenom = prenom
      body.nom = nom
      body.role = role
      body.is_admin = isAdminFlag
    }

    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError((data as { error?: string }).error ?? t('errorGeneric'))
      } else {
        onSaved(data as Member)
        onClose()
      }
    } catch {
      setError(t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 7,
    border: '1px solid rgba(20,40,90,0.18)',
    background: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 5,
    display: 'block',
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Admin-only: first/last name */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px', marginBottom: 14 }}>
          <div>
            <label htmlFor="edit-member-firstname" className="font-mono text-fame-blue" style={labelStyle}>{t('fFirstName')}</label>
            <input className="font-mono text-fame-text-dark"
              id="edit-member-firstname"
              value={prenom}
              onChange={e => setPrenom(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="edit-member-lastname" className="font-mono text-fame-blue" style={labelStyle}>{t('fLastName')}</label>
            <input className="font-mono text-fame-text-dark"
              id="edit-member-lastname"
              value={nom}
              onChange={e => setNom(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* Email */}
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="edit-member-email" className="font-mono text-fame-blue" style={labelStyle}>{t('fEmail')}</label>
        <input className="font-mono text-fame-text-dark"
          id="edit-member-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Domains */}
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="edit-member-domains" className="font-mono text-fame-blue" style={labelStyle}>{t('fDomains')}</label>
        <input className="font-mono text-fame-text-dark"
          id="edit-member-domains"
          value={domainesStr}
          onChange={e => setDomainesStr(e.target.value)}
          style={inputStyle}
          placeholder={t('fDomainsPlaceholder')}
        />
      </div>

      {/* Photo URL */}
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="edit-member-photo" className="font-mono text-fame-blue" style={labelStyle}>{t('fPhoto')}</label>
        <input className="font-mono text-fame-text-dark"
          id="edit-member-photo"
          type="url"
          value={photoUrl}
          onChange={e => setPhotoUrl(e.target.value)}
          style={inputStyle}
          placeholder="https://…"
        />
      </div>

      {/* Admin-only: role + is_admin */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 12px', alignItems: 'end', marginBottom: 20 }}>
          <div>
            <label htmlFor="edit-member-role" className="font-mono text-fame-blue" style={labelStyle}>{t('fRole')}</label>
            <select className="font-mono text-fame-text-dark"
              id="edit-member-role"
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
          <label className="font-mono text-fame-blue"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              cursor: 'pointer',
              paddingBottom: 9,
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={isAdminFlag}
              onChange={e => setIsAdminFlag(e.target.checked)}
              className="accent-fame-blue"
            />
            {t('fIsAdmin')}
          </label>
        </div>
      )}

      {!isAdmin && <div style={{ marginBottom: 20 }} />}

      {error && (
        <div className="font-mono text-fame-red"
          style={{
            fontSize: 11,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="font-mono"
          type="button"
          onClick={onClose}
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
        <button className={`font-mono text-fame-text-light ${loading ? '' : 'bg-fame-blue'}`}
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 18px',
            borderRadius: 7,
            border: 'none',
            background: loading ? 'rgba(47,68,134,0.5)' : undefined,
            fontSize: 11,
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          {loading ? '…' : t('save')}
        </button>
      </div>
    </form>
  )
}

export function EditMemberModal({ open, member, isAdmin, onClose, onSaved }: Props) {
  const t = useTranslations('team')
  return (
    <Modal open={open} onClose={onClose} title={t('editTitle')}>
      {member && (
        <EditForm
          key={`${member.id}-${open ? 'open' : 'closed'}`}
          member={member}
          isAdmin={isAdmin}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  )
}
