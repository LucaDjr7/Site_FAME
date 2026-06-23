'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ProposeForm } from './ProposeForm'
import { ProposalTracker, storeProposalId } from './ProposalTracker'
import { useToast } from '@/components/ui/Toast'
import type { Lab } from '@/types'

type Props = { lab: Lab; isMember: boolean }

export function ProposePageClient({ lab, isMember }: Props) {
  const t = useTranslations('propose')
  const { addToast } = useToast()
  const [refreshKey, setRefreshKey] = useState(0)

  function handleSubmitted(id: string) {
    storeProposalId(id)
    setRefreshKey(k => k + 1)
    addToast(t('successTitle'), 'success')
  }

  return (
    <div style={{
      height: 'calc(100vh - 3rem)',
      display: 'flex',
      fontFamily: "'Roboto Slab', Georgia, serif",
      color: '#18244c',
      background: [
        'radial-gradient(110% 80% at 24% 8%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%)',
        'radial-gradient(120% 110% at 78% 112%, rgba(113,120,132,0.2) 0%, rgba(113,120,132,0) 60%)',
        'radial-gradient(140% 120% at 92% 44%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%)',
        '#F9F9FA',
      ].join(', '),
    }}>
      {/* Form column (scrollable, left) */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '40px 44px 80px',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Form card */}
          <div style={{
            background: '#fbf9f3',
            borderRadius: 10,
            boxShadow: '0 30px 70px -28px rgba(0,5,30,0.45), inset 0 0 0 1px rgba(0,0,0,0.05)',
            padding: '30px 34px 34px',
            color: '#15203f',
          }}>
            {/* Eyebrow kicker */}
            <p style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: '#6b7596',
              margin: '0 0 6px',
            }}>
              {t('kicker')}
            </p>

            {/* Title */}
            <h2 style={{
              fontFamily: "'Roboto Slab', Georgia, serif",
              fontSize: 24,
              fontWeight: 700,
              color: '#15203f',
              margin: '0 0 8px',
            }}>
              {t('title')}
            </h2>

            {/* Intro */}
            <p style={{
              fontSize: 14,
              color: '#43507a',
              margin: '0 0 26px',
              lineHeight: 1.6,
            }}>
              {t('intro')}
            </p>

            <ProposeForm lab={lab} onSubmitted={handleSubmitted} />
          </div>
        </div>
      </div>

      {/* Tracker sidebar (right, fixed width) */}
      <ProposalTracker lab={lab} isMember={isMember} refreshKey={refreshKey} />
    </div>
  )
}
