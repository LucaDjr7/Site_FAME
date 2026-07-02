'use client'
import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void
  disabled?: boolean
}) {
  const t = useTranslations('assistant')
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isEmpty = value.trim() === ''
  const isDisabled = disabled || isEmpty

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    // Auto-resize up to max-height
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'
  }

  const borderColor = isEmpty
    ? 'rgba(20,40,90,0.14)'
    : 'rgba(47,68,134,0.45)'

  return (
    <div
      style={{
        borderTop: '1px solid rgba(20,40,90,0.10)',
        background: 'rgba(251,249,243,0.9)',
        padding: '6px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          background: '#fff',
          border: `1px solid ${borderColor}`,
          borderRadius: '11px',
          padding: '3px 3px 3px 11px',
          transition: 'border-color 0.15s',
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          disabled={disabled}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'none',
            fontFamily: 'var(--font-roboto-slab, serif)',
            fontSize: '13.5px',
            lineHeight: '1.5',
            color: '#18244c',
            maxHeight: '110px',
            overflowY: 'auto',
          }}
          className="font-serif"
        />
        <button
          onClick={handleSend}
          disabled={isDisabled}
          aria-label={t('send')}
          title={t('send')}
          style={{
            width: '28px',
            height: '28px',
            minWidth: '28px',
            borderRadius: '8px',
            border: 'none',
            background: isDisabled ? 'rgba(47,68,134,0.35)' : '#2f4486',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={15}
            height={15}
            fill="none"
            stroke="#eef3ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
