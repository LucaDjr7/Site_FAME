'use client'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ChatUiMessage, AssistantStatus } from '@/lib/assistant/types'
import { SourceCitations } from './SourceCitations'

// Local blink animation injected once via a style tag
const BLINK_STYLE = `
@keyframes fameBlink {
  0%, 80%, 100% { opacity: 0.15; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
`

function TypingIndicator() {
  return (
    <>
      <style>{BLINK_STYLE}</style>
      <div
        style={{
          display: 'flex',
          gap: '5px',
          alignItems: 'center',
          padding: '6px 0 2px 38px',
        }}
      >
        {([0, 0.2, 0.4] as const).map((delay, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#2f4486',
              animation: `fameBlink 1.2s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </div>
    </>
  )
}

export function ChatMessageList({
  messages,
  status,
  locale,
  lab,
}: {
  messages: ChatUiMessage[]
  status: AssistantStatus
  locale: string
  lab?: string
}) {
  const t = useTranslations('assistant')

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '18px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
      }}
    >
      {messages.map((m, i) => {
        const isUser = m.role === 'user'
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
              flexDirection: isUser ? 'row-reverse' : 'row',
            }}
            className="animate-[fameFade_.26s_ease]"
          >
            {/* Avatar */}
            <div
              style={{
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                ...(isUser
                  ? {
                      background: 'rgba(181,157,135,0.2)',
                      border: '1px solid rgba(181,157,135,0.45)',
                      color: '#8a6f50',
                    }
                  : {
                      background: 'linear-gradient(150deg,#2f4486,#1f2e5c)',
                      border: '1px solid rgba(150,180,255,0.3)',
                      color: '#9fb6ff',
                    }),
              }}
              className="font-mono"
            >
              {isUser ? 'Vo' : '✦'}
            </div>

            {/* Bubble + meta */}
            <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Role label (bonus) */}
              <span
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  textTransform: 'uppercase',
                  color: '#8a93b4',
                  letterSpacing: '0.04em',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                }}
                className="font-mono"
              >
                {isUser ? t('you') : t('assistantName')}
              </span>

              {/* Bubble */}
              <div
                style={{
                  padding: '10px 13px',
                  fontSize: '13.5px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  ...(isUser
                    ? {
                        background: '#2f4486',
                        color: '#eef3ff',
                        borderRadius: '14px 4px 14px 14px',
                      }
                    : {
                        background: '#fff',
                        color: '#1e2a4d',
                        border: '1px solid rgba(20,40,90,0.1)',
                        borderRadius: '4px 14px 14px 14px',
                      }),
                }}
              >
                {m.content}
              </div>

              {/* Sources (assistant only) */}
              {!isUser && m.sources && m.sources.length > 0 && (
                <SourceCitations sources={m.sources} locale={locale} lab={lab} />
              )}

              {/* Unanswered CTA */}
              {m.unanswered && (
                <div style={{ marginTop: '4px' }}>
                  <Link
                    href={`/${locale}/${lab ?? 'paris'}/propose?topic=${encodeURIComponent(m.proposeQuestion ?? '')}`}
                    className="text-xs font-mono underline text-fame-blue"
                  >
                    {t('proposeCta')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Status indicators */}
      {status === 'streaming' && <TypingIndicator />}
      {status === 'degraded' && (
        <p className="text-xs font-mono text-fame-red">{t('degraded')}</p>
      )}
      {status === 'error' && (
        <p className="text-xs font-mono text-fame-red">{t('error')}</p>
      )}
    </div>
  )
}
