'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ChatBubble } from './ChatBubble'
import { ChatPanel } from './ChatPanel'

export function ChatWidget({
  locale,
  isMember,
}: {
  locale: string
  isMember: boolean
}) {
  const pathname = usePathname()
  const seg = pathname?.split('/').filter(Boolean)
  const maybeLab = seg?.[1]
  const lab = maybeLab === 'paris' || maybeLab === 'montreal' ? maybeLab : undefined

  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('fame:open-assistant', onOpen)
    return () => window.removeEventListener('fame:open-assistant', onOpen)
  }, [])

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
