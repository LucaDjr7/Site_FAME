# FAME Website — Implementation Plan (Part 2: Core Features)

> Continuation of Part 1. Same global constraints apply.
> Tasks 8–14: Lab grid · Paper detail · Tasks kanban · Propose/Admin · Publications · Team · Prompts

---

## Task 8: Subjects API Routes

**Files:**
- Create: `src/app/api/subjects/route.ts`
- Create: `src/app/api/subjects/[id]/route.ts`
- Create: `src/app/api/subjects/[id]/order/route.ts`

**Interfaces:**
- Consumes: `requireMember()`, `requireAdmin()`, `authErrorResponse()` from `src/lib/auth.ts` · `createServiceClient()` from `src/lib/supabase/server.ts` · `Subject`, `Lab` from `src/types`
- Produces: REST endpoints consumed by the Lab page and Paper page

- [ ] **Step 1: Write `src/app/api/subjects/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

const VALID_LABS: Lab[] = ['paris', 'montreal']

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  if (!VALID_LABS.includes(lab)) {
    return NextResponse.json({ error: 'Invalid lab' }, { status: 400 })
  }
  const service = createServiceClient()
  const { data, error } = await service
    .from('subjects')
    .select('*')
    .eq('labo', lab)
    .order('ordre', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    await requireMember()
  } catch (e) { return authErrorResponse(e) }

  const body = await req.json()
  const { labo, titre, kicker = '', statut = 'active', context = '', method = '',
    results = '', keywords = [], auteurs = [], dimensions } = body

  if (!VALID_LABS.includes(labo) || !titre?.trim()) {
    return NextResponse.json({ error: 'labo and titre required' }, { status: 400 })
  }

  const service = createServiceClient()
  // Get current max ordre for this lab
  const { data: last } = await service
    .from('subjects')
    .select('ordre')
    .eq('labo', labo)
    .order('ordre', { ascending: false })
    .limit(1)
    .single()

  const ordre = (last?.ordre ?? -1) + 1

  const { data, error } = await service
    .from('subjects')
    .insert({ labo, titre, kicker, statut, context, method, results, keywords, auteurs,
      dimensions: dimensions ?? { method: '', data: '', theory: '', writing: '' }, ordre })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/subjects/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service.from('subjects').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json()
  const allowed = ['titre','kicker','statut','context','method','results','keywords','auteurs','dimensions']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  const service = createServiceClient()
  const { data, error } = await service.from('subjects').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = createServiceClient()
  const { error } = await service.from('subjects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/app/api/subjects/[id]/order/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// Body: { orderedIds: string[] } — full ordered array of subject IDs for a lab
export async function PATCH(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { orderedIds }: { orderedIds: string[] } = await req.json()
  const service = createServiceClient()
  const updates = orderedIds.map((id, ordre) =>
    service.from('subjects').update({ ordre }).eq('id', id)
  )
  await Promise.all(updates)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/subjects/
git commit -m "feat: subjects API routes — CRUD + reorder"
```

---

## Task 9: Lab Page — Subject Grid

**Files:**
- Create: `src/components/lab/SubjectCard.tsx`
- Create: `src/components/lab/FilterSidebar.tsx`
- Create: `src/components/lab/AddSubjectModal.tsx`
- Create: `src/components/lab/SubjectGrid.tsx`
- Modify: `src/app/[locale]/[lab]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/subjects?lab=X` · `SubjectWithProgress`, `SubjectStatus`, `Member` types · `SegmentedBar`, `SubjectStatusBadge`, `Avatar`, `Modal`, `ConfirmDialog`, `EditModeToggle` UI components
- Produces: interactive grid page at `/{locale}/{lab}`

- [ ] **Step 1: Write `src/components/lab/SubjectCard.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { SegmentedBar } from '@/components/ui/SegmentedBar'
import { SubjectStatusBadge } from '@/components/ui/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import type { SubjectWithProgress } from '@/types'

type Props = {
  subject: SubjectWithProgress
  editMode: boolean
  onDelete: (id: string) => void
}

const STATUS_LABELS = { active: 'Active', done: 'Done', 'on-hold': 'On hold' }
const DIM_KEYS = ['method', 'data', 'theory', 'writing'] as const

export function SubjectCard({ subject, editMode, onDelete }: Props) {
  const locale = useLocale()
  const { lab } = useParams<{ lab: string }>()
  const t = useTranslations('lab')

  return (
    <div
      className="relative group"
      style={{ perspective: 600 }}
    >
      <Link
        href={`/${locale}/${lab}/paper/${subject.id}`}
        className="block bg-white rounded shadow-md overflow-hidden"
        style={{
          aspectRatio: '210/297',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.4)'; (e.currentTarget as HTMLElement).style.zIndex = '10'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.zIndex = '1'; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
      >
        {/* A4 paper layout */}
        <div className="p-5 h-full flex flex-col gap-2">
          {/* Status + DONE badge */}
          <div className="flex items-start justify-between gap-2">
            <SubjectStatusBadge status={subject.statut} label={STATUS_LABELS[subject.statut]} />
            {subject.statut === 'done' && (
              <span className="text-[9px] font-mono font-bold text-fame-teal tracking-widest uppercase">{t('done')}</span>
            )}
          </div>

          {/* Title */}
          <h2 className="font-serif text-sm font-bold text-fame-blue-dark leading-tight mt-1">{subject.titre}</h2>

          {/* Kicker */}
          {subject.kicker && (
            <p className="font-mono text-[9px] text-fame-text-muted uppercase tracking-widest">{subject.kicker}</p>
          )}

          {/* Dimensions pills */}
          <div className="flex flex-wrap gap-1 mt-auto">
            {DIM_KEYS.map(k => subject.dimensions[k] ? (
              <span key={k} className="text-[8px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-fame-ecru text-fame-blue">
                {k}
              </span>
            ) : null)}
          </div>

          {/* Authors */}
          {subject.members.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {subject.members.map(m => (
                <Avatar key={m.id} name={`${m.prenom} ${m.nom}`} photoUrl={m.photo_url} size={18} />
              ))}
            </div>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[8px] font-mono text-fame-text-muted">
                {subject.tasks_done} / {subject.tasks_total} {t('tasks')}
              </span>
            </div>
            <SegmentedBar total={subject.tasks_total} done={subject.tasks_done} height={3} />
          </div>
        </div>
      </Link>

      {/* Delete button in edit mode */}
      {editMode && (
        <button
          onClick={() => onDelete(subject.id)}
          className="absolute top-2 right-2 z-20 bg-fame-red text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete subject"
        >×</button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/lab/FilterSidebar.tsx`**

