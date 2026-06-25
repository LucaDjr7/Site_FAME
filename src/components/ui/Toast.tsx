'use client'
import { createContext, useContext, useState, useCallback } from 'react'

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' }
type ToastCtx = { addToast: (message: string, type?: Toast['type']) => void }

const ToastContext = createContext<ToastCtx>({ addToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const COLOR: Record<Toast['type'], string> = {
    success: '#1e9b7e',
    error: '#c0473b',
    info: '#2f4486',
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            style={{ background: COLOR[t.type], animation: 'toastIn 0.2s ease' }}
            className="text-white text-sm font-mono px-5 py-3 rounded-lg shadow-xl pointer-events-auto"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
