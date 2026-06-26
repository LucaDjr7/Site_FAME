'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAssistantChat } from '@/lib/assistant/useAssistantChat'
import { ChatMessageList } from './ChatMessageList'
import { ChatComposer } from './ChatComposer'

export function ChatPanel({
  locale,
  lab,
  isMember,
  onClose,
}: {
  locale: string
  lab?: string
  isMember: boolean
  onClose: () => void
}) {
  const t = useTranslations('assistant')
  const { messages, status, send } = useAssistantChat()

  // Escape key closes panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const greeting = isMember ? t('greetingMember') : t('greetingVisitor')

  return (
    <div
      className="animate-[modalIn_.3s_ease]"
      style={{
        width: 'min(382px, calc(100vw - 40px))',
        height: 'min(536px, calc(100vh - 130px))',
        display: 'flex',
        flexDirection: 'column',
        background: '#fbf9f3',
        border: '1px solid rgba(20,40,90,0.12)',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 44px 96px -30px rgba(0,5,30,0.62)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          background: 'linear-gradient(150deg,#2f4486,#1f2e5c)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '34px',
            height: '34px',
            minWidth: '34px',
            borderRadius: '11px',
            background: 'rgba(120,150,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 100 100" width={18} height={18}>
            <path
              d="M50 2 Q50 50 65.6 34.4 Q50 50 98 50 Q50 50 65.6 65.6 Q50 50 50 98 Q50 50 34.4 65.6 Q50 50 2 50 Q50 50 34.4 34.4 Q50 50 50 2 Z"
              fill="#9fb6ff"
            />
          </svg>
        </div>

        {/* Title block */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#eef3ff',
                fontFamily: 'var(--font-roboto-slab, serif)',
              }}
            >
              {t('title')}
            </span>
            {/* Status dot */}
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#4cd2a0',
                boxShadow: '0 0 8px #4cd2a0',
                display: 'inline-block',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '9.5px',
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#9fb6ff',
            }}
          >
            {t('subtitle')}
          </span>
        </div>

        {/* Header action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Fullscreen link */}
          <Link
            href={`/${locale}/assistant`}
            aria-label={t('fullscreenLabel')}
            title={t('fullscreenLabel')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'rgba(31,46,92,0.5)',
              border: '1px solid rgba(150,180,255,0.22)',
              color: '#cdd8f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={15}
              height={15}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </Link>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label={t('closeLabel')}
            title={t('closeLabel')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'rgba(31,46,92,0.5)',
              border: '1px solid rgba(150,180,255,0.22)',
              color: '#cdd8f5',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              stroke="currentColor"
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Greeting bubble */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  minWidth: '28px',
                  borderRadius: '9px',
                  background: 'linear-gradient(150deg,#2f4486,#1f2e5c)',
                  border: '1px solid rgba(150,180,255,0.3)',
                  color: '#9fb6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                }}
              >
                ✦
              </div>
              <div
                style={{
                  background: '#fff',
                  color: '#1e2a4d',
                  borderRadius: '4px 14px 14px 14px',
                  padding: '10px 13px',
                  fontSize: '13.5px',
                  lineHeight: '1.6',
                  border: '1px solid rgba(20,40,90,0.1)',
                }}
              >
                {greeting}
              </div>
            </div>

            {/* Suggestions label */}
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: '#9a9684',
              }}
            >
              {t('suggestionsLabel')}
            </span>

            {/* Suggestion chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {([t('suggestion1'), t('suggestion2'), t('suggestion3')] as string[]).map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 13px',
                    borderRadius: '11px',
                    fontSize: '12.5px',
                    background: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(20,40,90,0.1)',
                    cursor: 'pointer',
                    color: '#2a3457',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                      'rgba(47,68,134,0.4)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor =
                      'rgba(20,40,90,0.1)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ChatMessageList messages={messages} status={status} locale={locale} lab={lab} />
        )}
      </div>

      {/* Composer */}
      <ChatComposer onSend={send} disabled={status === 'streaming'} />
    </div>
  )
}
