'use client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAssistantChat } from '@/lib/assistant/useAssistantChat'
import { ChatMessageList } from './ChatMessageList'
import { ChatComposer } from './ChatComposer'

// Injected once — star rotation
const STAR_SPIN_STYLE = `
@keyframes assistantStarSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`

const SUGGESTION_TAGS = ['01', '02', '03', '04'] as const
const SUGGESTION_TAG_COLORS = [
  '#2f4486',
  '#e8b149',
  '#1e9b7e',
  '#b59d87',
] as const

export function AssistantFullPage({
  locale,
}: {
  locale: string
}) {
  const t = useTranslations('assistant')
  const router = useRouter()
  const { messages, status, send, reset } = useAssistantChat()

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(`/${locale}`)
  }

  const suggestionKeys = [
    'suggestion1',
    'suggestion2',
    'suggestion3',
    'suggestion4',
  ] as const

  return (
    <>
      <style>{STAR_SPIN_STYLE}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100dvh',
          background: '#F9F9FA',
        }}
      >
        {/* ─── Top bar ─── */}
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 28px',
            borderBottom: '1px solid rgba(20,40,90,0.15)',
            background: '#2f4486',
            gap: '12px',
          }}
        >
          {/* Left: avatar + title block */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Star avatar */}
            <div
              style={{
                width: '38px',
                height: '38px',
                minWidth: '38px',
                borderRadius: '11px',
                background: 'rgba(120,150,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                style={{ animation: 'assistantStarSpin 28s linear infinite' }}
              >
                <text
                  x="10"
                  y="15"
                  textAnchor="middle"
                  fontSize="16"
                  fill="#9fb6ff"
                  fontFamily="monospace"
                >
                  ✦
                </text>
              </svg>
            </div>

            {/* Title block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#7e95d6',
                }}
              >
                {t('subtitle')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    color: '#eef3ff',
                    lineHeight: 1,
                  }}
                >
                  {t('title')}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                    fontSize: '10px',
                    fontWeight: 500,
                    color: '#9fb6ff',
                    background: 'rgba(120,150,255,0.16)',
                    borderRadius: '6px',
                    padding: '2px 7px',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t('beta')}
                </span>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {messages.length > 0 && (
              <button
                onClick={reset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'rgba(120,150,255,0.14)',
                  border: '1px solid rgba(120,150,255,0.28)',
                  borderRadius: '9px',
                  padding: '6px 13px',
                  color: '#eef3ff',
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                }}
              >
                ↺ {t('newChat')}
              </button>
            )}

            {/* Back button */}
            <button
              onClick={goBack}
              aria-label={t('closeLabel')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'rgba(120,150,255,0.14)',
                border: '1px solid rgba(120,150,255,0.28)',
                color: '#eef3ff',
                cursor: 'pointer',
                fontSize: '17px',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#eef3ff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              maxWidth: '840px',
              width: '100%',
              margin: '0 auto',
              padding: '36px 28px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {messages.length === 0 ? (
              /* ── Welcome / empty state ── */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '16px',
                }}
              >
                {/* Large star icon */}
                <div
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '22px',
                    background: 'linear-gradient(150deg,#2f4486,#1f2e5c)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 36 36"
                    fill="none"
                  >
                    <text
                      x="18"
                      y="27"
                      textAnchor="middle"
                      fontSize="26"
                      fill="#9fb6ff"
                      fontFamily="monospace"
                    >
                      ✦
                    </text>
                  </svg>
                </div>

                {/* Welcome title */}
                <h2
                  style={{
                    fontSize: '30px',
                    fontWeight: 700,
                    color: '#1f2e5c',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {t('welcomeTitle')}
                </h2>

                {/* Welcome body */}
                <p
                  style={{
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: '#43507a',
                    maxWidth: '520px',
                    margin: 0,
                  }}
                >
                  {t('welcomeBody')}
                </p>

                {/* Suggestions grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
                    gap: '12px',
                    width: '100%',
                    marginTop: '8px',
                  }}
                >
                  {suggestionKeys.map((key, i) => (
                    <button
                      key={key}
                      onClick={() => send(t(key))}
                      style={{
                        textAlign: 'left',
                        background: 'rgba(251,249,243,0.86)',
                        border: '1px solid rgba(20,40,90,0.1)',
                        borderRadius: '14px',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                          fontSize: '10px',
                          fontWeight: 600,
                          color: SUGGESTION_TAG_COLORS[i] ?? '#2f4486',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {SUGGESTION_TAGS[i]}
                      </span>
                      <span
                        style={{
                          fontSize: '13.5px',
                          lineHeight: '1.45',
                          color: '#1f2e5c',
                        }}
                      >
                        {t(key)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Message thread ── */
              <ChatMessageList
                messages={messages}
                status={status}
                locale={locale}
                lab={undefined}
              />
            )}
          </div>
        </div>

        {/* ─── Composer + disclaimer ─── */}
        <div
          style={{
            flex: 'none',
            borderTop: '1px solid rgba(20,40,90,0.08)',
          }}
        >
          <div
            style={{
              maxWidth: '840px',
              margin: '0 auto',
            }}
          >
            <ChatComposer onSend={send} disabled={status === 'streaming'} />
            <p
              style={{
                textAlign: 'center',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '10px',
                color: '#9aa3bd',
                margin: '0 0 10px',
                padding: '0 16px',
              }}
            >
              {t('disclaimer')}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
