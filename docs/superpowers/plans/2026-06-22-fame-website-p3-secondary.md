# FAME Website — Implementation Plan (Part 3: Secondary Features + Deploy)

> Continuation of Parts 1 & 2. Same global constraints apply.
> Tasks 13–20: Propose · Publications · Team · Prompts · Data/Dropbox · Emails · RGPD · Deploy

---

## Task 13: Propose Page + Admin Proposals

**Files:**
- Create: `src/app/api/proposals/route.ts`
- Create: `src/app/api/proposals/[id]/route.ts`
- Create: `src/app/api/proposals/[id]/convert/route.ts`
- Create: `src/components/propose/ProposalForm.tsx`
- Create: `src/components/propose/ProposalTracker.tsx`
- Create: `src/components/admin/ProposalTable.tsx`
- Modify: `src/app/[locale]/[lab]/propose/page.tsx`
- Modify: `src/app/[locale]/admin/proposals/page.tsx`

- [ ] **Step 1: Write `src/app/api/proposals/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, getSession, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

export async function GET(req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  const service = createServiceClient()
  let query = service.from('proposals').select('*').order('created_at', { ascending: false })
  if (lab) query = query.eq('labo', lab)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { labo, titre, domaine, difficulte = 'easy', description,
    proposant_prenom, proposant_nom, proposant_email } = body

  if (!labo || !titre?.trim() || !domaine || !description?.trim() || !proposant_prenom?.trim() || !proposant_nom?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('proposals')
    .insert({ labo, titre, domaine, difficulte, description,
      proposant_prenom, proposant_nom, proposant_email: proposant_email || null })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/proposals/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireAdmin()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const { statut, commentaire_admin } = await req.json()
  const service = createServiceClient()
  const { data, error } = await service
    .from('proposals')
    .update({ statut, commentaire_admin, traitee_at: new Date().toISOString(), traitee_par: member.id })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Write `src/app/api/proposals/[id]/convert/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = createServiceClient()

  const { data: proposal, error: pErr } = await service.from('proposals').select('*').eq('id', id).single()
  if (pErr || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  // Get max ordre for this lab
  const { data: last } = await service.from('subjects').select('ordre').eq('labo', proposal.labo)
    .order('ordre', { ascending: false }).limit(1).single()
  const ordre = (last?.ordre ?? -1) + 1

  const { data: subject, error: sErr } = await service.from('subjects').insert({
    labo: proposal.labo,
    titre: proposal.titre,
    kicker: proposal.domaine,
    statut: 'active',
    context: proposal.description,
    method: '', results: '', keywords: [], auteurs: [],
    dimensions: { method: '', data: '', theory: '', writing: '' },
    ordre,
  }).select().single()

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  // Mark proposal as accepted
  await service.from('proposals').update({ statut: 'accepted' }).eq('id', id)

  return NextResponse.json(subject, { status: 201 })
}
```

- [ ] **Step 4: Write `src/components/propose/ProposalForm.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Lab, Difficulty } from '@/types'

const DOMAINS = ['Monetary policy','Financial markets','Banking','International finance',
  'Behavioral finance','Macro-finance','Other']
const DIFFS: Difficulty[] = ['easy', 'intermediate', 'advanced']

type Props = { lab: Lab; onSubmitted: (id: string) => void }

