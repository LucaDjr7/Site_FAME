'use client'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

type Props = { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }

export function Modal({ open, onClose, children, title }: Props) {
  const t = useTranslations('common')
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const onCloseRef = useRef(onClose)

  // Keep onCloseRef current without adding onClose to the main effect's deps
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab' || !panel) return
      const f = panel.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')
      const first = f[0], last = f[f.length - 1]
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      ;(triggerRef.current as HTMLElement | null)?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title ?? undefined}
        className="bg-fame-sand rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        style={{ animation: 'modalIn 0.15s ease' }}>
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-fame-ecru">
            <h2 className="font-serif text-lg text-fame-blue-dark">{title}</h2>
            <button onClick={onClose} aria-label={t('close')} className="text-xl leading-none text-fame-text-muted">×</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
