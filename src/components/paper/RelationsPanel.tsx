'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import { toLocale2 } from '@/lib/subjects/localized'
import { INHERITABLE_FIELDS } from '@/types'
import type { Subject, SubjectRelation, Lab, InheritableField, Locale2 } from '@/types'

type Props = {
  subjectId: string
  relations: SubjectRelation[]
  relatedById: Map<string, Subject>
  subjectInherits: Subject['inherits']
  isMember: boolean
  open: boolean
  onToggleOpen: () => void
  locale: string
  lab: Lab
  allSubjects: Pick<Subject, 'id' | 'titre' | 'i18n'>[]
  onChanged: () => void
}

type LinkKindChoice = 'motherOf' | 'derivesFrom' | 'assoc'

export function RelationsPanel({
  subjectId, relations, relatedById, subjectInherits,
  isMember, open, onToggleOpen, locale, lab, allSubjects, onChanged,
}: Props) {
  const t = useTranslations('paper.relations')
  const { addToast } = useToast()
  const loc = toLocale2(locale)

  const [showAddForm, setShowAddForm] = useState(false)
  const [addTarget, setAddTarget] = useState('')
  const [addKind, setAddKind] = useState<LinkKindChoice>('assoc')
  const [addLabel, setAddLabel] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Derive 3 groups ──────────────────────────────────────────────────────
  // SÉCURITÉ : ne montrer que les relations dont l'AUTRE extrémité est présente
  // dans `relatedById`. Pour un visiteur, les fiches confidentielles en sont
  // absentes → on ne révèle ni leur existence, ni leur UUID, ni un lien (mirroir
  // de `buildGraphData` côté graphe).
  const mothers = relations.filter(r => r.kind === 'parent' && r.target_id === subjectId && relatedById.has(r.source_id))
  const daughters = relations.filter(r => r.kind === 'parent' && r.source_id === subjectId && relatedById.has(r.target_id))
  const associations = relations.filter(
    r => r.kind === 'assoc'
      && (r.source_id === subjectId || r.target_id === subjectId)
      && relatedById.has(r.source_id === subjectId ? r.target_id : r.source_id)
  )

  const linkedIds = new Set([
    ...mothers.map(r => r.source_id),
    ...daughters.map(r => r.target_id),
    ...associations.map(r => (r.source_id === subjectId ? r.target_id : r.source_id)),
  ])

  const motherOptions = mothers.map(r => ({
    id: r.source_id,
    title: getSubjectTitle(r.source_id, loc),
  }))

  function getSubjectTitle(id: string, l: Locale2): string {
    const s = relatedById.get(id)
    if (!s) return id
    return s.i18n?.[l]?.titre ?? s.titre
  }

  function fieldsInheritedFrom(motherId: string): InheritableField[] {
    if (!subjectInherits) return []
    return INHERITABLE_FIELDS.filter(f => subjectInherits[f] === motherId) as unknown as InheritableField[]
  }

  function assocLabel(r: SubjectRelation): string {
    return r.label_i18n?.[loc]?.label ?? r.label ?? ''
  }

  const candidateSubjects = allSubjects.filter(
    s => s.id !== subjectId && !linkedIds.has(s.id)
  )

  // ── API actions ──────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!addTarget) return
    setSaving(true)
    let body: Record<string, unknown>
    if (addKind === 'motherOf') {
      body = { kind: 'parent', otherId: addTarget, direction: 'child' }
    } else if (addKind === 'derivesFrom') {
      body = { kind: 'parent', otherId: addTarget, direction: 'mother' }
    } else {
      body = { kind: 'assoc', otherId: addTarget, label: addLabel, locale }
    }
    try {
      const res = await fetch(`/api/subjects/${subjectId}/relations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowAddForm(false)
        setAddTarget('')
        setAddKind('assoc')
        setAddLabel('')
        onChanged()
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        const msg = data.error === 'cycle' ? t('errCycle')
          : data.error === 'duplicate' ? t('errDuplicate')
          : t('errGeneric')
        addToast(msg, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(relId: string) {
    const res = await fetch(`/api/subjects/${subjectId}/relations/${relId}`, { method: 'DELETE' })
    if (res.ok) onChanged()
  }

  async function handleInheritChange(field: InheritableField, motherId: string) {
    const newInherits: Partial<Record<InheritableField, string>> = { ...(subjectInherits ?? {}) }
    if (!motherId) {
      delete newInherits[field]
    } else {
      newInherits[field] = motherId
    }
    const res = await fetch(`/api/subjects/${subjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inherits: newInherits }),
    })
    if (res.ok) onChanged()
  }

  const total = mothers.length + daughters.length + associations.length

  return (
    <section style={{
      width: '100%', pointerEvents: 'auto', flexShrink: 0,
      background: '#2f4486', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(150,180,255,0.18)', borderRadius: 14,
      boxShadow: '0 22px 60px -18px rgba(0,5,30,0.75)', overflow: 'hidden',
    }}>
      <button
        onClick={onToggleOpen}
        className="text-fame-text-light"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#e8b149' }} />
          {t('title')}
        </span>
        <span className="font-mono text-fame-text-muted" style={{ fontSize: 11 }}>
          {total} {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="fame-scroll" style={{ maxHeight: 'min(52vh, 460px)', overflowY: 'auto', padding: '2px 12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* MOTHERS */}
          <RelGroup label={t('mothers')} count={mothers.length}>
            {mothers.length === 0 ? (
              <NoneLabel text={t('none')} />
            ) : mothers.map(r => {
              const fields = fieldsInheritedFrom(r.source_id)
              return (
                <RelEntry key={r.id}
                  href={`/${locale}/${lab}/paper/${r.source_id}`}
                  title={getSubjectTitle(r.source_id, loc)}
                  subLabel={fields.length > 0 ? t('inheritsFields', { fields: fields.join(', ') }) : undefined}
                  isMember={isMember}
                  onRemove={() => handleRemove(r.id)}
                  removeLabel={t('remove')}
                />
              )
            })}
          </RelGroup>

          {/* DAUGHTERS */}
          <RelGroup label={t('daughters')} count={daughters.length}>
            {daughters.length === 0 ? (
              <NoneLabel text={t('none')} />
            ) : daughters.map(r => (
              <RelEntry key={r.id}
                href={`/${locale}/${lab}/paper/${r.target_id}`}
                title={getSubjectTitle(r.target_id, loc)}
                isMember={isMember}
                onRemove={() => handleRemove(r.id)}
                removeLabel={t('remove')}
              />
            ))}
          </RelGroup>

          {/* ASSOCIATIONS */}
          <RelGroup label={t('associations')} count={associations.length}>
            {associations.length === 0 ? (
              <NoneLabel text={t('none')} />
            ) : associations.map(r => {
              const otherId = r.source_id === subjectId ? r.target_id : r.source_id
              const lbl = assocLabel(r)
              return (
                <RelEntry key={r.id}
                  href={`/${locale}/${lab}/paper/${otherId}`}
                  title={getSubjectTitle(otherId, loc)}
                  subLabel={lbl || undefined}
                  isMember={isMember}
                  onRemove={() => handleRemove(r.id)}
                  removeLabel={t('remove')}
                />
              )
            })}
          </RelGroup>

          {/* INHERITANCE CONTROLS — member only, shown when at least 1 mother */}
          {isMember && motherOptions.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(150,180,255,0.15)', paddingTop: 10 }}>
              {INHERITABLE_FIELDS.map(field => {
                const currentVal = subjectInherits?.[field] ?? ''
                return (
                  <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                    <span className="font-mono" style={{ fontSize: 10, color: '#dfe7fb', flexShrink: 0 }}>{field}</span>
                    <select
                      value={currentVal}
                      onChange={e => handleInheritChange(field, e.target.value)}
                      style={{
                        fontSize: 10, background: 'rgba(31,46,92,0.7)',
                        border: '1px solid rgba(150,180,255,0.22)',
                        borderRadius: 5, color: '#eef3ff', padding: '2px 5px', maxWidth: 152,
                      }}
                    >
                      <option value="">{t('ownValue')}</option>
                      {motherOptions.map(m => (
                        <option key={m.id} value={m.id}>{t('inheritFrom', { title: m.title })}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}

          {/* ADD LINK — member only */}
          {isMember && (
            <div style={{ borderTop: '1px solid rgba(150,180,255,0.15)', paddingTop: 10 }}>
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="font-mono"
                  style={{
                    fontSize: 11, background: 'none', border: 'none', cursor: 'pointer',
                    color: '#7e95d6', padding: 0, textDecoration: 'underline dotted',
                  }}
                >
                  + {t('addLink')}
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <select
                    value={addTarget}
                    onChange={e => setAddTarget(e.target.value)}
                    style={{
                      fontSize: 11, background: 'rgba(31,46,92,0.8)',
                      border: '1px solid rgba(150,180,255,0.28)',
                      borderRadius: 7, color: '#eef3ff', padding: '5px 8px',
                    }}
                  >
                    <option value="">{t('pickSubject')}</option>
                    {candidateSubjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.i18n?.[loc]?.titre ?? s.titre}
                      </option>
                    ))}
                  </select>

                  <select
                    value={addKind}
                    onChange={e => setAddKind(e.target.value as LinkKindChoice)}
                    style={{
                      fontSize: 11, background: 'rgba(31,46,92,0.8)',
                      border: '1px solid rgba(150,180,255,0.28)',
                      borderRadius: 7, color: '#eef3ff', padding: '5px 8px',
                    }}
                  >
                    <option value="motherOf">{t('linkKind.motherOf')}</option>
                    <option value="derivesFrom">{t('linkKind.derivesFrom')}</option>
                    <option value="assoc">{t('linkKind.assoc')}</option>
                  </select>

                  {addKind === 'assoc' && (
                    <input
                      type="text"
                      value={addLabel}
                      onChange={e => setAddLabel(e.target.value)}
                      placeholder={t('labelOptional')}
                      style={{
                        fontSize: 11, background: 'rgba(31,46,92,0.8)',
                        border: '1px solid rgba(150,180,255,0.28)',
                        borderRadius: 7, color: '#eef3ff', padding: '5px 8px', outline: 'none',
                      }}
                    />
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleAdd}
                      disabled={!addTarget || saving}
                      style={{
                        fontSize: 11, padding: '5px 12px', borderRadius: 7,
                        background: '#5b7cf0', border: 'none', color: '#fff', cursor: 'pointer',
                        opacity: !addTarget || saving ? 0.5 : 1,
                      }}
                    >
                      {t('save')}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddForm(false)
                        setAddTarget('')
                        setAddKind('assoc')
                        setAddLabel('')
                      }}
                      style={{
                        fontSize: 11, padding: '5px 12px', borderRadius: 7, background: 'none',
                        border: '1px solid rgba(150,180,255,0.28)', color: '#9fb2e6', cursor: 'pointer',
                      }}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Private sub-components ──────────────────────────────────────────────────

function RelGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono" style={{
        fontSize: 9, color: '#7e95d6', textTransform: 'uppercase',
        letterSpacing: '0.12em', marginBottom: 6,
      }}>
        {label} ({count})
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {children}
      </div>
    </div>
  )
}

function RelEntry({
  href, title, subLabel, isMember, onRemove, removeLabel,
}: {
  href: string
  title: string
  subLabel?: string
  isMember: boolean
  onRemove: () => void
  removeLabel: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
      padding: '7px 10px', borderRadius: 9,
      border: '1px solid rgba(150,180,255,0.14)',
      background: 'rgba(31,46,92,0.5)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={href} style={{ fontSize: 12, color: '#dfe7fb', textDecoration: 'none', lineHeight: 1.35, display: 'block' }}>
          {title}
        </Link>
        {subLabel && (
          <span className="font-mono" style={{ fontSize: 9, color: '#9fb2e6', display: 'block', marginTop: 2 }}>
            {subLabel}
          </span>
        )}
      </div>
      {isMember && (
        <button
          onClick={onRemove}
          title={removeLabel}
          style={{
            fontSize: 15, lineHeight: 1, background: 'none', border: 'none',
            cursor: 'pointer', color: 'rgba(255,100,100,0.65)',
            padding: '0 2px', flexShrink: 0, marginTop: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

function NoneLabel({ text }: { text: string }) {
  return (
    <p className="font-mono" style={{ fontSize: 10, color: 'rgba(159,178,230,0.5)', padding: '2px 0' }}>
      {text}
    </p>
  )
}
