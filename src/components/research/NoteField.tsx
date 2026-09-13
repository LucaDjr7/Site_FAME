'use client'
import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'

export function NoteField({ paperId, initialContent }: { paperId: string; initialContent: string }) {
  const t = useTranslations('research')
  const { addToast } = useToast()
  const [content, setContent] = useState(initialContent)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any pending debounced save if this field unmounts (e.g. a filter
  // change re-renders the page and unmounts every NoteField) — otherwise a
  // stale save/toast would fire for a note the member is no longer viewing.
  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current)
    }
  }, [])

  function onChange(value: string) {
    setContent(value)
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(async () => {
      // The API rejects blank content with 400 (a note is deleted by other
      // means, not by saving empty text). Skip the request entirely so
      // clearing the textarea doesn't surface a false "error" toast or
      // leave the member thinking their edit was lost.
      if (!value.trim()) return
      try {
        const res = await fetch('/api/research/notes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paper_id: paperId, content: value }),
        })
        if (res.ok) addToast(t('noteSaved'), 'success')
        else addToast(t('actionError'), 'error')
      } catch {
        addToast(t('actionError'), 'error')
      }
    }, 800) // debounce
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', color: '#9a9684', letterSpacing: '0.06em' }}>
        {t('noteLabel')}
      </label>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('notePlaceholder')}
        rows={2}
        style={{ width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid rgba(20,40,90,0.12)', fontSize: 12.5, resize: 'vertical' }}
      />
    </div>
  )
}
