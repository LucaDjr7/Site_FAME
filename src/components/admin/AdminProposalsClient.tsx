'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ProposalStatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import type { Proposal, Lab, ProposalStatus } from '@/types'
import { VALID_LABS } from '@/lib/constants'

const STATUSES: (ProposalStatus | 'all')[] = ['all', 'pending', 'accepted', 'rejected']

// Intentional variance: 3-gradient composite with specific position offsets (at 22%/80%/90%).
const PAGE_BG =
  'radial-gradient(110% 80% at 22% 8%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%), ' +
  'radial-gradient(120% 110% at 80% 112%, rgba(113,120,132,0.2) 0%, rgba(113,120,132,0) 60%), ' +
  'radial-gradient(140% 120% at 90% 44%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%), ' +
  '#F9F9FA'

const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: active ? '1px solid #2f4486' : '1px solid rgba(20,40,90,0.14)',
  background: active ? 'rgba(47,68,134,0.12)' : 'rgba(255,255,255,0.6)',
  color: active ? '#2f4486' : '#6b7596',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'capitalize',
  cursor: 'pointer',
  transition: 'all 0.14s',
})

export function AdminProposalsClient() {
  const t = useTranslations('admin')
  const tdiff = useTranslations('tasks')
  const ts = useTranslations('proposalStatus')
  const locale = useLocale()
  const router = useRouter()
  const { addToast } = useToast()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [lab, setLab] = useState<Lab>('paris')
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('pending')
  const [comments, setComments] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    fetch(`/api/proposals?lab=${lab}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setProposals(data) })
      .catch(() => addToast(t('actionError'), 'error'))
  }, [lab, t, addToast])

  useEffect(() => {
    load()
  }, [load])

  async function decide(id: string, statut: 'accepted' | 'rejected') {
    try {
      const res = await fetch(`/api/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut, commentaire_admin: comments[id] ?? null }),
      })
      if (res.ok) { addToast(t('decisionSaved'), 'success'); load() }
      else { addToast(t('actionError'), 'error') }
    } catch {
      addToast(t('actionError'), 'error')
    }
  }

  async function convert(id: string) {
    try {
      const res = await fetch(`/api/proposals/${id}/convert`, { method: 'POST' })
      if (res.ok) {
        const { subject_id } = await res.json()
        addToast(t('converted'), 'success')
        router.push(`/${locale}/${lab}/paper/${subject_id}`)
      } else {
        addToast(t('actionError'), 'error')
      }
    } catch {
      addToast(t('actionError'), 'error')
    }
  }

  const visible = proposals.filter(p => statusFilter === 'all' || p.statut === statusFilter)

  const actionBtn = (kind: 'accept' | 'reject' | 'convert'): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 11,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    border: kind === 'convert' ? '1px solid #2f4486' : 'none',
    background: kind === 'accept' ? '#1e9b7e' : kind === 'reject' ? '#c0473b' : 'transparent',
    color: kind === 'convert' ? '#2f4486' : '#eef3ff',
  })

  return (
    <div className="font-serif"
      style={{
        minHeight: 'calc(100vh - 3rem)',
        display: 'flex',
        flexDirection: 'column',
        color: '#18244c',
        background: PAGE_BG,
      }}
    >
      {/* ── Secondary toolbar ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 24px 14px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(20,40,90,0.1)',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: kicker + title */}
        <div>
          <div className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#7e95d6',
              marginBottom: 3,
            }}
          >
            {t('kicker')}
          </div>
          <h1 className="font-serif"
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#15203f',
              margin: 0,
            }}
          >
            {t('proposalsTitle')}
          </h1>
        </div>

        {/* Right: lab + status filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {VALID_LABS.map(l => (
              <button
                key={l}
                onClick={() => { setProposals([]); setLab(l) }}
                style={filterBtnStyle(lab === l)}
              >
                {l}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: 'rgba(20,40,90,0.12)' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={filterBtnStyle(statusFilter === s)}
              >
                {s === 'all' ? t('filterAll') : t(`filter${s.charAt(0).toUpperCase()}${s.slice(1)}` as 'filterPending' | 'filterAccepted' | 'filterRejected')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body scroll area ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visible.length === 0 && (
            <p className="font-mono"
              style={{
                fontSize: 12,
                color: '#7e95d6',
                textAlign: 'center',
                paddingTop: 50,
              }}
            >
              {t('noProposals')}
            </p>
          )}

          {visible.map(p => (
            <div
              key={p.id}
              style={{
                background: '#fbf9f3',
                borderRadius: 11,
                boxShadow: '0 16px 40px -24px rgba(0,5,30,0.4), inset 0 0 0 1px rgba(0,0,0,0.05)',
                padding: '18px 20px',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 className="font-serif"
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#15203f',
                      margin: 0,
                      lineHeight: 1.25,
                    }}
                  >
                    {p.titre}
                  </h3>
                  <p className="font-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#6b7596',
                      margin: '5px 0 0',
                    }}
                  >
                    {p.domaine} · {tdiff(`difficulty.${p.difficulte}`)} · {t('by')} {p.proposant_prenom} {p.proposant_nom}
                  </p>
                </div>
                <ProposalStatusBadge status={p.statut} label={ts(p.statut)} />
              </div>

              <p className="font-serif"
                style={{
                  fontSize: 13.5,
                  color: '#43507a',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  margin: '0 0 12px',
                }}
              >
                {p.description}
              </p>

              {p.statut === 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 14 }}>
                  <input className="font-mono"
                    type="text"
                    placeholder={t('commentPlaceholder')}
                    value={comments[p.id] ?? ''}
                    onChange={e => setComments(c => ({ ...c, [p.id]: e.target.value }))}
                    style={{
                      width: '100%',
                      background: '#fff',
                      border: '1px solid rgba(20,40,90,0.18)',
                      borderRadius: 9,
                      padding: '9px 11px',
                      fontSize: 12,
                      color: '#2a3457',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => decide(p.id, 'accepted')} style={actionBtn('accept')}>{t('accept')}</button>
                    <button onClick={() => decide(p.id, 'rejected')} style={actionBtn('reject')}>{t('reject')}</button>
                    <button onClick={() => convert(p.id)} style={actionBtn('convert')}>{t('convert')}</button>
                  </div>
                </div>
              )}

              {p.statut !== 'pending' && p.commentaire_admin && (
                <p className="font-mono"
                  style={{
                    fontSize: 11.5,
                    color: '#6b7596',
                    fontStyle: 'italic',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    paddingTop: 10,
                    margin: '10px 0 0',
                  }}
                >
                  &quot;{p.commentaire_admin}&quot;
                </p>
              )}

              {p.statut === 'accepted' && (
                <button onClick={() => convert(p.id)} style={{ ...actionBtn('convert'), marginTop: 12 }}>
                  {t('convert')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
