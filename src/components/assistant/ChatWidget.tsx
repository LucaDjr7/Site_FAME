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
        // Sit at the content's bottom-right. On filter pages (subjects/tasks) the
        // right rail publishes --fame-rail-w, so the bubble rests just left of it
        // and glides when the filter expands/collapses. Elsewhere the var is 0.
        right: isHome ? '26px' : 'calc(var(--fame-rail-w, 0px) + 26px)',
        // Lab pages stack a ~38px bottom toolbar (count / sort / Tasks link)
        // above the 48px (h-12) footer; lift the bubble just above both.
        bottom: lab ? '100px' : '26px',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '14px',
        transition: 'right 0.12s ease',
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
