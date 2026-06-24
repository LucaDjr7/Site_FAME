'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ProposalStatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import type { Proposal, Lab, ProposalStatus } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']
const STATUSES: (ProposalStatus | 'all')[] = ['all', 'pending', 'accepted', 'rejected']

export function AdminProposalsClient() {
  const t = useTranslations('admin')
  const tdiff = useTranslations('tasks')
  const ts = useTranslations('proposalStatus')
  const locale = useLocale()
  const router = useRouter()
  const { addToast } = useToast()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [lab, setLab] = useState<Lab>('paris')
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('pending')
  const [comments, setComments] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    fetch(`/api/proposals?lab=${lab}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setProposals(data) })
  }, [lab])

  useEffect(() => {
    load()
  }, [load])

  async function decide(id: string, statut: 'accepted' | 'rejected') {
    const res = await fetch(`/api/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut, commentaire_admin: comments[id] ?? null }),
    })
    if (res.ok) {
      addToast(t('decisionSaved'), 'success')
      load()
    } else {
      addToast(t('actionError'), 'error')
    }
  }

  async function convert(id: string) {
    const res = await fetch(`/api/proposals/${id}/convert`, { method: 'POST' })
    if (res.ok) {
      const { subject_id } = await res.json()
      addToast(t('converted'), 'success')
      router.push(`/${locale}/${lab}/paper/${subject_id}`)
    } else {
      addToast(t('actionError'), 'error')
    }
  }

  const visible = proposals.filter(p => statusFilter === 'all' || p.statut === statusFilter)

  return (
    <div className="p-8">
      <h1 className="font-serif text-2xl font-bold text-fame-blue-dark mb-6">{t('proposalsTitle')}</h1>

      <div className="flex gap-6 mb-6 flex-wrap">
        {/* Lab filter */}
        <div className="flex gap-1">
          {LABS.map(l => (
            <button
              key={l}
              onClick={() => { setProposals([]); setLab(l) }}
              className={`px-3 py-1 text-xs font-mono rounded border capitalize transition-colors ${
                lab === l
                  ? 'bg-fame-blue text-white border-fame-blue'
                  : 'border-fame-ecru text-fame-text-muted hover:border-fame-blue'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                statusFilter === s
                  ? 'bg-fame-blue text-white border-fame-blue'
                  : 'border-fame-ecru text-fame-text-muted hover:border-fame-blue'
              }`}
            >
              {s === 'all' ? t('filterAll') : t(`filter${s.charAt(0).toUpperCase()}${s.slice(1)}` as 'filterPending' | 'filterAccepted' | 'filterRejected')}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-fame-text-muted">{t('noProposals')}</p>
      )}

      <div className="flex flex-col gap-4 max-w-3xl">
        {visible.map(p => (
          <div key={p.id} className="bg-white rounded-lg shadow-sm p-5 border border-fame-ecru">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="font-serif text-base font-bold text-fame-blue-dark">{p.titre}</h3>
                <p className="text-[11px] font-mono text-fame-text-muted uppercase tracking-widest mt-0.5">
                  {p.domaine} · {tdiff(`difficulty.${p.difficulte}`)} · {t('by')} {p.proposant_prenom} {p.proposant_nom}
                </p>
              </div>
              <ProposalStatusBadge status={p.statut} label={ts(p.statut)} />
            </div>

            <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap leading-relaxed">{p.description}</p>

            {p.statut === 'pending' && (
              <div className="flex flex-col gap-2 border-t border-fame-ecru pt-3">
                <input
                  type="text"
                  placeholder={t('commentPlaceholder')}
                  value={comments[p.id] ?? ''}
                  onChange={e => setComments(c => ({ ...c, [p.id]: e.target.value }))}
                  className="w-full border border-fame-ecru rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-fame-blue"
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => decide(p.id, 'accepted')}
                    className="px-3 py-1.5 text-xs font-mono bg-fame-teal text-white rounded hover:opacity-90 transition-opacity"
                  >
                    {t('accept')}
                  </button>
                  <button
                    onClick={() => decide(p.id, 'rejected')}
                    className="px-3 py-1.5 text-xs font-mono bg-fame-red text-white rounded hover:opacity-90 transition-opacity"
                  >
                    {t('reject')}
                  </button>
                  <button
                    onClick={() => convert(p.id)}
                    className="px-3 py-1.5 text-xs font-mono border border-fame-blue text-fame-blue rounded hover:bg-fame-blue hover:text-white transition-colors"
                  >
                    {t('convert')}
                  </button>
                </div>
              </div>
            )}

            {p.statut !== 'pending' && p.commentaire_admin && (
              <p className="text-xs text-fame-text-muted border-t border-fame-ecru pt-2 mt-2 italic">
                &quot;{p.commentaire_admin}&quot;
              </p>
            )}

            {p.statut === 'accepted' && (
              <button
                onClick={() => convert(p.id)}
                className="mt-2 px-3 py-1.5 text-xs font-mono border border-fame-blue text-fame-blue rounded hover:bg-fame-blue hover:text-white transition-colors"
              >
                {t('convert')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
