'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ProposalStatusBadge } from '@/components/ui/StatusBadge'
import type { Proposal, Lab, ProposalStatus } from '@/types'

const STORAGE_KEY = 'fame_proposals'

export function readStoredProposalIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function storeProposalId(id: string) {
  const ids = readStoredProposalIds()
  if (!ids.includes(id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([id, ...ids]))
  }
}

const STATUS_DOT: Record<ProposalStatus, string> = {
  pending: '#e8b149',
  accepted: '#1e9b7e',
  rejected: '#c0473b',
}

type Props = { lab: Lab; isMember: boolean; refreshKey: number }

export function ProposalTracker({ lab, isMember, refreshKey }: Props) {
  const t = useTranslations('propose')
  const ts = useTranslations('proposalStatus')
  const [proposals, setProposals] = useState<Proposal[]>([])

  useEffect(() => {
    if (isMember) {
      fetch(`/api/proposals?lab=${lab}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setProposals(data ?? []))
      return
    }
    const ids = readStoredProposalIds()
    const url = ids.length === 0 ? null : `/api/proposals?ids=${ids.join(',')}`
    Promise.resolve(url)
      .then(u => u ? fetch(u).then(res => res.ok ? res.json() : []) : [])
      .then(data => setProposals(data))
  }, [lab, isMember, refreshKey])

  const heading = isMember ? t('memberTrackerTitle') : t('trackerTitle')

  return (
    <aside style={{
      flexShrink: 0,
      width: 330,
      overflowY: 'auto',
      borderLeft: '1px solid rgba(20,40,90,0.1)',
      background: 'rgba(244,243,236,0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      padding: '26px 22px 30px',
      color: '#2a3354',
    }}>
      {/* Heading */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
      }}>
        <span className="font-mono text-fame-blue" style={{
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase' as const,
          fontWeight: 600,
        }}>
          {heading}
        </span>
        {proposals.length > 0 && (
          <span className="font-mono bg-fame-blue text-fame-text-light" style={{
            borderRadius: 99,
            padding: '1px 7px',
            fontSize: 10,
            fontWeight: 600,
          }}>
            {proposals.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {proposals.length === 0 && (
        <div className="font-mono" style={{
          border: '1px dashed rgba(20,40,90,0.18)',
          borderRadius: 12,
          padding: '24px 16px',
          textAlign: 'center' as const,
          color: '#6b7596',
          fontSize: 11,
          lineHeight: 1.6,
        }}>
          {t('trackerEmpty')}
        </div>
      )}

      {/* Proposal cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {proposals.map(p => (
          <div key={p.id} style={{
            background: '#fff',
            borderRadius: 12,
            padding: '13px 14px',
            border: '1px solid rgba(20,40,90,0.1)',
            boxShadow: '0 8px 20px -14px rgba(20,40,90,0.4)',
          }}>
            {/* Status dot + badge row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: STATUS_DOT[p.statut],
                flexShrink: 0,
                display: 'inline-block',
              }} />
              <ProposalStatusBadge status={p.statut} label={ts(p.statut)} />
            </div>
            {/* Title */}
            <p className="font-serif text-fame-text-dark" style={{
              fontSize: 13.5,
              fontWeight: 600,
              margin: '0 0 7px',
              lineHeight: 1.4,
            }}>
              {p.titre}
            </p>
            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
              <span className="font-mono text-fame-blue" style={{
                background: 'rgba(47,68,134,0.08)',
                borderRadius: 5,
                padding: '2px 7px',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
              }}>
                {p.domaine}
              </span>
              <span className="font-mono" style={{
                fontSize: 9,
                color: '#8e9ab8',
                letterSpacing: '0.06em',
              }}>
                {p.difficulte}
              </span>
              <span className="font-mono" style={{
                fontSize: 9,
                color: '#aab0c4',
                marginLeft: 'auto',
              }}>
                {new Date(p.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
