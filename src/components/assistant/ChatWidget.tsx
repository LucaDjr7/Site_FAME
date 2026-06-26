'use client'
import { useState } from 'react'
import { ChatBubble } from './ChatBubble'
import { ChatPanel } from './ChatPanel'

export function ChatWidget({
  locale,
  lab,
  isMember,
}: {
  locale: string
  lab?: string
  isMember: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        position: 'fixed',
        right: '26px',
        bottom: '26px',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '14px',
      }}
    >
      {open && (
        <ChatPanel
          locale={locale}
          lab={lab}
          isMember={isMember}
          onClose={() => setOpen(false)}
        />
      )}
      <ChatBubble open={open} onClick={() => setOpen(o => !o)} />
    </div>
  )
}
