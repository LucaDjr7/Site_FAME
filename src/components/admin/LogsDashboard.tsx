'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Unanswered = { id: string; question: string; lang: string; resolved: boolean; created_at: string }
type Flagged = { id: string; question: string; reason: string; created_at: string }

export function LogsDashboard({ unanswered, flagged, backHref }: { unanswered: Unanswered[]; flagged: Flagged[]; backHref?: string }) {
  const t = useTranslations('adminLogs')
  const [rows, setRows] = useState(unanswered)
  const [flaggedRows, setFlaggedRows] = useState(flagged)

  async function toggle(id: string, resolved: boolean) {
    const res = await fetch(`/api/admin/logs/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resolved }) })
    if (res.ok) setRows(prev => prev.map(r => r.id === id ? { ...r, resolved } : r))
  }
  async function del(id: string, type: 'unanswered' | 'flagged') {
    if (!window.confirm(t('confirmDelete'))) return
    const res = await fetch(`/api/admin/logs/${id}?type=${type}`, { method: 'DELETE' })
    if (!res.ok) return
    if (type === 'unanswered') setRows(prev => prev.filter(r => r.id !== id))
    else setFlaggedRows(prev => prev.filter(r => r.id !== id))
  }
  const fmt = (s: string) => s.slice(0, 10)

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-fame-text-dark">{t('title')}</h2>
        {backHref && <a href={backHref} className="font-mono text-sm text-fame-blue underline">{t('backToAssistant')}</a>}
      </div>

      <div className="rounded-lg border border-fame-ecru p-4">
        <h3 className="font-mono text-sm uppercase text-fame-text-muted mb-3">{t('unansweredTitle')}</h3>
        {rows.length === 0 ? <p className="text-fame-text-muted">{t('none')}</p> : (
          <table className="w-full text-sm text-fame-text-body">
            <thead><tr className="text-left font-mono text-xs uppercase text-fame-text-muted">
              <th className="py-1 pr-3">{t('colDate')}</th><th className="py-1 pr-3">{t('colLang')}</th>
              <th className="py-1 pr-3">{t('colQuestion')}</th><th className="py-1 pr-3">{t('colStatus')}</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-fame-ecru/60">
                  <td className="py-2 pr-3 font-mono text-xs">{fmt(r.created_at)}</td>
                  <td className="py-2 pr-3 font-mono text-xs uppercase">{r.lang}</td>
                  <td className="py-2 pr-3">{r.question}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.resolved ? t('resolved') : t('open')}</td>
                  <td className="py-2 whitespace-nowrap">
                    <button onClick={() => toggle(r.id, !r.resolved)} className="font-mono text-xs text-fame-blue underline">{r.resolved ? t('open') : t('markResolved')}</button>
                    <button onClick={() => del(r.id, 'unanswered')} className="font-mono text-xs text-fame-red underline ml-3">{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-fame-ecru p-4">
        <h3 className="font-mono text-sm uppercase text-fame-text-muted mb-3">{t('flaggedTitle')}</h3>
        {flaggedRows.length === 0 ? <p className="text-fame-text-muted">{t('none')}</p> : (
          <table className="w-full text-sm text-fame-text-body">
            <thead><tr className="text-left font-mono text-xs uppercase text-fame-text-muted">
              <th className="py-1 pr-3">{t('colDate')}</th><th className="py-1 pr-3">{t('colReason')}</th><th className="py-1 pr-3">{t('colQuestion')}</th><th></th>
            </tr></thead>
            <tbody>
              {flaggedRows.map(r => (
                <tr key={r.id} className="border-t border-fame-ecru/60">
                  <td className="py-2 pr-3 font-mono text-xs">{fmt(r.created_at)}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.reason}</td>
                  <td className="py-2 pr-3">{r.question}</td>
                  <td className="py-2 whitespace-nowrap"><button onClick={() => del(r.id, 'flagged')} className="font-mono text-xs text-fame-red underline">{t('delete')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
