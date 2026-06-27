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

  const isHome = (seg?.length ?? 0) <= 1
  const isAssistantPage = seg?.[1] === 'assistant'

  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('fame:open-assistant', onOpen)
    return () => window.removeEventListener('fame:open-assistant', onOpen)
  }, [])

  if (isAssistantPage) return null

  return (
    <div
      style={{
        position: 'fixed',
        ...(isHome ? { right: '26px' } : { left: '26px' }),
        // Lab pages have a fixed 48px (h-12) footer bar; lift the bubble above it.
        bottom: lab ? '64px' : '26px',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: isHome ? 'flex-end' : 'flex-start',
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
