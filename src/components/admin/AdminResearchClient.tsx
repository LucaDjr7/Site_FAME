'use client'
import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import type { ResearchPaper, ResearchStatus, ResearchFetchLogEntry } from '@/types'

const STATUSES: (ResearchStatus | 'all')[] = ['all', 'published', 'rejected', 'hidden']

export function AdminResearchClient() {
  const t = useTranslations('adminResearch')
  const { addToast } = useToast()
  const [papers, setPapers] = useState<ResearchPaper[]>([])
  const [log, setLog] = useState<ResearchFetchLogEntry[]>([])
  const [statusFilter, setStatusFilter] = useState<ResearchStatus | 'all'>('published')
  const [form, setForm] = useState({ title: '', url: '', authors: '', abstract: '' })

  const load = useCallback(() => {
    const qs = statusFilter === 'all' ? '' : `?status=${statusFilter}`
    fetch(`/api/research${qs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setPapers(data) })
      .catch(() => addToast(t('actionError'), 'error'))
  }, [statusFilter, t, addToast])

  const loadLog = useCallback(() => {
    fetch('/api/research/fetch-log')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setLog(data) })
      .catch(() => addToast(t('actionError'), 'error'))
  }, [t, addToast])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadLog() }, [loadLog])

  async function hide(id: string) {
    const res = await fetch(`/api/research/${id}/hide`, { method: 'POST' })
    if (res.ok) load(); else addToast(t('actionError'), 'error')
  }

  async function republish(id: string) {
    const res = await fetch(`/api/research/${id}/publish`, { method: 'POST' })
    if (res.ok) load(); else addToast(t('actionError'), 'error')
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        url: form.url,
        authors: form.authors.split(',').map((a) => a.trim()).filter(Boolean),
        abstract: form.abstract || undefined,
      }),
    })
    if (res.ok) {
      addToast(t('added'), 'success')
      setForm({ title: '', url: '', authors: '', abstract: '' })
      load()
    } else {
      addToast(t('actionError'), 'error')
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px 80px' }}>
      <h1 className="font-serif" style={{ fontSize: 24, marginBottom: 20 }}>{t('title')}</h1>

      <form onSubmit={submitManual} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32, padding: 16, border: '1px solid rgba(20,40,90,0.1)', borderRadius: 10 }}>
        <strong style={{ fontSize: 13 }}>{t('addManual')}</strong>
        <input required placeholder={t('manualTitle')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input required placeholder={t('manualUrl')} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input placeholder={t('manualAuthors')} value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
        <textarea placeholder={t('manualAbstract')} value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} rows={2} />
        <button type="submit" style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, background: '#2f4486', color: '#fff', border: 'none', cursor: 'pointer' }}>
          {t('submit')}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
            border: statusFilter === s ? '1px solid #2f4486' : '1px solid rgba(20,40,90,0.14)',
            background: statusFilter === s ? 'rgba(47,68,134,0.12)' : 'transparent',
          }}>
            {t(`status${s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}` as 'statusAll')}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {papers.map((paper) => (
          <div key={paper.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid rgba(20,40,90,0.08)', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 13.5 }}>{paper.title}</div>
              <div className="font-mono" style={{ fontSize: 10.5, color: '#7e95d6' }}>
                {paper.source} · {paper.status} · {paper.fame_score ?? '—'}%
              </div>
            </div>
            {paper.status === 'published' && <button onClick={() => hide(paper.id)}>{t('hide')}</button>}
            {(paper.status === 'rejected' || paper.status === 'hidden') && <button onClick={() => republish(paper.id)}>{t('republish')}</button>}
          </div>
        ))}
      </div>

      <h2 className="font-serif" style={{ fontSize: 16, margin: '32px 0 12px' }}>{t('fetchLog')}</h2>
      {log.length === 0 ? (
        <p style={{ color: '#7e95d6', fontSize: 13 }}>{t('logEmpty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {log.map((entry) => (
            <div key={entry.id} className="font-mono" style={{
              fontSize: 11, padding: '8px 12px', borderRadius: 6,
              background: entry.errors > 0 ? 'rgba(192,71,59,0.08)' : 'rgba(30,155,126,0.06)',
              color: entry.errors > 0 ? '#c0473b' : '#2a3457',
            }}>
              {new Date(entry.run_at).toLocaleString()} · {entry.source} · added {entry.added} · skipped {entry.skipped} · errors {entry.errors}
              {entry.message ? ` · ${entry.message}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
