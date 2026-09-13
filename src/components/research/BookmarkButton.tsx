'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'

export function BookmarkButton({ paperId, initiallyBookmarked }: { paperId: string; initiallyBookmarked: boolean }) {
  const t = useTranslations('research')
  const { addToast } = useToast()
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    try {
      const res = await fetch('/api/research/bookmarks' + (bookmarked ? `?paper_id=${paperId}` : ''), {
        method: bookmarked ? 'DELETE' : 'POST',
        headers: bookmarked ? undefined : { 'Content-Type': 'application/json' },
        body: bookmarked ? undefined : JSON.stringify({ paper_id: paperId }),
      })
      if (res.ok) setBookmarked((b) => !b)
      else addToast(t('actionError'), 'error')
    } catch {
      addToast(t('actionError'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={toggle} disabled={busy} style={{
      fontSize: 11.5, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
      border: '1px solid rgba(20,40,90,0.14)',
      background: bookmarked ? 'rgba(47,68,134,0.12)' : 'transparent',
      color: bookmarked ? '#2f4486' : '#5768ac',
    }}>
      {bookmarked ? t('bookmarked') : t('bookmark')}
    </button>
  )
}
