'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PROPOSAL_DOMAINS } from '@/lib/constants'
import type { Lab, Difficulty } from '@/types'

const DIFFS: Difficulty[] = ['easy', 'intermediate', 'advanced']

type Props = { lab: Lab; onSubmitted: (id: string) => void }

export function ProposeForm({ lab, onSubmitted }: Props) {
  const t = useTranslations('propose')
  const td = useTranslations('domains')
  const tdiff = useTranslations('tasks')
  const [titre, setTitre] = useState('')
  const [domaine, setDomaine] = useState<string>(PROPOSAL_DOMAINS[0])
  const [difficulte, setDifficulte] = useState<Difficulty>('easy')
  const [description, setDescription] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || !description.trim() || !prenom.trim() || !nom.trim()) {
      setError(t('validationRequired'))
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        labo: lab,
        titre,
        domaine,
        difficulte,
        description,
        proposant_prenom: prenom,
        proposant_nom: nom,
        proposant_email: email || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      setError(t('errorGeneric'))
      return
    }
    const created = await res.json()
    setError('')
    setTitre('')
    setDescription('')
    setPrenom('')
    setNom('')
    setEmail('')
    setDomaine(PROPOSAL_DOMAINS[0])
    setDifficulte('easy')
    onSubmitted(created.id)
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    background: '#fff',
    border: `1px solid ${focusedField === field ? '#2f4486' : 'rgba(20,40,90,0.18)'}`,
    borderRadius: 9,
    padding: '11px 13px',
    fontSize: 14,
    outline: 'none',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(47,68,134,0.12)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box' as const,
  })

  const emailInputStyle = (field: string): React.CSSProperties => ({
    ...inputStyle(field),
    fontSize: 13,
  })

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: '#5b668c',
    display: 'block',
    marginBottom: 7,
  }

  const diffButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 6px',
    borderRadius: 9,
    border: active ? '1px solid #2f4486' : '1px solid rgba(20,40,90,0.14)',
    background: active ? 'rgba(47,68,134,0.12)' : '#fff',
    color: active ? '#2f4486' : '#5a6486',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && (
        <div className="font-mono" style={{
          background: 'rgba(220,68,55,0.08)',
          border: '1px solid rgba(220,68,55,0.28)',
          color: '#b53f33',
          borderRadius: 9,
          padding: '10px 13px',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Title */}
      <label style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="font-mono" style={labelStyle}>{t('fieldTitle')} *</span>
        <input className="font-mono text-fame-text-dark"
          type="text"
          value={titre}
          onChange={e => setTitre(e.target.value)}
          onFocus={() => setFocusedField('titre')}
          onBlur={() => setFocusedField(null)}
          style={inputStyle('titre')}
        />
      </label>

      {/* Domain */}
      <label style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="font-mono" style={labelStyle}>{t('fieldDomain')}</span>
        <select className="font-mono text-fame-text-dark"
          value={domaine}
          onChange={e => setDomaine(e.target.value)}
          onFocus={() => setFocusedField('domaine')}
          onBlur={() => setFocusedField(null)}
          style={inputStyle('domaine')}
        >
          {PROPOSAL_DOMAINS.map(d => (
            <option key={d} value={d}>{td(d)}</option>
          ))}
        </select>
      </label>

      {/* Difficulty — 3 toggle buttons */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="font-mono" style={labelStyle}>{t('fieldDifficulty')}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {DIFFS.map(d => (
            <button
              key={d}
              className="font-mono"
              type="button"
              onClick={() => setDifficulte(d)}
              style={diffButtonStyle(difficulte === d)}
            >
              {tdiff(`difficulty.${d}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <label style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="font-mono" style={labelStyle}>{t('fieldDescription')} *</span>
        <textarea className="font-mono text-fame-text-dark"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onFocus={() => setFocusedField('description')}
          onBlur={() => setFocusedField(null)}
          rows={5}
          style={{ ...inputStyle('description'), resize: 'none' }}
        />
      </label>

      {/* First name + Last name */}
      <div style={{ display: 'flex', gap: 14 }}>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span className="font-mono" style={labelStyle}>{t('fieldFirstName')} *</span>
          <input className="font-mono text-fame-text-dark"
            type="text"
            value={prenom}
            onChange={e => setPrenom(e.target.value)}
            onFocus={() => setFocusedField('prenom')}
            onBlur={() => setFocusedField(null)}
            style={inputStyle('prenom')}
          />
        </label>
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span className="font-mono" style={labelStyle}>{t('fieldLastName')} *</span>
          <input className="font-mono text-fame-text-dark"
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            onFocus={() => setFocusedField('nom')}
            onBlur={() => setFocusedField(null)}
            style={inputStyle('nom')}
          />
        </label>
      </div>

      {/* Email (optional) */}
      <label style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="font-mono" style={labelStyle}>{t('fieldEmail')}</span>
        <input className="font-mono text-fame-text-dark"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onFocus={() => setFocusedField('email')}
          onBlur={() => setFocusedField(null)}
          style={emailInputStyle('email')}
        />
      </label>

      {/* RGPD notice */}
      <p className="font-mono" style={{
        fontSize: 11,
        color: '#6b7596',
        lineHeight: 1.6,
        margin: 0,
      }}>
        {t('rgpd')}
      </p>

      {/* Submit button */}
      <div>
        <button className={`font-serif text-fame-text-light ${saving ? '' : 'bg-fame-blue'}`}
          type="submit"
          disabled={saving}
          style={{
            background: saving ? 'rgba(47,68,134,0.5)' : undefined,
            padding: '12px 22px',
            borderRadius: 10,
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 12px 28px -12px rgba(47,68,134,0.7)',
            transition: 'all 0.15s',
            letterSpacing: '0.01em',
          }}
        >
          {saving ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  )
}
