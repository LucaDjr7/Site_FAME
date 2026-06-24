'use client'
import { useEffect } from 'react'

type Props = { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }

export function Modal({ open, onClose, children, title }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        style={{ background: '#fbf9f3', animation: 'modalIn 0.15s ease' }}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b" style={{ borderColor: '#eceadf' }}>
            <h2 className="font-serif text-lg" style={{ color: '#1d2b56' }}>{title}</h2>
            <button onClick={onClose} className="text-xl leading-none" style={{ color: '#7e95d6' }}>×</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