```typescript
'use client'
import { useTranslations } from 'next-intl'
import type { SubjectWithProgress } from '@/types'

type Filters = {
  search: string
  dims: Set<string>
  sort: 'asc' | 'desc'
}

type Props = {
  subjects: SubjectWithProgress[]
  filters: Filters
  onChange: (f: Filters) => void
  collapsed: boolean
  onToggle: () => void
}

const DIMS = ['method', 'data', 'theory', 'writing'] as const

export function FilterSidebar({ subjects, filters, onChange, collapsed, onToggle }: Props) {
  const t = useTranslations('lab')

  function toggleDim(d: string) {
    const next = new Set(filters.dims)
    next.has(d) ? next.delete(d) : next.add(d)
    onChange({ ...filters, dims: next })
  }

  function dimCount(d: string) {
    return subjects.filter(s => s.dimensions[d as keyof typeof s.dimensions]).length
  }

  return (
    <aside
      className="shrink-0 transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? 36 : 220 }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-3 text-xs font-mono text-fame-text-muted hover:text-fame-blue uppercase tracking-widest"
      >
        {!collapsed && t('filters')}
        <span>{collapsed ? '›' : '‹'}</span>
      </button>

      {!collapsed && (
        <div className="px-3 flex flex-col gap-4">
          {/* Search */}
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            className="w-full border border-fame-ecru rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-fame-blue"
          />

          {/* Dimensions */}
          <div className="flex flex-col gap-1">
            {DIMS.map(d => (
              <label key={d} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.dims.has(d)}
                  onChange={() => toggleDim(d)}
                  className="accent-fame-blue"
                />
                <span className="text-xs font-mono capitalize text-fame-blue-dark">{d}</span>
                <span className="ml-auto text-[10px] text-fame-text-muted">{dimCount(d)}</span>
              </label>
            ))}
          </div>

          {/* Sort */}
          <div>
            <p className="text-[10px] font-mono text-fame-text-muted uppercase tracking-widest mb-1">{t('sortDate')}</p>
            <div className="flex gap-1">
              {(['asc', 'desc'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => onChange({ ...filters, sort: s })}
                  className={`flex-1 py-1 text-xs font-mono rounded border ${filters.sort === s ? 'bg-fame-blue text-white border-fame-blue' : 'border-fame-ecru text-fame-text-muted hover:border-fame-blue'}`}
                >
                  {s === 'asc' ? '↑' : '↓'}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => onChange({ search: '', dims: new Set(), sort: 'desc' })}
            className="text-xs font-mono text-fame-text-muted underline hover:text-fame-blue text-left"
          >
            {t('reset')}
          </button>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 3: Write `src/components/lab/AddSubjectModal.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import type { Lab, SubjectStatus } from '@/types'

type Props = { open: boolean; onClose: () => void; lab: Lab; onCreated: () => void }

