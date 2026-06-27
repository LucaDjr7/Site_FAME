'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

export function ReportProblemButton() {
  const t = useTranslations('report')
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, email: email.trim() || undefined }),
      })
      if (res.ok) {
        addToast(t('success'), 'success')
        setOpen(false)
        setMessage('')
        setEmail('')
      } else {
        addToast(t('error'), 'error')
      }
    } catch {
      addToast(t('error'), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-mono text-fame-text-muted hover:text-fame-blue"
      >
        {t('button')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('title')}>
        <p className="text-sm text-fame-text-body mb-4">{t('intro')}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="report-message" className="text-xs font-mono text-fame-text-muted uppercase tracking-wide">
              {t('messageLabel')}
            </label>
            <textarea
              id="report-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('messagePlaceholder')}
              required
              rows={5}
              className="w-full rounded-lg border border-fame-ecru bg-white px-3 py-2 text-sm text-fame-text-body placeholder:text-fame-text-dim focus:outline-none focus:ring-2 focus:ring-fame-blue resize-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="report-email" className="text-xs font-mono text-fame-text-muted uppercase tracking-wide">
              {t('emailLabel')}
            </label>
            <input
              id="report-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full rounded-lg border border-fame-ecru bg-white px-3 py-2 text-sm text-fame-text-body placeholder:text-fame-text-dim focus:outline-none focus:ring-2 focus:ring-fame-blue"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!message.trim() || sending}
              className="rounded-lg bg-fame-blue px-5 py-2 text-sm font-mono text-white hover:bg-fame-blue-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? t('sending') : t('submit')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
