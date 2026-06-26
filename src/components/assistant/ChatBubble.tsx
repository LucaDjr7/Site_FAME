'use client'
import { useTranslations } from 'next-intl'

const SPIN_STYLE = `
@keyframes fameSpinSlow {
  to { transform: rotate(360deg); }
}
`

export function ChatBubble({ open, onClick }: { open: boolean; onClick: () => void }) {
  const t = useTranslations('assistant')
  const label = open ? t('closeLabel') : t('openLabel')

  return (
    <>
      <style>{SPIN_STYLE}</style>
      <button
        onClick={onClick}
        aria-label={label}
        title={label}
        style={{
          width: '62px',
          height: '62px',
          borderRadius: '20px',
          border: '1px solid rgba(150,180,255,0.3)',
          background: 'linear-gradient(150deg,#2f4486,#1f2e5c)',
          boxShadow: '0 22px 44px -16px rgba(31,46,92,0.8)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLButtonElement).style.transform =
            'translateY(-3px) scale(1.04)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = ''
        }}
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            width={24}
            height={24}
            stroke="#9fb6ff"
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 100 100"
            width={30}
            height={30}
            style={{ animation: 'fameSpinSlow 28s linear infinite' }}
          >
            <path
              d="M50 2 Q50 50 65.6 34.4 Q50 50 98 50 Q50 50 65.6 65.6 Q50 50 50 98 Q50 50 34.4 65.6 Q50 50 2 50 Q50 50 34.4 34.4 Q50 50 50 2 Z"
              fill="#9fb6ff"
            />
          </svg>
        )}
      </button>
    </>
  )
}