export function AddSubjectModal({ open, onClose, lab, onCreated }: Props) {
  const t = useTranslations('lab')
  const tc = useTranslations('common')
  const [titre, setTitre] = useState('')
  const [kicker, setKicker] = useState('')
  const [statut, setStatut] = useState<SubjectStatus>('active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) { setError('Title required'); return }
    setSaving(true)
    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labo: lab, titre, kicker, statut }),
    })
    setSaving(false)
    if (!res.ok) { setError('Error creating subject'); return }
    setTitre(''); setKicker(''); setStatut('active'); setError('')
    onCreated()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('addSubject')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <p className="text-fame-red text-sm">{error}</p>}
        <input
          type="text" placeholder="Title *" value={titre}
          onChange={e => setTitre(e.target.value)} required
          className="border border-fame-ecru rounded px-3 py-2 text-sm"
        />
        <input
          type="text" placeholder="Kicker (thematic subtitle)" value={kicker}
          onChange={e => setKicker(e.target.value)}
          className="border border-fame-ecru rounded px-3 py-2 text-sm"
        />
        <select
          value={statut}
          onChange={e => setStatut(e.target.value as SubjectStatus)}
          className="border border-fame-ecru rounded px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="on-hold">On hold</option>
          <option value="done">Done</option>
        </select>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-fame-ecru rounded hover:bg-fame-ecru">{tc('cancel')}</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-fame-blue text-white rounded hover:bg-fame-blue-dark disabled:opacity-50">
            {saving ? tc('loading') : tc('add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 4: Write `src/components/lab/SubjectGrid.tsx`**

```typescript
'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { SubjectCard } from './SubjectCard'
import { FilterSidebar } from './FilterSidebar'
import { AddSubjectModal } from './AddSubjectModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EditModeToggle } from '@/components/ui/EditModeToggle'
import { useToast } from '@/components/ui/Toast'
import type { SubjectWithProgress, Lab } from '@/types'

type Props = { lab: Lab; isMember: boolean }

export function SubjectGrid({ lab, isMember }: Props) {
  const t = useTranslations('lab')
  const { addToast } = useToast()
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [filters, setFilters] = useState({ search: '', dims: new Set<string>(), sort: 'desc' as 'asc' | 'desc' })

  const load = useCallback(async () => {
    setLoading(true)
    const [subjRes, tasksRes] = await Promise.all([
      fetch(`/api/subjects?lab=${lab}`).then(r => r.json()),
      fetch(`/api/tasks?lab=${lab}`).then(r => r.json()),
    ])
    // Build tasks_total / tasks_done per subject
    const tasksBySubject: Record<string, { total: number; done: number }> = {}
    for (const task of (tasksRes ?? [])) {
      if (!tasksBySubject[task.sujet_id]) tasksBySubject[task.sujet_id] = { total: 0, done: 0 }
      tasksBySubject[task.sujet_id].total++
      if (task.statut === 'done') tasksBySubject[task.sujet_id].done++
    }
    const enriched: SubjectWithProgress[] = (subjRes ?? []).map((s: SubjectWithProgress) => ({
      ...s,
      tasks_total: tasksBySubject[s.id]?.total ?? 0,
      tasks_done: tasksBySubject[s.id]?.done ?? 0,
      members: [],
    }))
    setSubjects(enriched)
    setLoading(false)
  }, [lab])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = [...subjects]
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(s => s.titre.toLowerCase().includes(q) || s.kicker.toLowerCase().includes(q))
    }
    if (filters.dims.size > 0) {
      list = list.filter(s => [...filters.dims].some(d => s.dimensions[d as keyof typeof s.dimensions]))
    }
    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime()
      const db = new Date(b.created_at).getTime()
      return filters.sort === 'asc' ? da - db : db - da
    })
    return list
  }, [subjects, filters])

  async function handleDelete() {
    if (!deleteId) return
    const res = await fetch(`/api/subjects/${deleteId}`, { method: 'DELETE' })
    if (res.ok) { addToast('Subject deleted', 'success'); load() }
    else addToast('Error deleting subject', 'error')
    setDeleteId(null)
  }

  if (loading) return <div className="p-12 text-center font-mono text-sm text-fame-text-muted">Loading…</div>

  return (
    <div className="flex gap-0 h-[calc(100vh-48px)]">
      <FilterSidebar
        subjects={subjects}
        filters={filters}
        onChange={setFilters}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-xl font-bold text-fame-blue-dark capitalize">{lab}</h1>
          {isMember && (
            <div className="flex gap-2">
              {editMode && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="px-3 py-1.5 text-xs font-mono bg-fame-teal text-white rounded hover:bg-fame-teal/90"
                >
                  + {t('addSubject')}
                </button>
              )}
              <EditModeToggle active={editMode} onToggle={() => setEditMode(e => !e)} />
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {filtered.map(s => (
            <SubjectCard
              key={s.id}
              subject={s}
              editMode={editMode}
              onDelete={id => setDeleteId(id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center font-mono text-sm text-fame-text-muted mt-20">No subjects match the current filters.</p>
        )}
      </div>

      <AddSubjectModal open={addOpen} onClose={() => setAddOpen(false)} lab={lab} onCreated={load} />
      <ConfirmDialog
        open={!!deleteId}
        message="Delete this subject? All linked tasks and comments will be deleted."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
```

- [ ] **Step 5: Replace `src/app/[locale]/[lab]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { SubjectGrid } from '@/components/lab/SubjectGrid'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']

type Props = { params: Promise<{ locale: string; lab: string }> }

export default async function LabPage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()
  const session = await getSession()
  const isMember = !!session?.member

  return <SubjectGrid lab={lab as Lab} isMember={isMember} />
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/lab/ src/app/[locale]/[lab]/page.tsx src/app/api/subjects/
git commit -m "feat: lab page — subject grid with filters, edit mode, add/delete"
```

---

## Task 10: Tasks API Routes

**Files:**
- Create: `src/app/api/tasks/route.ts`
- Create: `src/app/api/tasks/[id]/route.ts`
- Create: `src/app/api/tasks/[id]/subtasks/route.ts`
- Create: `src/app/api/tasks/[id]/claim/route.ts`
- Create: `src/app/api/comments/route.ts`
- Create: `src/app/api/comments/[id]/route.ts`

- [ ] **Step 1: Write `src/app/api/tasks/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'
import type { Lab } from '@/types'

export async function GET(req: NextRequest) {
  const lab = req.nextUrl.searchParams.get('lab') as Lab
  const subjectId = req.nextUrl.searchParams.get('subject_id')
  const service = createServiceClient()

  let query = service
    .from('tasks')
    .select(`*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*)`)
    .order('date_creation', { ascending: false })

  if (lab) query = query.eq('labo', lab)
  if (subjectId) query = query.eq('sujet_id', subjectId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const body = await req.json()
  const { labo, titre, sujet_id, description = '', statut = 'to-do',
    difficulte = 'easy', assignee_ids = [], subtask_labels = [] } = body

  if (!labo || !titre?.trim() || !sujet_id) {
    return NextResponse.json({ error: 'labo, titre, sujet_id required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: task, error } = await service
    .from('tasks')
    .insert({ labo, titre, sujet_id, description, statut, difficulte })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert assignees
  if (assignee_ids.length > 0) {
    await service.from('task_assignees').insert(assignee_ids.map((mid: string) => ({ task_id: task.id, member_id: mid })))
  }

  // Insert subtasks (inherit assignees)
  if (subtask_labels.length > 0) {
    const { data: subs } = await service.from('subtasks')
      .insert(subtask_labels.map((label: string, i: number) => ({ task_id: task.id, label, ordre: i })))
      .select()
    if (subs && assignee_ids.length > 0) {
      const subAssignees = subs.flatMap((s: { id: string }) =>
        assignee_ids.map((mid: string) => ({ subtask_id: s.id, member_id: mid }))
      )
      await service.from('subtask_assignees').insert(subAssignees)
    }
  }

  return NextResponse.json(task, { status: 201 })
}
```

- [ ] **Step 2: Write `src/app/api/tasks/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse, getSession } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const service = createServiceClient()
  const { data, error } = await service
    .from('tasks')
    .select(`*, task_assignees(member_id, members(id,prenom,nom,photo_url)), subtasks(*, subtask_assignees(member_id, members(id,prenom,nom,photo_url)))`)
    .eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  let session
  try { ({ session } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const body = await req.json()
  const allowed = ['titre','description','statut','difficulte','sujet_id','date_echeance']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) updates[key] = body[key] }

  const service = createServiceClient()

  // Record history for status change
  if ('statut' in body) {
    const { data: old } = await service.from('tasks').select('statut').eq('id', id).single()
    if (old && old.statut !== body.statut) {
      const name = session.member ? `${session.member.prenom} ${session.member.nom}` : 'Unknown'
      await service.from('task_history').insert({
        task_id: id, auteur_id: session.user.id, auteur_nom: name,
        champ: 'statut', valeur_avant: old.statut, valeur_apres: body.statut,
      })
    }
  }

  const { data, error } = await service.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = createServiceClient()
  const { error } = await service.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Write `src/app/api/tasks/[id]/subtasks/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id: task_id } = await params
  const { label, ordre = 0 } = await req.json()
  const service = createServiceClient()
  const { data, error } = await service.from('subtasks').insert({ task_id, label, ordre }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/tasks/[id]/subtasks — body: { subtask_id, done }
export async function PATCH(req: NextRequest, _params: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { subtask_id, done } = await req.json()
  const service = createServiceClient()
  const { data, error } = await service.from('subtasks').update({ done }).eq('id', subtask_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Write `src/app/api/tasks/[id]/claim/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// POST: toggle — if already assigned, remove; otherwise add
export async function POST(req: NextRequest, { params }: Params) {
  let member
  try { ({ member } = await requireMember()) } catch (e) { return authErrorResponse(e) }
  const { id: task_id } = await params
  const service = createServiceClient()

  const { data: existing } = await service.from('task_assignees')
    .select('*').eq('task_id', task_id).eq('member_id', member.id).single()

  if (existing) {
    await service.from('task_assignees').delete().eq('task_id', task_id).eq('member_id', member.id)
    return NextResponse.json({ claimed: false })
  } else {
    await service.from('task_assignees').insert({ task_id, member_id: member.id })
    return NextResponse.json({ claimed: true })
  }
}
```

- [ ] **Step 5: Write `src/app/api/comments/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { sujet_id, texte, visitor_prenom, visitor_nom } = await req.json()
  if (!sujet_id || !texte?.trim()) {
    return NextResponse.json({ error: 'sujet_id and texte required' }, { status: 400 })
  }

  const session = await getSession()
  const service = createServiceClient()

  let auteur_type: 'visitor' | 'member'
  let auteur_nom: string
  let membre_id: string | null = null

  if (session?.member) {
    auteur_type = 'member'
    auteur_nom = `${session.member.prenom} ${session.member.nom}`
    membre_id = session.member.id
  } else {
    if (!visitor_prenom?.trim() || !visitor_nom?.trim()) {
      return NextResponse.json({ error: 'First name and last name required for visitors' }, { status: 400 })
    }
    auteur_type = 'visitor'
    auteur_nom = `${visitor_prenom.trim()} ${visitor_nom.trim()}`
  }

  const { data, error } = await service
    .from('comments')
    .insert({ sujet_id, auteur_type, auteur_nom, membre_id, texte })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 6: Write `src/app/api/comments/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireMember, authErrorResponse } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  try { await requireMember() } catch (e) { return authErrorResponse(e) }
  const { id } = await params
  const service = createServiceClient()
  const { error } = await service.from('comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/tasks/ src/app/api/comments/
git commit -m "feat: tasks and comments API routes — CRUD, claim/unclaim, subtask toggle, history"
```

---

## Task 11: Paper Page

**Files:**
- Create: `src/components/paper/PaperSheet.tsx`
- Create: `src/components/paper/TasksPanel.tsx`
- Create: `src/components/paper/FilesPanel.tsx`
- Create: `src/components/paper/CommentsPanel.tsx`
- Create: `src/components/paper/PaperNav.tsx`
- Modify: `src/app/[locale]/[lab]/paper/[id]/page.tsx`

- [ ] **Step 1: Write `src/components/paper/PaperSheet.tsx`**

```typescript
'use client'
import { useState, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { SubjectStatusBadge } from '@/components/ui/StatusBadge'
import { SegmentedBar } from '@/components/ui/SegmentedBar'
import type { SubjectWithProgress, SubjectStatus } from '@/types'

type Props = {
  subject: SubjectWithProgress
  editMode: boolean
  onUpdate: (fields: Partial<SubjectWithProgress>) => void
}

export function PaperSheet({ subject, editMode, onUpdate }: Props) {
  const t = useTranslations('paper')
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debounceSave = useCallback((fields: Partial<SubjectWithProgress>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await fetch(`/api/subjects/${subject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 2000)
    onUpdate(fields)
  }, [subject.id, onUpdate])

  const Field = ({ field, multiline = false }: { field: keyof SubjectWithProgress; multiline?: boolean }) => {
    const value = (subject[field] as string) ?? ''
    if (!editMode) return <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">{value || <span className="text-gray-300 italic">—</span>}</p>
    if (multiline) return (
      <textarea
        defaultValue={value}
        onChange={e => debounceSave({ [field]: e.target.value } as Partial<SubjectWithProgress>)}
        className="w-full text-sm leading-relaxed text-gray-700 border-0 border-b border-fame-ecru focus:outline-none focus:border-fame-blue bg-transparent resize-none min-h-[80px]"
      />
    )
    return (
      <input
        type="text" defaultValue={value}
        onChange={e => debounceSave({ [field]: e.target.value } as Partial<SubjectWithProgress>)}
        className="w-full text-sm text-gray-700 border-0 border-b border-fame-ecru focus:outline-none focus:border-fame-blue bg-transparent"
      />
    )
  }

  return (
    <div className="bg-white shadow-xl rounded-sm mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          {editMode ? (
            <input
              type="text" defaultValue={subject.titre}
              onChange={e => debounceSave({ titre: e.target.value })}
              className="font-serif text-2xl font-bold text-fame-blue-dark w-full border-0 border-b border-fame-ecru focus:outline-none focus:border-fame-blue bg-transparent"
            />
          ) : (
            <h1 className="font-serif text-2xl font-bold text-fame-blue-dark">{subject.titre}</h1>
          )}
          {editMode ? (
            <input
              type="text" defaultValue={subject.kicker}
              onChange={e => debounceSave({ kicker: e.target.value })}
              className="font-mono text-xs text-fame-text-muted uppercase tracking-widest mt-1 w-full border-0 border-b border-fame-ecru focus:outline-none bg-transparent"
            />
          ) : (
            <p className="font-mono text-xs text-fame-text-muted uppercase tracking-widest mt-1">{subject.kicker}</p>
          )}
        </div>
        <SubjectStatusBadge status={subject.statut} label={subject.statut} />
      </div>

      {/* Progress */}
      <div className="mb-6">
        <p className="text-[10px] font-mono text-fame-text-muted uppercase tracking-widest mb-1">{t('progress')} — {subject.tasks_done}/{subject.tasks_total}</p>
        <SegmentedBar total={subject.tasks_total} done={subject.tasks_done} height={5} />
      </div>

      {/* Sections */}
      {(['context','method','results'] as const).map(section => (
        <div key={section} className="mb-6">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-fame-text-muted mb-2">{t(section)}</h3>
          <Field field={section} multiline />
        </div>
      ))}

      {/* Keywords */}
      <div className="mb-4">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-fame-text-muted mb-2">Keywords</h3>
        <div className="flex flex-wrap gap-1">
          {subject.keywords.map((kw, i) => (
            <span key={i} className="text-xs font-mono px-2 py-0.5 bg-fame-ecru rounded text-fame-blue">{kw}</span>
          ))}
        </div>
      </div>

      {/* Saved indicator */}
      {saved && (
        <p className="text-xs font-mono text-fame-teal mt-4">{t('saved')} ✓</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/paper/CommentsPanel.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { Comment, Member } from '@/types'

type Props = { subjectId: string; member: Member | null }

export function CommentsPanel({ subjectId, member }: Props) {
  const t = useTranslations('comments')
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [posting, setPosting] = useState(false)

  async function load() {
    const res = await fetch(`/api/comments?subject_id=${subjectId}`)
    if (res.ok) setComments(await res.json())
  }

  useEffect(() => { load() }, [subjectId])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setPosting(true)
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sujet_id: subjectId, texte: text,
        visitor_prenom: firstName, visitor_nom: lastName }),
    })
    setText(''); setPosting(false)
    load()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
        {comments.map(c => (
          <div key={c.id} className="bg-white rounded p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold text-fame-blue">{c.auteur_nom}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-fame-text-muted">{new Date(c.created_at).toLocaleDateString()}</span>
                {member && (
                  <button onClick={() => handleDelete(c.id)} className="text-[10px] text-fame-red hover:underline">{t('delete')}</button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-700">{c.texte}</p>
          </div>
        ))}
        {comments.length === 0 && <p className="text-xs text-fame-text-muted text-center mt-8">No comments yet.</p>}
      </div>

      <form onSubmit={post} className="border-t border-fame-ecru p-4 flex flex-col gap-2">
        {!member && (
          <div className="flex gap-2">
            <input placeholder={t('firstName')} value={firstName} onChange={e => setFirstName(e.target.value)} required className="flex-1 border border-fame-ecru rounded px-2 py-1 text-xs" />
            <input placeholder={t('lastName')} value={lastName} onChange={e => setLastName(e.target.value)} required className="flex-1 border border-fame-ecru rounded px-2 py-1 text-xs" />
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            placeholder={useTranslations('paper')('addComment')}
            value={text}
            onChange={e => setText(e.target.value)}
            className="flex-1 border border-fame-ecru rounded px-2 py-1 text-xs resize-none"
            rows={2}
          />
          <button type="submit" disabled={posting} className="px-3 py-1 bg-fame-blue text-white text-xs rounded font-mono self-end disabled:opacity-50">
            {t('post')}
          </button>
        </div>
      </form>
    </div>
  )
}
```

Add `GET` to `src/app/api/comments/route.ts` — add before the `POST` function:

```typescript
export async function GET(req: NextRequest) {
  const subject_id = req.nextUrl.searchParams.get('subject_id')
  if (!subject_id) return NextResponse.json({ error: 'subject_id required' }, { status: 400 })
  const service = createServiceClient()
  const { data, error } = await service
    .from('comments').select('*').eq('sujet_id', subject_id).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Write `src/components/paper/TasksPanel.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SegmentedBar } from '@/components/ui/SegmentedBar'
import { TaskStatusBadge } from '@/components/ui/StatusBadge'
import type { TaskWithRelations } from '@/types'

const STATUS_LABELS = { 'to-do': 'To do', 'in-progress': 'In progress', done: 'Done' }

type Props = { subjectId: string }

export function TasksPanel({ subjectId }: Props) {
  const t = useTranslations('tasks')
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])

  useEffect(() => {
    fetch(`/api/tasks?subject_id=${subjectId}`).then(r => r.json()).then(setTasks)
  }, [subjectId])

  return (
    <div className="p-4 flex flex-col gap-3 overflow-y-auto">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-fame-text-muted">{useTranslations('paper')('linkedTasks')}</h3>
      {tasks.map(task => (
        <div key={task.id} className="bg-white rounded p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-fame-blue-dark">{task.titre}</span>
            <TaskStatusBadge status={task.statut} label={STATUS_LABELS[task.statut]} />
          </div>
          <SegmentedBar
            total={task.subtasks?.length ?? 0}
            done={task.subtasks?.filter(s => s.done).length ?? 0}
            height={3}
          />
        </div>
      ))}
      {tasks.length === 0 && <p className="text-xs text-fame-text-muted">No tasks linked.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/paper/FilesPanel.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { DropboxLink } from '@/types'

type Props = { subjectId: string }

export function FilesPanel({ subjectId }: Props) {
  const t = useTranslations('paper')
  const [links, setLinks] = useState<DropboxLink[]>([])

  useEffect(() => {
    fetch(`/api/dropbox/links?subject_id=${subjectId}`).then(r => r.ok ? r.json() : []).then(setLinks)
  }, [subjectId])

  return (
    <div className="p-4 flex flex-col gap-2">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-fame-text-muted mb-2">{t('filesLinks')}</h3>
      {links.map(l => (
        <a
          key={l.id}
          href={`https://www.dropbox.com/home${l.node_path}`}
          target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-xs text-fame-blue hover:underline font-mono"
        >
          📁 {l.node_name}
        </a>
      ))}
      {links.length === 0 && <p className="text-xs text-fame-text-muted">{t('dropboxSub')}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Write `src/components/paper/PaperNav.tsx`**

```typescript
'use client'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import type { Subject } from '@/types'

type Props = { subjects: Subject[]; currentId: string; lab: string }

export function PaperNav({ subjects, currentId, lab }: Props) {
  const router = useRouter()
  const locale = useLocale()

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-fame-navy/90 backdrop-blur flex items-center gap-3 px-8 overflow-x-auto z-10">
      {subjects.map(s => (
        <button
          key={s.id}
          onClick={() => router.push(`/${locale}/${lab}/paper/${s.id}`)}
          className={`shrink-0 h-12 w-9 rounded-sm border transition-all text-[8px] font-mono text-center leading-tight p-1 ${
            s.id === currentId
              ? 'border-fame-gold bg-fame-gold/20 text-fame-gold'
              : 'border-white/20 bg-white/5 text-white/40 hover:border-white/50 hover:text-white/70'
          }`}
          title={s.titre}
        >
          {s.titre.slice(0, 12)}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Replace `src/app/[locale]/[lab]/paper/[id]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { PaperSheet } from '@/components/paper/PaperSheet'
import { TasksPanel } from '@/components/paper/TasksPanel'
import { FilesPanel } from '@/components/paper/FilesPanel'
import { CommentsPanel } from '@/components/paper/CommentsPanel'
import { PaperNav } from '@/components/paper/PaperNav'
import { EditModeToggle } from '@/components/ui/EditModeToggle'
import type { Lab, SubjectWithProgress } from '@/types'

type Props = { params: Promise<{ locale: string; lab: string; id: string }> }

export default async function PaperPage({ params }: Props) {
  const { lab, id, locale } = await params
  const service = createServiceClient()

  const [{ data: subject }, { data: allSubjects }, session] = await Promise.all([
    service.from('subjects').select('*').eq('id', id).single(),
    service.from('subjects').select('id,titre,ordre').eq('labo', lab).order('ordre'),
    getSession(),
  ])

  if (!subject) notFound()

  const { data: tasks } = await service.from('tasks').select('id,statut').eq('sujet_id', id)
  const tasks_total = tasks?.length ?? 0
  const tasks_done = tasks?.filter((t: { statut: string }) => t.statut === 'done').length ?? 0

  const enriched: SubjectWithProgress = { ...subject, tasks_total, tasks_done, members: [] }
  const isMember = !!session?.member

  return (
    <PaperPageClient
      subject={enriched}
      allSubjects={allSubjects ?? []}
      lab={lab}
      locale={locale}
      isMember={isMember}
      member={session?.member ?? null}
    />
  )
}
```

Add `src/components/paper/PaperPageClient.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { PaperSheet } from './PaperSheet'
import { TasksPanel } from './TasksPanel'
import { FilesPanel } from './FilesPanel'
import { CommentsPanel } from './CommentsPanel'
import { PaperNav } from './PaperNav'
import { EditModeToggle } from '@/components/ui/EditModeToggle'
import type { SubjectWithProgress, Subject, Member } from '@/types'

type Props = {
  subject: SubjectWithProgress
  allSubjects: Pick<Subject, 'id' | 'titre' | 'ordre'>[]
  lab: string
  locale: string
  isMember: boolean
  member: Member | null
}

export function PaperPageClient({ subject: initial, allSubjects, lab, isMember, member }: Props) {
  const [subject, setSubject] = useState(initial)
  const [editMode, setEditMode] = useState(false)
  const [rightTab, setRightTab] = useState<'files' | 'comments'>('files')

  return (
    <div className="flex h-[calc(100vh-48px)] pb-20 overflow-hidden">
      {/* Left: linked tasks */}
      <aside className="w-72 shrink-0 border-r border-fame-ecru overflow-y-auto bg-fame-sand">
        <TasksPanel subjectId={subject.id} />
      </aside>

      {/* Center: A4 paper */}
      <main className="flex-1 overflow-y-auto bg-fame-sand-bg flex flex-col items-center py-8 px-4 gap-4">
        {isMember && (
          <div className="self-end mr-4">
            <EditModeToggle active={editMode} onToggle={() => setEditMode(e => !e)} />
          </div>
        )}
        <PaperSheet
          subject={subject}
          editMode={editMode}
          onUpdate={fields => setSubject(s => ({ ...s, ...fields }))}
        />
      </main>

      {/* Right: files + comments */}
      <aside className="w-72 shrink-0 border-l border-fame-ecru flex flex-col bg-fame-sand">
        <div className="flex border-b border-fame-ecru">
          {(['files', 'comments'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setRightTab(tab)}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest ${rightTab === tab ? 'text-fame-blue border-b-2 border-fame-blue' : 'text-fame-text-muted'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {rightTab === 'files' ? <FilesPanel subjectId={subject.id} /> : <CommentsPanel subjectId={subject.id} member={member} />}
        </div>
      </aside>

      {/* Bottom nav strip */}
      <PaperNav subjects={allSubjects as Subject[]} currentId={subject.id} lab={lab} />
    </div>
  )
}
```

Update `src/app/[locale]/[lab]/paper/[id]/page.tsx` to import and use `PaperPageClient`:

```typescript
// Replace the export default function body to render PaperPageClient:
import { PaperPageClient } from '@/components/paper/PaperPageClient'
// ... (rest of imports above)
// Inside the function, replace the return with:
  return (
    <PaperPageClient
      subject={enriched}
      allSubjects={allSubjects ?? []}
      lab={lab}
      locale={locale}
      isMember={isMember}
      member={session?.member ?? null}
    />
  )
```

- [ ] **Step 7: Build check**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm run build 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
git add src/components/paper/ src/app/[locale]/[lab]/paper/ src/app/api/comments/
git commit -m "feat: paper detail page — inline edit, tasks panel, files, comments, nav strip"
```

---

## Task 12: Tasks Kanban Page

**Files:**
- Create: `src/components/tasks/TaskCard.tsx`
- Create: `src/components/tasks/TaskModal.tsx`
- Create: `src/components/tasks/KanbanColumn.tsx`
- Create: `src/components/tasks/KanbanBoard.tsx`
- Modify: `src/app/[locale]/[lab]/tasks/page.tsx`

- [ ] **Step 1: Write `src/components/tasks/TaskCard.tsx`**

```typescript
'use client'
import { useTranslations } from 'next-intl'
import { SegmentedBar } from '@/components/ui/SegmentedBar'
import { TaskStatusBadge } from '@/components/ui/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import type { TaskWithRelations } from '@/types'

const STATUS_LABELS = { 'to-do': 'To do', 'in-progress': 'In progress', done: 'Done' }
const DIFF_COLORS = { easy: '#1e9b7e', intermediate: '#e8b149', advanced: '#c0473b' }

type Props = {
  task: TaskWithRelations
  isMember: boolean
  onOpen: (task: TaskWithRelations) => void
  onClaim: (taskId: string) => void
}

export function TaskCard({ task, isMember, onOpen, onClaim }: Props) {
  const t = useTranslations('tasks')
  const subtotalDone = task.subtasks?.filter(s => s.done).length ?? 0
  const subtotalAll = task.subtasks?.length ?? 0

  return (
    <div
      onClick={() => onOpen(task)}
      className="bg-white rounded shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow border border-transparent hover:border-fame-ecru"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <TaskStatusBadge status={task.statut} label={STATUS_LABELS[task.statut]} />
        <span
          className="w-2 h-2 rounded-full mt-1 shrink-0"
          style={{ background: DIFF_COLORS[task.difficulte] }}
          title={task.difficulte}
        />
      </div>
      <p className="text-xs font-semibold text-fame-blue-dark mb-2 leading-tight">{task.titre}</p>
      <SegmentedBar total={subtotalAll} done={subtotalDone} height={3} />
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          {task.assignees?.map(a => (
            <Avatar key={a.id} name={`${a.prenom} ${a.nom}`} photoUrl={a.photo_url} size={20} />
          ))}
        </div>
        {isMember && task.assignees?.length === 0 && (
          <button
            onClick={e => { e.stopPropagation(); onClaim(task.id) }}
            className="text-[10px] font-mono text-fame-blue hover:underline"
          >
            {t('claimTask')}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/tasks/TaskModal.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/ui/Modal'
import { SegmentedBar } from '@/components/ui/SegmentedBar'
import { TaskStatusBadge } from '@/components/ui/StatusBadge'
import { Avatar } from '@/components/ui/Avatar'
import type { TaskWithRelations, TaskStatus, Difficulty } from '@/types'

const STATUS_OPTS: TaskStatus[] = ['to-do', 'in-progress', 'done']
const DIFF_OPTS: Difficulty[] = ['easy', 'intermediate', 'advanced']
const STATUS_LABELS: Record<TaskStatus, string> = { 'to-do': 'To do', 'in-progress': 'In progress', done: 'Done' }

type Props = {
  task: TaskWithRelations | null
  isMember: boolean
  isAdmin: boolean
  onClose: () => void
  onUpdated: () => void
}

export function TaskModal({ task, isMember, isAdmin, onClose, onUpdated }: Props) {
  const t = useTranslations('tasks')

  async function patchTask(fields: Partial<TaskWithRelations>) {
    if (!task) return
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    onUpdated()
  }

  async function toggleSubtask(subtaskId: string, done: boolean) {
    if (!task) return
    await fetch(`/api/tasks/${task.id}/subtasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtask_id: subtaskId, done }),
    })
    onUpdated()
  }

  async function claimToggle() {
    if (!task) return
    await fetch(`/api/tasks/${task.id}/claim`, { method: 'POST' })
    onUpdated()
  }

  if (!task) return null

  const subtotalDone = task.subtasks?.filter(s => s.done).length ?? 0

  return (
    <Modal open={!!task} onClose={onClose} title={task.titre}>
      <div className="flex flex-col gap-4">
        {/* Status selector */}
        {isMember ? (
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTS.map(s => (
              <button
                key={s}
                onClick={() => patchTask({ statut: s })}
                className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${task.statut === s ? 'bg-fame-blue text-white border-fame-blue' : 'border-fame-ecru text-fame-text-muted hover:border-fame-blue'}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        ) : (
          <TaskStatusBadge status={task.statut} label={STATUS_LABELS[task.statut]} />
        )}

        {/* Difficulty */}
        {isMember && (
          <div className="flex gap-2">
            {DIFF_OPTS.map(d => (
              <button key={d} onClick={() => patchTask({ difficulte: d })}
                className={`px-2 py-0.5 text-xs font-mono rounded border ${task.difficulte === d ? 'bg-fame-gold/20 border-fame-gold text-fame-blue-dark' : 'border-fame-ecru text-fame-text-muted'}`}>
                {t(`difficulty.${d}`)}
              </button>
            ))}
          </div>
        )}

        {/* Subtasks */}
        {(task.subtasks?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-mono text-fame-text-muted uppercase tracking-widest mb-2">{t('subtasks')}</p>
            <SegmentedBar total={task.subtasks!.length} done={subtotalDone} height={4} />
            <div className="mt-2 flex flex-col gap-1">
              {task.subtasks!.map(s => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox" checked={s.done} disabled={!isMember}
                    onChange={e => toggleSubtask(s.id, e.target.checked)}
                    className="accent-fame-teal"
                  />
                  <span className={`text-sm ${s.done ? 'line-through text-fame-text-muted' : 'text-fame-blue-dark'}`}>{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Assignees */}
        <div>
          <p className="text-xs font-mono text-fame-text-muted uppercase tracking-widest mb-2">{t('assignees')}</p>
          <div className="flex gap-2 flex-wrap">
            {task.assignees?.map(a => (
              <div key={a.id} className="flex items-center gap-1">
                <Avatar name={`${a.prenom} ${a.nom}`} photoUrl={a.photo_url} size={24} />
                <span className="text-xs text-fame-blue-dark">{a.prenom}</span>
              </div>
            ))}
          </div>
          {isMember && (
            <button onClick={claimToggle} className="mt-2 text-xs font-mono text-fame-blue hover:underline">
              {t('claimTask')} / {t('unclaimTask')}
            </button>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-gray-600">{task.description}</p>
        )}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 3: Write `src/components/tasks/KanbanColumn.tsx`**

```typescript
'use client'
import type { Subject, TaskWithRelations } from '@/types'
import { TaskCard } from './TaskCard'

type Props = {
  subject: Subject
  tasks: TaskWithRelations[]
  isMember: boolean
  onOpenTask: (t: TaskWithRelations) => void
  onClaim: (taskId: string) => void
}

export function KanbanColumn({ subject, tasks, isMember, onOpenTask, onClaim }: Props) {
  return (
    <div className="shrink-0 w-64 flex flex-col h-full">
      <div className="bg-fame-blue px-4 py-2 rounded-t">
        <h3 className="font-serif text-sm font-bold text-white truncate">{subject.titre}</h3>
        <span className="text-[10px] font-mono text-fame-text-muted">{tasks.length} tasks</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-fame-ecru/40 rounded-b p-2 flex flex-col gap-2">
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} isMember={isMember} onOpen={onOpenTask} onClaim={onClaim} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/tasks/KanbanBoard.tsx`**

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
import { KanbanColumn } from './KanbanColumn'
import { TaskModal } from './TaskModal'
import type { Subject, TaskWithRelations, Lab } from '@/types'

type Props = { lab: Lab; isMember: boolean; isAdmin: boolean }

export function KanbanBoard({ lab, isMember, isAdmin }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [subs, tsks] = await Promise.all([
      fetch(`/api/subjects?lab=${lab}`).then(r => r.json()),
      fetch(`/api/tasks?lab=${lab}`).then(r => r.json()),
    ])
    setSubjects(subs ?? [])
    setTasks(tsks ?? [])
    setLoading(false)
  }, [lab])

  useEffect(() => { load() }, [load])

  async function handleClaim(taskId: string) {
    await fetch(`/api/tasks/${taskId}/claim`, { method: 'POST' })
    load()
  }

  const activeSubjects = subjects.filter(s => s.statut === 'active')

  if (loading) return <div className="p-12 text-center font-mono text-sm text-fame-text-muted">Loading…</div>

  return (
    <>
      <div className="flex gap-4 h-[calc(100vh-48px)] overflow-x-auto p-6">
        {activeSubjects.map(subject => (
          <KanbanColumn
            key={subject.id}
            subject={subject}
            tasks={tasks.filter(t => t.sujet_id === subject.id)}
            isMember={isMember}
            onOpenTask={t => setSelectedTask(t)}
            onClaim={handleClaim}
          />
        ))}
        {activeSubjects.length === 0 && (
          <p className="text-fame-text-muted font-mono text-sm self-center mx-auto">No active subjects. Add subjects in the lab page first.</p>
        )}
      </div>
      <TaskModal
        task={selectedTask}
        isMember={isMember}
        isAdmin={isAdmin}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => { load(); setSelectedTask(null) }}
      />
    </>
  )
}
```

- [ ] **Step 5: Replace `src/app/[locale]/[lab]/tasks/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import type { Lab } from '@/types'

const LABS: Lab[] = ['paris', 'montreal']
type Props = { params: Promise<{ locale: string; lab: string }> }

export default async function TasksPage({ params }: Props) {
  const { lab } = await params
  if (!LABS.includes(lab as Lab)) notFound()
  const session = await getSession()
  return (
    <KanbanBoard
      lab={lab as Lab}
      isMember={!!session?.member}
      isAdmin={session?.member?.is_admin ?? false}
    />
  )
}
```

- [ ] **Step 6: Build check + commit**

```bash
cd "/home/lucad/Documents/Projets Programmation/FAME Website" && npm run build 2>&1 | tail -10
git add src/components/tasks/ src/app/[locale]/[lab]/tasks/
git commit -m "feat: tasks kanban — columns per subject, task cards, task modal, claim/unclaim"
```

---

*Continue in Part 3 → `2026-06-22-fame-website-p3-secondary.md`*