export function ProposalForm({ lab, onSubmitted }: Props) {
  const t = useTranslations('propose')
  const [form, setForm] = useState({
    titre: '', domaine: '', difficulte: 'easy' as Difficulty,
    description: '', proposant_prenom: '', proposant_nom: '', proposant_email: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function set(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titre || !form.domaine || !form.description || !form.proposant_prenom || !form.proposant_nom) {
      setError(t('errorRequired')); return
    }
    if (form.proposant_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.proposant_email)) {
      setError(t('errorEmail')); return
    }
    setSubmitting(true)
    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labo: lab, ...form }),
    })
    setSubmitting(false)
    if (!res.ok) { setError('Error submitting proposal'); return }
    const data = await res.json()
    onSubmitted(data.id)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-xl">
      <h1 className="font-serif text-2xl font-bold text-fame-blue-dark">{t('title')}</h1>
      <p className="text-sm text-fame-text-muted">{t('subtitle')}</p>
      {error && <p className="text-sm text-fame-red">{error}</p>}

      <input type="text" placeholder={`${t('subjectTitle')} *`} value={form.titre} onChange={set('titre')}
        className="border border-fame-ecru rounded px-3 py-2 text-sm" required />

      <select value={form.domaine} onChange={set('domaine')} required
        className="border border-fame-ecru rounded px-3 py-2 text-sm">
        <option value="">{t('domain')} *</option>
        {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      <div className="flex gap-2">
        {DIFFS.map(d => (
          <button key={d} type="button" onClick={() => setForm(f => ({ ...f, difficulte: d }))}
            className={`flex-1 py-1.5 text-xs font-mono rounded border ${form.difficulte === d ? 'bg-fame-blue text-white border-fame-blue' : 'border-fame-ecru text-fame-text-muted'}`}>
            {t(`difficulty.${d}` as any)}
          </button>
        ))}
      </div>

      <textarea placeholder={`${t('description')} *`} value={form.description} onChange={set('description')}
        rows={4} className="border border-fame-ecru rounded px-3 py-2 text-sm resize-none" required />

      <div className="flex gap-2">
        <input type="text" placeholder={`${t('yourName')} (first) *`} value={form.proposant_prenom} onChange={set('proposant_prenom')}
          className="flex-1 border border-fame-ecru rounded px-3 py-2 text-sm" required />
        <input type="text" placeholder="Last name *" value={form.proposant_nom} onChange={set('proposant_nom')}
          className="flex-1 border border-fame-ecru rounded px-3 py-2 text-sm" required />
      </div>

      <input type="email" placeholder={t('email')} value={form.proposant_email} onChange={set('proposant_email')}
        className="border border-fame-ecru rounded px-3 py-2 text-sm" />

      <p className="text-[10px] text-fame-text-muted">{t('gdpr')}</p>
      <p className="text-[10px] text-fame-text-muted">{t('required')}</p>

      <button type="submit" disabled={submitting}
        className="bg-fame-blue text-white rounded py-2.5 text-sm font-medium hover:bg-fame-blue-dark disabled:opacity-50">
        {submitting ? '…' : t('send')}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Write `src/components/admin/ProposalTable.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { Proposal, Lab } from '@/types'

const STATUS_COLORS = { pending: '#e8b149', accepted: '#1e9b7e', rejected: '#c0473b' }

type Props = { lab?: Lab }

export function ProposalTable({ lab }: Props) {
  const t = useTranslations('admin')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const url = `/api/proposals${lab ? `?lab=${lab}` : ''}`
    const res = await fetch(url)
    if (res.ok) setProposals(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [lab])

  async function decide(id: string, statut: 'accepted' | 'rejected') {
    await fetch(`/api/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    })
    load()
  }

  async function convert(id: string) {
    await fetch(`/api/proposals/${id}/convert`, { method: 'POST' })
    load()
  }

  if (loading) return <p className="p-8 font-mono text-sm text-fame-text-muted">Loading…</p>

  return (
    <div className="p-6">
      <h1 className="font-serif text-2xl font-bold text-fame-blue-dark mb-6">{t('proposals')}</h1>
      <div className="flex flex-col gap-4">
        {proposals.map(p => (
          <div key={p.id} className="bg-white rounded-lg shadow-sm p-5 border border-fame-ecru">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif font-bold text-fame-blue-dark">{p.titre}</h3>
                <p className="text-xs font-mono text-fame-text-muted mt-0.5">{p.domaine} · {p.difficulte} · {p.labo}</p>
                <p className="text-sm text-gray-600 mt-2">{p.description}</p>
                <p className="text-xs text-fame-text-muted mt-2">— {p.proposant_prenom} {p.proposant_nom}{p.proposant_email ? ` <${p.proposant_email}>` : ''}</p>
              </div>
              <span
                className="shrink-0 px-2 py-0.5 text-xs font-mono rounded text-white"
                style={{ background: STATUS_COLORS[p.statut] }}
              >
                {t(`status.${p.statut}`)}
              </span>
            </div>

            {p.statut === 'pending' && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => decide(p.id, 'accepted')}
                  className="px-3 py-1.5 text-xs bg-fame-teal text-white rounded hover:bg-fame-teal/90">
                  {t('accept')}
                </button>
                <button onClick={() => decide(p.id, 'rejected')}
                  className="px-3 py-1.5 text-xs bg-fame-red text-white rounded hover:bg-fame-red/90">
                  {t('reject')}
                </button>
              </div>
            )}

            {p.statut === 'accepted' && (
              <button onClick={() => convert(p.id)}
                className="mt-3 px-3 py-1.5 text-xs border border-fame-blue text-fame-blue rounded hover:bg-fame-blue/10">
                {t('convertToSubject')}
              </button>
            )}
          </div>
        ))}
        {proposals.length === 0 && <p className="text-center text-fame-text-muted font-mono text-sm py-12">No proposals yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Replace propose and admin page stubs**

`src/app/[locale]/[lab]/propose/page.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ProposalForm } from '@/components/propose/ProposalForm'
import type { Lab } from '@/types'

export default function ProposePage() {
  const { lab } = useParams<{ lab: string }>()
  const t = useTranslations('propose')
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  if (submittedId) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center">
        <p className="font-serif text-xl text-fame-teal mb-4">{t('success')}</p>
        <button onClick={() => setSubmittedId(null)} className="text-sm text-fame-blue underline">Submit another</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <ProposalForm lab={lab as Lab} onSubmitted={setSubmittedId} />
    </div>
  )
}
```

`src/app/[locale]/admin/proposals/page.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ProposalTable } from '@/components/admin/ProposalTable'

type Props = { params: Promise<{ locale: string }> }

export default async function AdminProposalsPage({ params }: Props) {
  const { locale } = await params
  const session = await getSession()
  if (!session?.member?.is_admin) redirect(`/${locale}/auth/login`)
  return <ProposalTable />
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/proposals/ src/components/propose/ src/components/admin/ src/app/[locale]/[lab]/propose/ src/app/[locale]/admin/
git commit -m "feat: propose form + admin proposals dashboard with accept/reject/convert"
```

---

## Task 14: Publications Page

**Files:**
- Create: `src/app/api/publications/route.ts`
- Create: `src/app/api/publications/[id]/route.ts`
- Create: `src/components/publications/PublicationList.tsx`
- Create: `src/components/publications/AddPublicationModal.tsx`
- Modify: `src/app/[locale]/[lab]/publications/page.tsx`

- [ ] **Step 1: Write `src/app/api/publications/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  const service = createServiceClient()
  const { data, error } = await service
    .from('publications').select('*').eq('labo', lab).order('annee', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const body = await req.json()
  const { labo, titre, auteurs, annee, type, revue_ou_conf, lien } = body
  if (!labo || !titre || !annee || !type) {
    return NextResponse.json({ error: 'labo, titre, annee, type required' }, { status: 400 })
  }
  const service = createServiceClient()
  const { data, error } = await service
    .from('publications').insert({ labo, titre, auteurs: auteurs ?? [], annee, type, revue_ou_conf, lien })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/publications/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = createServiceClient()
  await service.from('publications').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/components/publications/PublicationList.tsx`**

```typescript
'use client'
import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { AddPublicationModal } from './AddPublicationModal'
import { EditModeToggle } from '@/components/ui/EditModeToggle'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Publication, Lab } from '@/types'

const TYPE_COLORS = { article: '#2f4486', preprint: '#5768ac', conference: '#1e9b7e', 'working-paper': '#e8b149' }

type Props = { lab: Lab; isMember: boolean }

export function PublicationList({ lab, isMember }: Props) {
  const t = useTranslations('publications')
  const [pubs, setPubs] = useState<Publication[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/publications?lab=${lab}`)
    if (res.ok) setPubs(await res.json())
  }

  useEffect(() => { load() }, [lab])

  const filtered = useMemo(() => {
    let list = pubs
    if (search) { const q = search.toLowerCase(); list = list.filter(p => p.titre.toLowerCase().includes(q) || p.auteurs.some(a => a.toLowerCase().includes(q))) }
    if (typeFilter) list = list.filter(p => p.type === typeFilter)
    return list
  }, [pubs, search, typeFilter])

  // Group by year
  const byYear = useMemo(() => {
    const map: Record<number, Publication[]> = {}
    for (const p of filtered) { if (!map[p.annee]) map[p.annee] = []; map[p.annee].push(p) }
    return Object.entries(map).sort(([a], [b]) => Number(b) - Number(a))
  }, [filtered])

  async function handleDelete() {
    if (!deleteId) return
    await fetch(`/api/publications/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null); load()
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold text-fame-blue-dark">{t('title')}</h1>
        {isMember && (
          <div className="flex gap-2">
            {editMode && <button onClick={() => setAddOpen(true)} className="px-3 py-1.5 text-xs font-mono bg-fame-teal text-white rounded">+ {t('addPublication')}</button>}
            <EditModeToggle active={editMode} onToggle={() => setEditMode(e => !e)} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-8">
        <input type="search" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-fame-ecru rounded px-3 py-2 text-sm" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-fame-ecru rounded px-3 py-2 text-sm">
          <option value="">{t('allTypes' as any)}</option>
          {['article','preprint','conference','working-paper'].map(t2 => <option key={t2} value={t2}>{t2}</option>)}
        </select>
      </div>

      {/* List by year */}
      {byYear.map(([year, items]) => (
        <div key={year} className="mb-10">
          <h2 className="font-mono text-sm font-bold text-fame-blue mb-3 border-b border-fame-ecru pb-1">{year}</h2>
          <div className="flex flex-col gap-4">
            {items.map(p => (
              <div key={p.id} className="bg-white rounded p-4 shadow-sm flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-white" style={{ background: TYPE_COLORS[p.type] }}>{p.type}</span>
                  </div>
                  <p className="font-serif text-sm font-bold text-fame-blue-dark">{p.titre}</p>
                  <p className="text-xs text-fame-text-muted mt-0.5">{p.auteurs.join(', ')}</p>
                  {p.revue_ou_conf && <p className="text-xs italic text-gray-500 mt-0.5">{p.revue_ou_conf}</p>}
                  {p.lien && <a href={p.lien} target="_blank" rel="noreferrer" className="text-xs text-fame-blue hover:underline mt-1 block">DOI / Link →</a>}
                </div>
                {editMode && (
                  <button onClick={() => setDeleteId(p.id)} className="text-fame-red text-xs font-mono hover:underline shrink-0">Delete</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {byYear.length === 0 && <p className="text-center font-mono text-sm text-fame-text-muted py-16">{t('noResults')}</p>}

      <AddPublicationModal open={addOpen} onClose={() => setAddOpen(false)} lab={lab} onCreated={load} />
      <ConfirmDialog open={!!deleteId} message="Delete this publication?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/publications/AddPublicationModal.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { Lab, PublicationType } from '@/types'

type Props = { open: boolean; onClose: () => void; lab: Lab; onCreated: () => void }

export function AddPublicationModal({ open, onClose, lab, onCreated }: Props) {
  const [form, setForm] = useState({ titre: '', auteurs: '', annee: String(new Date().getFullYear()), type: 'article' as PublicationType, revue_ou_conf: '', lien: '' })
  const [saving, setSaving] = useState(false)

  function set(key: string) { return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/publications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labo: lab, titre: form.titre, auteurs: form.auteurs.split(',').map(a => a.trim()).filter(Boolean), annee: parseInt(form.annee), type: form.type, revue_ou_conf: form.revue_ou_conf || null, lien: form.lien || null }),
    })
    setSaving(false)
    onCreated(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add publication">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="text" placeholder="Title *" value={form.titre} onChange={set('titre')} required className="border border-fame-ecru rounded px-3 py-2 text-sm" />
        <input type="text" placeholder="Authors (comma-separated) *" value={form.auteurs} onChange={set('auteurs')} required className="border border-fame-ecru rounded px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input type="number" placeholder="Year *" value={form.annee} onChange={set('annee')} required className="w-28 border border-fame-ecru rounded px-3 py-2 text-sm" />
          <select value={form.type} onChange={set('type')} className="flex-1 border border-fame-ecru rounded px-3 py-2 text-sm">
            {['article','preprint','conference','working-paper'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <input type="text" placeholder="Journal / Conference" value={form.revue_ou_conf} onChange={set('revue_ou_conf')} className="border border-fame-ecru rounded px-3 py-2 text-sm" />
        <input type="url" placeholder="DOI or URL" value={form.lien} onChange={set('lien')} className="border border-fame-ecru rounded px-3 py-2 text-sm" />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-fame-ecru rounded">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-fame-blue text-white rounded disabled:opacity-50">Add</button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 5: Replace `src/app/[locale]/[lab]/publications/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { PublicationList } from '@/components/publications/PublicationList'
import type { Lab } from '@/types'

type Props = { params: Promise<{ lab: string }> }

export default async function PublicationsPage({ params }: Props) {
  const { lab } = await params
  if (!['paris','montreal'].includes(lab)) notFound()
  const session = await getSession()
  return <PublicationList lab={lab as Lab} isMember={!!session?.member} />
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/publications/ src/components/publications/ src/app/[locale]/[lab]/publications/
git commit -m "feat: publications page — grouped by year, filters, add/delete (members)"
```

---

## Task 15: Team Page (Trombinoscope)

**Files:**
- Create: `src/app/api/members/route.ts`
- Create: `src/app/api/members/[id]/route.ts`
- Create: `src/app/api/members/invite/route.ts`
- Create: `src/components/team/MemberGrid.tsx`
- Create: `src/components/team/MemberCard.tsx`
- Create: `src/components/team/InviteModal.tsx`
- Modify: `src/app/[locale]/[lab]/team/page.tsx`

- [ ] **Step 1: Write `src/app/api/members/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { Lab } from '@/types'

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  const service = createServiceClient()
  const { data, error } = await service
    .from('members').select('id,prenom,nom,email,role,labo,domaines,photo_url,is_admin,activated_at,created_at')
    .eq('labo', lab).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Write `src/app/api/members/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  let session
  try { ({ session } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json()
  const isAdmin = session.member?.is_admin
  const isSelf = session.user.id === id

  // Members can only edit their own profile and only certain fields
  const SELF_FIELDS = ['email', 'domaines', 'photo_url']
  const ADMIN_FIELDS = ['prenom', 'nom', 'role', 'labo', 'is_admin', ...SELF_FIELDS]

  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const allowed = isAdmin ? ADMIN_FIELDS : SELF_FIELDS
  const updates: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) updates[key] = body[key] }

  const service = createServiceClient()
  const { data, error } = await service.from('members').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = createServiceClient()
  // Delete Supabase Auth user first
  await service.auth.admin.deleteUser(id)
  // Member row is deleted by cascade
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/app/api/members/invite/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth'
import crypto from 'crypto'
import type { Lab, Role } from '@/types'

export async function POST(req: NextRequest) {
  try { await requireAdmin() } catch (e) { return authErrorResponse(e) }
  const { email, prenom, nom, role, labo }: { email: string; prenom: string; nom: string; role: Role; labo: Lab } = await req.json()

  if (!email || !prenom || !nom || !role || !labo) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Create Supabase Auth user without password (they'll set it on activation)
  const tmpPassword = crypto.randomBytes(32).toString('hex')
  const { data: authData, error: authErr } = await service.auth.admin.createUser({
    email, password: tmpPassword, email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  // Insert member profile
  const { data: member, error: mErr } = await service.from('members')
    .insert({ id: authData.user.id, email, prenom, nom, role, labo, domaines: [], is_admin: false })
    .select().single()
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Generate activation token
  const token = crypto.randomBytes(32).toString('hex')
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await service.from('invitations').insert({ email, token, member_id: member.id, expires_at })

  // TODO (Task 18): send invitation email via Resend
  const activationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/en/auth/activate/${token}`
  console.log('Activation URL:', activationUrl)

  return NextResponse.json({ ok: true, activationUrl }, { status: 201 })
}
```

- [ ] **Step 4: Write `src/components/team/MemberCard.tsx`**

```typescript
import { Avatar } from '@/components/ui/Avatar'
import type { Member } from '@/types'

type Props = { member: Member; isSelf: boolean; isAdmin: boolean; onEdit: () => void; onDelete: () => void }

export function MemberCard({ member, isSelf, isAdmin, onEdit, onDelete }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 flex gap-4 items-start">
      <Avatar name={`${member.prenom} ${member.nom}`} photoUrl={member.photo_url} size={56} />
      <div className="flex-1 min-w-0">
        <p className="font-serif font-bold text-fame-blue-dark">{member.prenom} {member.nom}</p>
        <p className="text-xs font-mono text-fame-text-muted uppercase tracking-widest mt-0.5">{member.role}</p>
        {member.domaines.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {member.domaines.map((d, i) => (
              <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-fame-ecru rounded text-fame-blue">{d}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-fame-text-muted mt-1">{member.email}</p>
      </div>
      {(isSelf || isAdmin) && (
        <div className="flex flex-col gap-1">
          <button onClick={onEdit} className="text-xs text-fame-blue hover:underline">Edit</button>
          {isAdmin && !isSelf && (
            <button onClick={onDelete} className="text-xs text-fame-red hover:underline">Delete</button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Write `src/components/team/MemberGrid.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MemberCard } from './MemberCard'
import { InviteModal } from './InviteModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Member, Lab, Role } from '@/types'

const ROLE_ORDER: Role[] = ['direction', 'researcher', 'phd', 'engineering']

type Props = { lab: Lab; currentMemberId?: string; isAdmin: boolean }

export function MemberGrid({ lab, currentMemberId, isAdmin }: Props) {
  const t = useTranslations('team')
  const [members, setMembers] = useState<Member[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/members?lab=${lab}`)
    if (res.ok) setMembers(await res.json())
  }

  useEffect(() => { load() }, [lab])

  async function handleDelete() {
    if (!deleteId) return
    await fetch(`/api/members/${deleteId}`, { method: 'DELETE' })
    setDeleteId(null); load()
  }

  const byRole = ROLE_ORDER.map(role => ({
    role,
    members: members.filter(m => m.role === role),
  })).filter(g => g.members.length > 0)

  const ROLE_LABELS: Record<Role, string> = {
    direction: t('roles.direction'),
    researcher: t('roles.researchers'),
    phd: t('roles.phd'),
    engineering: t('roles.engineering'),
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold text-fame-blue-dark">{t('title')}</h1>
        {isAdmin && (
          <button onClick={() => setInviteOpen(true)} className="px-3 py-1.5 text-xs font-mono bg-fame-blue text-white rounded hover:bg-fame-blue-dark">
            + {t('inviteByEmail')}
          </button>
        )}
      </div>

      {byRole.map(({ role, members: group }) => (
        <div key={role} className="mb-10">
          <h2 className="font-mono text-xs uppercase tracking-widest text-fame-text-muted mb-4 border-b border-fame-ecru pb-1">
            {ROLE_LABELS[role]}
          </h2>
          <div className="flex flex-col gap-3">
            {group.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                isSelf={m.id === currentMemberId}
                isAdmin={isAdmin}
                onEdit={() => { /* TODO: open edit modal */ }}
                onDelete={() => setDeleteId(m.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} lab={lab} onInvited={load} />
      <ConfirmDialog open={!!deleteId} message="Remove this member from the team?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  )
}
```

- [ ] **Step 6: Write `src/components/team/InviteModal.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { Lab, Role } from '@/types'

const ROLES: Role[] = ['direction', 'researcher', 'phd', 'engineering']
type Props = { open: boolean; onClose: () => void; lab: Lab; onInvited: () => void }

export function InviteModal({ open, onClose, lab, onInvited }: Props) {
  const [form, setForm] = useState({ email: '', prenom: '', nom: '', role: 'researcher' as Role })
  const [result, setResult] = useState<{ activationUrl?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  function set(key: string) { return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/members/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, labo: lab }),
    })
    setSaving(false)
    if (res.ok) { setResult(await res.json()); onInvited() }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a member">
      {result ? (
        <div>
          <p className="text-sm text-fame-teal mb-3">Invitation sent! Share this activation link:</p>
          <code className="text-xs bg-fame-ecru rounded p-2 block break-all">{result.activationUrl}</code>
          <button onClick={() => { setResult(null); onClose() }} className="mt-4 text-sm text-fame-blue underline">Close</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input type="text" placeholder="First name *" value={form.prenom} onChange={set('prenom')} required className="flex-1 border border-fame-ecru rounded px-3 py-2 text-sm" />
            <input type="text" placeholder="Last name *" value={form.nom} onChange={set('nom')} required className="flex-1 border border-fame-ecru rounded px-3 py-2 text-sm" />
          </div>
          <input type="email" placeholder="Email *" value={form.email} onChange={set('email')} required className="border border-fame-ecru rounded px-3 py-2 text-sm" />
          <select value={form.role} onChange={set('role')} className="border border-fame-ecru rounded px-3 py-2 text-sm">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-fame-ecru rounded">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-fame-blue text-white rounded disabled:opacity-50">
              {saving ? '…' : 'Send invitation'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
```

- [ ] **Step 7: Replace `src/app/[locale]/[lab]/team/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { MemberGrid } from '@/components/team/MemberGrid'
import type { Lab } from '@/types'

type Props = { params: Promise<{ lab: string }> }

export default async function TeamPage({ params }: Props) {
  const { lab } = await params
  if (!['paris','montreal'].includes(lab)) notFound()
  const session = await getSession()
  return (
    <MemberGrid
      lab={lab as Lab}
      currentMemberId={session?.member?.id}
      isAdmin={session?.member?.is_admin ?? false}
    />
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/members/ src/components/team/ src/app/[locale]/[lab]/team/
git commit -m "feat: team page — trombinoscope, admin invite flow, member self-edit"
```

---

## Task 16: Prompts Page

**Files:**
- Create: `src/app/api/prompts/route.ts`
- Create: `src/app/api/prompts/[id]/route.ts`
- Create: `src/components/prompts/PromptCard.tsx`
- Create: `src/components/prompts/PromptList.tsx`
- Modify: `src/app/[locale]/[lab]/prompts/page.tsx`

- [ ] **Step 1: Write `src/app/api/prompts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  const service = createServiceClient()
  const { data, error } = await service.from('prompts').select('*').eq('labo', lab).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { labo, titre, type_cible, texte } = await req.json()
  if (!labo || !titre || !type_cible || !texte) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  const service = createServiceClient()
  const { data, error } = await service.from('prompts')
    .insert({ labo, titre, type_cible, texte, created_by: member.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/prompts/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const { titre, texte } = await req.json()
  const service = createServiceClient()
  const { data, error } = await service.from('prompts').update({ titre, texte }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = createServiceClient()
  await service.from('prompts').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/components/prompts/PromptList.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PromptCard } from './PromptCard'
import { Modal } from '@/components/ui/Modal'
import { EditModeToggle } from '@/components/ui/EditModeToggle'
import type { Prompt, Lab, PromptTarget } from '@/types'

const TARGETS: PromptTarget[] = ['subject','publication','data','member','task']

type Props = { lab: Lab }

export function PromptList({ lab }: Props) {
  const t = useTranslations('prompts')
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [filter, setFilter] = useState<PromptTarget | ''>('')
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newForm, setNewForm] = useState({ titre: '', type_cible: 'subject' as PromptTarget, texte: '' })

  async function load() {
    const res = await fetch(`/api/prompts?lab=${lab}`)
    if (res.ok) setPrompts(await res.json())
  }

  useEffect(() => { load() }, [lab])

  async function createPrompt(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labo: lab, ...newForm }),
    })
    setAddOpen(false); load()
  }

  const filtered = filter ? prompts.filter(p => p.type_cible === filter) : prompts

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-fame-blue-dark">{t('title')}</h1>
        <div className="flex gap-2">
          {editMode && <button onClick={() => setAddOpen(true)} className="px-3 py-1.5 text-xs font-mono bg-fame-teal text-white rounded">+ {t('newPrompt')}</button>}
          <EditModeToggle active={editMode} onToggle={() => setEditMode(e => !e)} />
        </div>
      </div>

      <p className="text-xs text-fame-text-muted mb-6">{t('subtitle')} <code className="bg-fame-ecru px-1 rounded">{'{{'}</code> {t('subtitleEnd')}</p>

      {/* Type filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-3 py-1 text-xs font-mono rounded border ${filter === '' ? 'bg-fame-blue text-white border-fame-blue' : 'border-fame-ecru text-fame-text-muted'}`}>{t('allTypes')}</button>
        {TARGETS.map(type => (
          <button key={type} onClick={() => setFilter(type)}
            className={`px-3 py-1 text-xs font-mono rounded border capitalize ${filter === type ? 'bg-fame-blue text-white border-fame-blue' : 'border-fame-ecru text-fame-text-muted'}`}>
            {type}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map(p => <PromptCard key={p.id} prompt={p} editMode={editMode} onUpdated={load} />)}
        {filtered.length === 0 && <p className="text-center text-fame-text-muted font-mono text-sm py-12">{t('noPrompts')}</p>}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('addPrompt')}>
        <form onSubmit={createPrompt} className="flex flex-col gap-3">
          <input type="text" placeholder="Title *" value={newForm.titre} onChange={e => setNewForm(f => ({ ...f, titre: e.target.value }))} required className="border border-fame-ecru rounded px-3 py-2 text-sm" />
          <select value={newForm.type_cible} onChange={e => setNewForm(f => ({ ...f, type_cible: e.target.value as PromptTarget }))} className="border border-fame-ecru rounded px-3 py-2 text-sm">
            {TARGETS.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
          <textarea placeholder="Prompt text *" value={newForm.texte} onChange={e => setNewForm(f => ({ ...f, texte: e.target.value }))} rows={6} required className="border border-fame-ecru rounded px-3 py-2 text-sm font-mono resize-none" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm border border-fame-ecru rounded">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm bg-fame-blue text-white rounded">Add</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/prompts/PromptCard.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { Prompt } from '@/types'

type Props = { prompt: Prompt; editMode: boolean; onUpdated: () => void }

export function PromptCard({ prompt, editMode, onUpdated }: Props) {
  const t = useTranslations('prompts')
  const { addToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(prompt.texte)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function saveEdit() {
    await fetch(`/api/prompts/${prompt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre: prompt.titre, texte: text }),
    })
    setEditing(false); addToast(t('saved'), 'success'); onUpdated()
  }

  async function handleDelete() {
    await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' })
    addToast(t('deleted'), 'info'); onUpdated()
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(prompt.texte)
    addToast(t('copied'), 'success')
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-fame-ecru">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-fame-text-muted">{prompt.type_cible}</span>
          <h3 className="font-serif font-bold text-fame-blue-dark text-sm mt-0.5">{prompt.titre}</h3>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={copyToClipboard} className="text-xs font-mono text-fame-blue hover:underline">{t('copy')}</button>
          {editMode && <>
            <button onClick={() => setEditing(e => !e)} className="text-xs font-mono text-fame-text-muted hover:text-fame-blue">{editing ? t('cancel') : t('edit')}</button>
            <button onClick={() => setConfirmDelete(true)} className="text-xs font-mono text-fame-red hover:underline">{t('delete')}</button>
          </>}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
            className="w-full border border-fame-ecru rounded px-2 py-1.5 text-xs font-mono resize-none focus:outline-none focus:border-fame-blue" />
          <button onClick={saveEdit} className="self-end px-3 py-1 text-xs bg-fame-blue text-white rounded">{t('save')}</button>
        </div>
      ) : (
        <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap bg-fame-ecru/40 rounded p-3 max-h-40 overflow-y-auto">{prompt.texte}</pre>
      )}

      <ConfirmDialog open={confirmDelete} message={`Delete prompt "${prompt.titre}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
    </div>
  )
}
```

- [ ] **Step 5: Replace `src/app/[locale]/[lab]/prompts/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { PromptList } from '@/components/prompts/PromptList'
import type { Lab } from '@/types'

type Props = { params: Promise<{ locale: string; lab: string }> }

export default async function PromptsPage({ params }: Props) {
  const { locale, lab } = await params
  const session = await getSession()
  if (!session?.member) redirect(`/${locale}/auth/login`)
  return <PromptList lab={lab as Lab} />
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/prompts/ src/components/prompts/ src/app/[locale]/[lab]/prompts/
git commit -m "feat: prompts library — copy, edit inline, delete, filter by type"
```

---

## Task 17: Data Page — Dropbox Integration

**Files:**
- Create: `src/lib/dropbox/client.ts`
- Create: `src/lib/dropbox/tree.ts`
- Create: `src/app/api/dropbox/tree/route.ts`
- Create: `src/app/api/dropbox/links/route.ts`
- Create: `src/app/api/dropbox/links/[id]/route.ts`
- Create: `src/components/data/DropboxNode.tsx`
- Create: `src/components/data/DropboxTree.tsx`
- Create: `src/components/data/LinkPanel.tsx`
- Modify: `src/app/[locale]/[lab]/data/page.tsx`

- [ ] **Step 1: Install Dropbox SDK**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm install dropbox
```

- [ ] **Step 2: Write `src/lib/dropbox/client.ts`**

```typescript
import { Dropbox } from 'dropbox'

let _client: Dropbox | null = null

export function getDropboxClient(): Dropbox {
  if (!_client) {
    const token = process.env.DROPBOX_ACCESS_TOKEN
    if (!token) throw new Error('DROPBOX_ACCESS_TOKEN not configured')
    _client = new Dropbox({ accessToken: token })
  }
  return _client
}
```

- [ ] **Step 3: Write `src/lib/dropbox/tree.ts`**

```typescript
import { getDropboxClient } from './client'
import type { DropboxNode } from '@/types'

export async function buildTree(path: string = ''): Promise<DropboxNode[]> {
  const dbx = getDropboxClient()
  const res = await dbx.filesListFolder({ path, recursive: false })
  const entries = res.result.entries

  const nodes: DropboxNode[] = await Promise.all(
    entries.map(async entry => {
      const isFolder = entry['.tag'] === 'folder'
      const node: DropboxNode = {
        id: (entry as any).id ?? entry.path_lower!,
        name: entry.name,
        path_lower: entry.path_lower!,
        is_folder: isFolder,
      }
      return node
    })
  )

  return nodes.sort((a, b) => {
    if (a.is_folder && !b.is_folder) return -1
    if (!a.is_folder && b.is_folder) return 1
    return a.name.localeCompare(b.name)
  })
}
```

- [ ] **Step 4: Write `src/app/api/dropbox/tree/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { buildTree } from '@/lib/dropbox/tree'
import { requireMember, authErrorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const path = req.nextUrl.searchParams.get('path') ?? ''
  try {
    const tree = await buildTree(path)
    return NextResponse.json(tree)
  } catch (err: any) {
    if (err.message === 'DROPBOX_ACCESS_TOKEN not configured') {
      return NextResponse.json({ error: 'Dropbox not configured. Set DROPBOX_ACCESS_TOKEN.' }, { status: 503 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Write `src/app/api/dropbox/links/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

export async function GET(req: NextRequest) {
  const subject_id = req.nextUrl.searchParams.get('subject_id')
  const task_id = req.nextUrl.searchParams.get('task_id')
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  const service = createServiceClient()
  let query = service.from('dropbox_links').select('*')
  if (subject_id) query = query.eq('subject_id', subject_id)
  if (task_id) query = query.eq('task_id', task_id)
  if (lab) query = query.eq('labo', lab)
  const { data, error } = await query.order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { node_id, node_path, node_name, labo, subject_id, task_id } = await req.json()
  if (!node_id || !labo || (!subject_id && !task_id)) {
    return NextResponse.json({ error: 'node_id, labo, and subject_id or task_id required' }, { status: 400 })
  }
  const service = createServiceClient()
  const { data, error } = await service.from('dropbox_links')
    .insert({ node_id, node_path, node_name, labo, subject_id: subject_id || null, task_id: task_id || null })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 6: Write `src/app/api/dropbox/links/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = createServiceClient()
  await service.from('dropbox_links').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Write `src/components/data/DropboxNode.tsx`**

```typescript
'use client'
import type { DropboxNode as Node } from '@/types'

type Props = {
  node: Node
  depth: number
  selected: Node | null
  onSelect: (n: Node) => void
  onExpand: (n: Node) => void
  children?: React.ReactNode
}

export function DropboxNode({ node, depth, selected, onSelect, onExpand, children }: Props) {
  const isSelected = selected?.id === node.id
  return (
    <div>
      <div
        onClick={() => { onSelect(node); if (node.is_folder) onExpand(node) }}
        style={{ paddingLeft: depth * 16 + 8 }}
        className={`flex items-center gap-2 py-1 cursor-pointer rounded text-sm font-mono ${isSelected ? 'bg-fame-blue/10 text-fame-blue' : 'hover:bg-fame-ecru text-fame-blue-dark'}`}
      >
        <span>{node.is_folder ? '📁' : '📄'}</span>
        <span className="truncate">{node.name}</span>
        {node.linked && <span className="ml-auto text-[10px] text-fame-teal">●</span>}
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 8: Write `src/components/data/DropboxTree.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { DropboxNode as NodeRow } from './DropboxNode'
import type { DropboxNode } from '@/types'

type Props = { onSelect: (n: DropboxNode) => void; selected: DropboxNode | null }

export function DropboxTree({ onSelect, selected }: Props) {
  const [root, setRoot] = useState<DropboxNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, DropboxNode[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dropbox/tree?path=')
      .then(r => r.json())
      .then(data => { if (data.error) setError(data.error); else setRoot(data) })
      .finally(() => setLoading(false))
  }, [])

  async function expand(node: DropboxNode) {
    if (!node.is_folder || expanded[node.id]) return
    const res = await fetch(`/api/dropbox/tree?path=${encodeURIComponent(node.path_lower)}`)
    const data = await res.json()
    setExpanded(e => ({ ...e, [node.id]: data }))
  }

  if (loading) return <p className="p-4 text-xs font-mono text-fame-text-muted">Loading Dropbox…</p>
  if (error) return <p className="p-4 text-xs font-mono text-fame-red">{error}</p>

  function renderNodes(nodes: DropboxNode[], depth: number): React.ReactNode {
    return nodes.map(n => (
      <NodeRow key={n.id} node={n} depth={depth} selected={selected} onSelect={onSelect} onExpand={expand}>
        {expanded[n.id] ? renderNodes(expanded[n.id], depth + 1) : null}
      </NodeRow>
    ))
  }

  return <div className="overflow-y-auto">{renderNodes(root, 0)}</div>
}
```

- [ ] **Step 9: Write `src/components/data/LinkPanel.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { DropboxNode, Subject, Task, DropboxLink, Lab } from '@/types'

type Props = { node: DropboxNode | null; lab: Lab }

export function LinkPanel({ node, lab }: Props) {
  const t = useTranslations('data')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [links, setLinks] = useState<DropboxLink[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedTask, setSelectedTask] = useState('')

  useEffect(() => {
    fetch(`/api/subjects?lab=${lab}`).then(r => r.json()).then(setSubjects)
    fetch(`/api/tasks?lab=${lab}`).then(r => r.json()).then(setTasks)
  }, [lab])

  useEffect(() => {
    if (!node) return
    fetch(`/api/dropbox/links?lab=${lab}`).then(r => r.json()).then(data =>
      setLinks((data ?? []).filter((l: DropboxLink) => l.node_id === node.id))
    )
  }, [node, lab])

  async function addLink(type: 'subject' | 'task') {
    if (!node) return
    const body = {
      node_id: node.id, node_path: node.path_lower, node_name: node.name, labo: lab,
      subject_id: type === 'subject' ? selectedSubject : null,
      task_id: type === 'task' ? selectedTask : null,
    }
    const res = await fetch('/api/dropbox/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const newLink = await res.json()
      setLinks(l => [...l, newLink])
    }
  }

  async function removeLink(id: string) {
    await fetch(`/api/dropbox/links/${id}`, { method: 'DELETE' })
    setLinks(l => l.filter(x => x.id !== id))
  }

  if (!node) return <div className="p-6 text-xs text-fame-text-muted">{t('noSelection')}</div>

  const filteredTasks = selectedSubject ? tasks.filter(t => t.sujet_id === selectedSubject) : tasks

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <p className="font-mono text-xs font-bold text-fame-blue-dark truncate">{node.name}</p>
        <p className="text-[10px] text-fame-text-muted font-mono truncate">{node.path_lower}</p>
      </div>

      {/* Existing links */}
      {links.length > 0 && (
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-fame-text-muted mb-2">{t('linkedTo')}</p>
          {links.map(l => {
            const label = l.subject_id ? subjects.find(s => s.id === l.subject_id)?.titre : tasks.find(t => t.id === l.task_id)?.titre
            return (
              <div key={l.id} className="flex items-center justify-between text-xs font-mono text-fame-blue bg-fame-ecru/50 rounded px-2 py-1 mb-1">
                <span className="truncate">{label ?? l.node_name}</span>
                <button onClick={() => removeLink(l.id)} className="text-fame-red ml-2 hover:underline">×</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Link to subject */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-fame-text-muted mb-1">{t('linkToSubject')}</p>
        <div className="flex gap-2">
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
            className="flex-1 border border-fame-ecru rounded px-2 py-1 text-xs font-mono">
            <option value="">{t('chooseSubject')}</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.titre}</option>)}
          </select>
          <button onClick={() => addLink('subject')} disabled={!selectedSubject}
            className="px-2 py-1 text-xs bg-fame-blue text-white rounded disabled:opacity-50">Link</button>
        </div>
      </div>

      {/* Link to task */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-fame-text-muted mb-1">{t('linkToTask')}</p>
        <div className="flex gap-2">
          <select value={selectedTask} onChange={e => setSelectedTask(e.target.value)}
            className="flex-1 border border-fame-ecru rounded px-2 py-1 text-xs font-mono">
            <option value="">{t('chooseTask')}</option>
            {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.titre}</option>)}
          </select>
          <button onClick={() => addLink('task')} disabled={!selectedTask}
            className="px-2 py-1 text-xs bg-fame-blue text-white rounded disabled:opacity-50">Link</button>
        </div>
      </div>

      <a href={`https://www.dropbox.com/home${node.path_lower}`} target="_blank" rel="noreferrer"
        className="text-xs font-mono text-fame-blue hover:underline">{t('openDropbox')}</a>
    </div>
  )
}
```

- [ ] **Step 10: Replace `src/app/[locale]/[lab]/data/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DropboxTree } from '@/components/data/DropboxTree'
import { LinkPanel } from '@/components/data/LinkPanel'
import type { DropboxNode, Lab } from '@/types'

export default function DataPage() {
  const { lab, locale } = useParams<{ lab: string; locale: string }>()
  const t = useTranslations('data')
  const router = useRouter()
  const [selected, setSelected] = useState<DropboxNode | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/auth/sign-in', { method: 'GET' }).then(r => {
      // Check auth via a simple members endpoint
      fetch('/api/members?lab=' + lab).then(r2 => {
        if (r2.status === 401) { setAuthed(false); router.push(`/${locale}/auth/login`) }
        else setAuthed(true)
      })
    })
  }, [])

  if (authed === null) return null

  return (
    <div className="flex h-[calc(100vh-48px)]">
      <aside className="w-64 shrink-0 border-r border-fame-ecru bg-fame-sand overflow-y-auto p-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-fame-text-muted px-2 py-2">{t('tree')}</p>
        <DropboxTree onSelect={setSelected} selected={selected} />
      </aside>
      <main className="flex-1 overflow-y-auto">
        <h1 className="font-serif text-lg font-bold text-fame-blue-dark px-6 py-4 border-b border-fame-ecru">{t('title')}</h1>
        <LinkPanel node={selected} lab={lab as Lab} />
      </main>
    </div>
  )
}
```

- [ ] **Step 11: Commit**

```bash
git add src/lib/dropbox/ src/app/api/dropbox/ src/components/data/ src/app/[locale]/[lab]/data/ package.json package-lock.json
git commit -m "feat: Dropbox data page — tree explorer, link to subjects/tasks, server-only token"
```

---

## Task 18: Transactional Emails (Resend)

**Files:**
- Create: `src/lib/resend/send-invitation.ts`
- Create: `src/lib/resend/send-proposal-result.ts`
- Modify: `src/app/api/members/invite/route.ts` (wire in email)
- Modify: `src/app/api/proposals/[id]/route.ts` (wire in email on decision)

- [ ] **Step 1: Write `src/lib/resend/send-invitation.ts`**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInvitationEmail(opts: {
  to: string
  prenom: string
  activationUrl: string
  lab: string
}) {
  const { to, prenom, activationUrl, lab } = opts
  await resend.emails.send({
    from: 'FAME <noreply@fame-lab.eu>',
    to,
    subject: `You're invited to join FAME ${lab === 'paris' ? 'Paris' : 'Montréal'}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#2f4486;">Welcome to FAME, ${prenom}!</h2>
        <p>You have been invited to join the FAME research team (${lab === 'paris' ? 'Paris' : 'Montréal'} lab).</p>
        <p>Click the link below to activate your account and set your password:</p>
        <a href="${activationUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2f4486;color:white;border-radius:6px;text-decoration:none;font-family:monospace;">
          Activate my account →
        </a>
        <p style="color:#888;font-size:12px;">This link expires in 7 days. If you did not expect this invitation, you can ignore this email.</p>
      </div>
    `,
  })
}
```

- [ ] **Step 2: Write `src/lib/resend/send-proposal-result.ts`**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendProposalResultEmail(opts: {
  to: string
  proposantPrenom: string
  titreProposal: string
  statut: 'accepted' | 'rejected'
  commentaire?: string | null
}) {
  const { to, proposantPrenom, titreProposal, statut, commentaire } = opts
  const accepted = statut === 'accepted'
  await resend.emails.send({
    from: 'FAME <noreply@fame-lab.eu>',
    to,
    subject: `Your FAME proposal: ${accepted ? 'accepted ✓' : 'not retained'}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#2f4486;">Hello ${proposantPrenom},</h2>
        <p>We have reviewed your research proposal: <strong>${titreProposal}</strong>.</p>
        ${accepted
          ? '<p>We are pleased to let you know that your proposal has been <strong style="color:#1e9b7e;">accepted</strong> by the team. We may reach out to you soon.</p>'
          : '<p>After review, we regret that we are unable to retain your proposal at this time.</p>'
        }
        ${commentaire ? `<p><em>Team note: ${commentaire}</em></p>` : ''}
        <p style="color:#888;font-size:12px;">Thank you for your interest in FAME research.</p>
      </div>
    `,
  })
}
```

- [ ] **Step 3: Wire invitation email into `src/app/api/members/invite/route.ts`**

Add after the invitation row insertion:
```typescript
import { sendInvitationEmail } from '@/lib/resend/send-invitation'
// ...
// After: await service.from('invitations').insert(...)
try {
  await sendInvitationEmail({ to: email, prenom, activationUrl, lab: labo })
} catch (emailErr) {
  console.error('Failed to send invitation email:', emailErr)
  // Do not fail the request — log and continue
}
```

- [ ] **Step 4: Wire proposal result email into `src/app/api/proposals/[id]/route.ts`**

Add after the `update` call:
```typescript
import { sendProposalResultEmail } from '@/lib/resend/send-proposal-result'
// ...
// After: const { data, error } = await service.from('proposals').update(...).single()
if (data?.proposant_email && (statut === 'accepted' || statut === 'rejected')) {
  try {
    await sendProposalResultEmail({
      to: data.proposant_email,
      proposantPrenom: data.proposant_prenom,
      titreProposal: data.titre,
      statut,
      commentaire: data.commentaire_admin,
    })
  } catch (emailErr) {
    console.error('Failed to send proposal result email:', emailErr)
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/resend/ src/app/api/members/invite/ src/app/api/proposals/
git commit -m "feat: transactional emails — member invitation, proposal result (Resend)"
```

---

## Task 19: RGPD — Privacy Policy Page

**Files:**
- Create: `src/app/[locale]/privacy/page.tsx`

- [ ] **Step 1: Write `src/app/[locale]/privacy/page.tsx`**

```typescript
import { getTranslations } from 'next-intl/server'

type Props = { params: Promise<{ locale: string }> }

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params
  const isFr = locale === 'fr'

  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <h1 className="font-serif text-2xl font-bold text-fame-blue-dark mb-8">
        {isFr ? 'Politique de confidentialité' : 'Privacy Policy'}
      </h1>

      <section className="mb-8">
        <h2 className="font-serif text-lg font-bold text-fame-blue mb-2">{isFr ? 'Données collectées' : 'Data collected'}</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {isFr
            ? 'Le site FAME collecte les données suivantes : (1) noms et prénoms des visiteurs qui laissent un commentaire ou soumettent une proposition de sujet ; (2) adresses email des visiteurs qui souhaitent recevoir un retour sur leur proposition ; (3) profils des membres de l\'équipe (nom, email, rôle, photo).'
            : 'The FAME website collects the following data: (1) names of visitors who post a comment or submit a research proposal; (2) email addresses of visitors who wish to receive feedback on their proposal; (3) team member profiles (name, email, role, photo).'}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-lg font-bold text-fame-blue mb-2">{isFr ? 'Finalité' : 'Purpose'}</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {isFr
            ? 'Ces données sont utilisées exclusivement pour : afficher les commentaires publiquement, traiter les propositions de sujets, contacter les proposants en cas de décision, gérer les accès membres.'
            : 'This data is used solely to: display comments publicly, process research proposals, contact proposers upon decision, and manage member access.'}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-lg font-bold text-fame-blue mb-2">{isFr ? 'Durée de conservation' : 'Retention period'}</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {isFr
            ? 'Les commentaires et propositions sont conservés 3 ans. Les profils membres sont conservés tant que la personne fait partie de l\'équipe.'
            : 'Comments and proposals are retained for 3 years. Member profiles are retained as long as the person is part of the team.'}
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-lg font-bold text-fame-blue mb-2">{isFr ? 'Vos droits' : 'Your rights'}</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {isFr
            ? 'Vous disposez d\'un droit d\'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à : '
            : 'You have the right to access, correct, and delete your data. To exercise these rights, contact us at: '}
          <a href="mailto:luca.desjardin@dauphine.eu" className="text-fame-blue hover:underline">luca.desjardin@dauphine.eu</a>.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-serif text-lg font-bold text-fame-blue mb-2">Cookies</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {isFr
            ? 'Ce site utilise uniquement un cookie de session httpOnly, strictement nécessaire au fonctionnement de l\'authentification. Aucun cookie de tracking ou publicitaire n\'est déposé.'
            : 'This site uses only a httpOnly session cookie, strictly necessary for authentication. No tracking or advertising cookies are set.'}
        </p>
      </section>

      <section>
        <h2 className="font-serif text-lg font-bold text-fame-blue mb-2">{isFr ? 'Hébergement' : 'Hosting'}</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {isFr
            ? 'Le site est hébergé sur Vercel. La base de données est hébergée sur Supabase (région EU West — Irlande). Les données ne sont pas transférées hors de l\'Union Européenne.'
            : 'The site is hosted on Vercel. The database is hosted on Supabase (EU West — Ireland region). Data is not transferred outside the European Union.'}
        </p>
      </section>
    </div>
  )
}
```

Add a footer link to the privacy page in `src/app/[locale]/[lab]/layout.tsx` (after `<main>`):
```typescript
<footer className="text-center py-4 border-t border-fame-ecru">
  <a href={`/${locale}/privacy`} className="text-[10px] font-mono text-fame-text-muted hover:text-fame-blue">
    Privacy policy
  </a>
</footer>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[locale]/privacy/ src/app/[locale]/[lab]/layout.tsx
git commit -m "feat: RGPD privacy policy page (EN + FR) + footer link"
```

---

## Task 20: Git, GitHub, Vercel Deployment

- [ ] **Step 1: Create `.gitignore` (verify it exists)**

```bash
cat "/home/lucad/Documents/Projets Programmation/FAME Website/.gitignore" | grep -E "\.env"
```

Expected: `.env*.local` is listed. If not, add it:
```
.env*.local
.env.local
```

- [ ] **Step 2: Create GitHub repository**

Go to https://github.com/new — create a private repository named `fame-website`. Do NOT initialize it (no README, no .gitignore — we already have both).

- [ ] **Step 3: Push to GitHub**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && git remote add origin https://github.com/YOUR_USERNAME/fame-website.git && git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

- [ ] **Step 4: Create Vercel project**

Go to https://vercel.com/new → Import Git repository → select `fame-website`.

Framework preset: **Next.js** (auto-detected).

- [ ] **Step 5: Add environment variables in Vercel**

In Vercel project settings → Environment Variables, add ALL variables from `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
NEXT_PUBLIC_APP_URL          ← set to your Vercel deployment URL (e.g. https://fame-website.vercel.app)
DROPBOX_ACCESS_TOKEN         ← add when ready (Phase 3)
```

- [ ] **Step 6: Deploy**

Click **Deploy**. Vercel will build and deploy automatically.

Expected build time: ~60-90 seconds. Check build logs for errors.

- [ ] **Step 7: Run seed script against production DB**

The seed script uses the same Supabase project, so it works against prod:
```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm run seed:admin
```

Expected: `Admin created: luca.desjardin@dauphine.eu` (or "already exists" if already run).

- [ ] **Step 8: Verify deployment**

Open the Vercel URL in a browser. Test:
1. Home globe loads
2. Click Paris pin → redirected to `/en/paris`
3. Sign in at `/en/auth/login` with `luca.desjardin@dauphine.eu` + the password set during seed
4. TopBar shows name + sign-out button
5. All nav links work

- [ ] **Step 9: (Optional) Add custom domain**

In Vercel project settings → Domains → add your custom domain and follow DNS instructions.

---

## Checklist — Spec Coverage Self-Review

| Spec requirement | Task |
|---|---|
| Home globe with Paris/Montréal pins | Task 7 |
| Locale EN/FR switcher everywhere | Tasks 5, 6 |
| Lab grid with A4 cards, hover zoom | Task 9 |
| Segmented progress bar (tasks/subtasks) | Task 5 (SegmentedBar component) |
| Drag-to-reorder (edit mode only) | Task 8 order API — **front drag not yet implemented** |
| Filter sidebar with counters | Task 9 (FilterSidebar) |
| Paper detail, inline edit, debounce | Task 11 (PaperSheet) |
| Linked tasks panel | Task 11 (TasksPanel) |
| Comments (visitor + member, delete) | Task 11 (CommentsPanel) + Task 10 API |
| Bottom thumbnail nav | Task 11 (PaperNav) |
| Kanban board per subject | Task 12 |
| Task modal: status, subtasks, assignees, history | Task 12 (TaskModal) |
| Claim/Unclaim task | Tasks 10 + 12 |
| Subtask auto-inherit assignees | Task 10 (POST /api/tasks) |
| Task history log | Task 10 (PATCH /api/tasks/[id]) |
| Proposal form + RGPD mention | Task 13 |
| Admin proposals dashboard | Task 13 |
| Convert proposal to subject | Task 13 (convert route) |
| Publications grouped by year + filters | Task 14 |
| Team trombinoscope by role | Task 15 |
| Admin invite member + activation | Tasks 15 + 18 |
| Dropbox tree (server-only token) | Task 17 |
| Link Dropbox node to subject/task | Task 17 |
| Prompts library (copy, edit, filter) | Task 16 |
| Invitation email (Resend) | Task 18 |
| Proposal result email | Task 18 |
| RGPD privacy policy page | Task 19 |
| Seed admin script | Task 3 |
| Vercel deployment | Task 20 |

**Known gaps (Phase 4 — not in this plan):**
- Drag-to-reorder front implementation (API is ready in Task 8)
- Individual member profile page with their tasks
- Task history display UI in modal (data is logged, UI is minimal)
- Photo upload to Supabase Storage
- Responsive mobile layout
