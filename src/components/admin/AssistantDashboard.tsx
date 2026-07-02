'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  enabled: boolean
  usage: { month: string; estCost: number; budget: number }
  logsHref?: string
}

export function AssistantDashboard({ enabled, usage, logsHref }: Props) {
  const t = useTranslations('adminAssistant')
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      const next = !isEnabled
      const res = await fetch('/api/assistant/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }) })
      // Ne basculer l'UI que si le write a réussi (sinon affichage désynchronisé).
      if (!res.ok) { setMsg(t('actionFailed')); return }
      setIsEnabled(next)
      setMsg('')
    } finally { setBusy(false) }
  }
  const reindex = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/assistant/reindex', { method: 'POST' })
      setMsg(res.ok ? t('reindexStarted') : t('actionFailed'))
    } finally { setBusy(false) }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-serif text-xl text-fame-text-dark">{t('title')}</h2>

      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-fame-text-body">{t('enabledLabel')}</span>
        <button onClick={toggle} disabled={busy} className="rounded-md bg-fame-blue px-3 py-1 text-sm font-mono text-fame-text-light disabled:opacity-50">
          {isEnabled ? t('disable') : t('enable')}
        </button>
        <button onClick={reindex} disabled={busy} className="rounded-md border border-fame-ecru px-3 py-1 text-sm font-mono text-fame-text-body disabled:opacity-50">
          {t('reindex')}
        </button>
        {msg && <span className="text-xs font-mono text-fame-teal">{msg}</span>}
      </div>

      <div className="rounded-lg border border-fame-ecru p-4">
        <h3 className="font-mono text-sm uppercase text-fame-text-muted">{t('usageTitle')} — {usage.month}</h3>
        <p className="text-fame-text-body">{t('monthlyCost')}: ${usage.estCost.toFixed(2)} / {t('budget')}: ${usage.budget.toFixed(2)}</p>
      </div>

      {logsHref && (
        <div className="rounded-lg border border-fame-ecru p-4">
          <a href={logsHref} className="font-mono text-sm text-fame-blue underline">{t('viewLogs')}</a>
        </div>
      )}
    </section>
  )
}
