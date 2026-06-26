'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

export function AssistantGlobeCTA() {
  const t = useTranslations('assistant')
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('globeCta')}
      onClick={() => {
        window.dispatchEvent(new CustomEvent('fame:open-assistant'))
        setDismissed(true)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('fame:open-assistant'))
          setDismissed(true)
        }
      }}
      style={{
        position: 'fixed',
        right: '26px',
        bottom: '100px',
        zIndex: 1199,
        width: 'min(282px, calc(100vw - 40px))',
        background: 'rgba(251,249,243,0.96)',
        border: '1px solid rgba(20,40,90,0.12)',
        borderRadius: '16px',
        padding: '15px 16px',
        boxShadow: '0 30px 70px -26px rgba(0,5,30,0.55)',
        backdropFilter: 'blur(8px)',
        cursor: 'pointer',
        animation: 'fameFade .5s ease both',
      }}
    >
      {/* Top row: badge + name + close button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#1e9b7e',
              background: 'rgba(30,155,126,0.12)',
              border: '1px solid rgba(30,155,126,0.28)',
              borderRadius: '20px',
              padding: '3px 8px',
            }}
          >
            {t('teaserBadge')}
          </span>
          <span
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#9a9684',
            }}
          >
            {t('assistantName')}
          </span>
        </div>

        {/* Dismiss button */}
        <button
          aria-label={t('closeLabel')}
          onClick={(e) => {
            e.stopPropagation()
            setDismissed(true)
          }}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: '1px solid rgba(20,40,90,0.12)',
            background: 'rgba(20,40,90,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            color: '#5768ac',
            fontSize: '14px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Body text */}
      <p
        style={{
          margin: 0,
          fontSize: '13.5px',
          lineHeight: 1.55,
          color: '#2a3457',
        }}
      >
        {t('globeCtaSub')}{' '}
        <strong style={{ color: '#2f4486' }}>{t('globeCta')}</strong>
      </p>
    </div>
  )
}
