'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ProposalStatusBadge } from '@/components/ui/StatusBadge'
import type { Proposal, Lab, Member, ProposalStatus } from '@/types'

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

type Props = { lab: Lab; member: Member | null; refreshKey: number }

export function ProposalTracker({ lab, member, refreshKey }: Props) {
  const t = useTranslations('propose')
  const ts = useTranslations('proposalStatus')
  const [proposals, setProposals] = useState<Proposal[]>([])

  useEffect(() => {
    if (member) {
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
  }, [lab, member, refreshKey])

  const heading = member ? t('memberTrackerTitle') : t('trackerTitle')

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
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase' as const,
          color: '#2f4486',
          fontWeight: 600,
        }}>
          {heading}
        </span>
        {proposals.length > 0 && (
          <span style={{
            background: '#2f4486',
            color: '#eef3ff',
            borderRadius: 99,
            padding: '1px 7px',
            fontSize: 10,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 600,
          }}>
            {proposals.length}
          </span>
        )}
      </div>

      {/* Empty state */}
      {proposals.length === 0 && (
        <div style={{
          border: '1px dashed rgba(20,40,90,0.18)',
          borderRadius: 12,
          padding: '24px 16px',
          textAlign: 'center' as const,
          color: '#6b7596',
          fontFamily: "'IBM Plex Mono', monospace",
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
            <p style={{
              fontFamily: "'Roboto Slab', Georgia, serif",
              fontSize: 13.5,
              fontWeight: 600,
              color: '#15203f',
              margin: '0 0 7px',
              lineHeight: 1.4,
            }}>
              {p.titre}
            </p>
            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
              <span style={{
                background: 'rgba(47,68,134,0.08)',
                color: '#2f4486',
                borderRadius: 5,
                padding: '2px 7px',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase' as const,
              }}>
                {p.domaine}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                color: '#8e9ab8',
                letterSpacing: '0.06em',
              }}>
                {p.difficulte}
              </span>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
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
