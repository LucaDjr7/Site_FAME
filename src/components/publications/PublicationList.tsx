'use client'
import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { Lab, Publication, PublicationType } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AddPublicationModal } from './AddPublicationModal'

// ─── Type badge config ───────────────────────────────────────────────────────

type BadgeCfg = { color: string; bg: string; border: string }

const TYPE_BADGE: Record<PublicationType, BadgeCfg> = {
  article:       { color: '#1e9b7e', bg: 'rgba(30,155,126,0.08)',   border: 'rgba(30,155,126,0.3)' },
  preprint:      { color: '#5768ac', bg: 'rgba(87,104,172,0.08)',   border: 'rgba(87,104,172,0.3)' },
  conference:    { color: '#e8b149', bg: 'rgba(232,177,73,0.1)',    border: 'rgba(232,177,73,0.35)' },
  'working-paper': { color: '#ec6553', bg: 'rgba(236,101,83,0.08)', border: 'rgba(236,101,83,0.3)' },
}

// i18n key: 'working-paper' → 'types.working', others → 'types.<type>'
function typeI18nKey(tp: PublicationType): string {
  return tp === 'working-paper' ? 'types.working' : `types.${tp}`
}

// Derive initials from a name string
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Filter logic ────────────────────────────────────────────────────────────

function matchesSearch(p: Publication, q: string): boolean {
  if (!q.trim()) return true
  const haystack = [p.titre, p.revue_ou_conf ?? '', ...p.auteurs].join(' ').toLowerCase()
  return haystack.includes(q.toLowerCase())
}

function matchesExcept(
  p: Publication,
  q: string,
  fType: Set<PublicationType>,
  fAuthor: Set<string>,
  fYear: Set<number>,
  exceptDim: 'type' | 'author' | 'year' | null,
): boolean {
  if (!matchesSearch(p, q)) return false
  if (exceptDim !== 'type' && fType.size > 0 && !fType.has(p.type)) return false
  if (exceptDim !== 'author' && fAuthor.size > 0 && !p.auteurs.some(a => fAuthor.has(a))) return false
  if (exceptDim !== 'year' && fYear.size > 0 && !fYear.has(p.annee)) return false
  return true
}

function matchesAll(
  p: Publication,
  q: string,
  fType: Set<PublicationType>,
  fAuthor: Set<string>,
  fYear: Set<number>,
): boolean {
  return matchesExcept(p, q, fType, fAuthor, fYear, null)
}

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  lab: Lab
  isMember: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PublicationList({ lab, isMember }: Props) {
  const t = useTranslations('publications')
  const { addToast } = useToast()

  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fType, setFType] = useState<Set<PublicationType>>(new Set())
  const [fAuthor, setFAuthor] = useState<Set<string>>(new Set())
  const [fYear, setFYear] = useState<Set<number>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await fetch(`/api/publications?lab=${lab}`)
        const data: Publication[] = await r.json()
        if (!cancelled) setPublications(data)
      } catch {
        // silently ignore fetch errors
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [lab])

  // ── Visible list ─────────────────────────────────────────────────────────
  const visible = useMemo(
    () => publications.filter(p => matchesAll(p, q, fType, fAuthor, fYear)),
    [publications, q, fType, fAuthor, fYear],
  )

  // Grouped by year (descending)
  const grouped = useMemo(() => {
    const years = [...new Set(visible.map(p => p.annee))].sort((a, b) => b - a)
    return years.map(yr => ({
      year: yr,
      items: visible.filter(p => p.annee === yr),
    }))
  }, [visible])

  // ── Sidebar data ─────────────────────────────────────────────────────────
  const allTypes = useMemo(
    () => [...new Set(publications.map(p => p.type))] as PublicationType[],
    [publications],
  )
  const allAuthors = useMemo(
    () => [...new Set(publications.flatMap(p => p.auteurs))].sort(),
    [publications],
  )
  const allYears = useMemo(
    () => [...new Set(publications.map(p => p.annee))].sort((a, b) => b - a),
    [publications],
  )

  // Cross-filtered counts
  function countForType(tp: PublicationType) {
    return publications.filter(p => matchesExcept(p, q, fType, fAuthor, fYear, 'type') && p.type === tp).length
  }
  function countForAuthor(author: string) {
    return publications.filter(p => matchesExcept(p, q, fType, fAuthor, fYear, 'author') && p.auteurs.includes(author)).length
  }
  function countForYear(yr: number) {
    return publications.filter(p => matchesExcept(p, q, fType, fAuthor, fYear, 'year') && p.annee === yr).length
  }

  // Distinct authors in visible set
  const visibleAuthorCount = useMemo(
    () => new Set(visible.flatMap(p => p.auteurs)).size,
    [visible],
  )

  // ── Toggles ──────────────────────────────────────────────────────────────
  function toggleType(tp: PublicationType) {
    setFType(prev => {
      const n = new Set(prev)
      if (n.has(tp)) { n.delete(tp) } else { n.add(tp) }
      return n
    })
  }
  function toggleAuthor(a: string) {
    setFAuthor(prev => {
      const n = new Set(prev)
      if (n.has(a)) { n.delete(a) } else { n.add(a) }
      return n
    })
  }
  function toggleYear(yr: number) {
    setFYear(prev => {
      const n = new Set(prev)
      if (n.has(yr)) { n.delete(yr) } else { n.add(yr) }
      return n
    })
  }
  function resetFilters() {
    setFType(new Set())
    setFAuthor(new Set())
    setFYear(new Set())
    setQ('')
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  function handleCreated(pub: unknown) {
    setPublications(prev => [pub as Publication, ...prev].sort((a, b) => b.annee - a.annee))
    setAddOpen(false)
    addToast(t('created'), 'success')
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    const res = await fetch(`/api/publications/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPublications(prev => prev.filter(p => p.id !== id))
      addToast(t('deleted'), 'info')
    } else {
      addToast(t('errorGeneric'), 'error')
    }
  }

  // ── Lab label ────────────────────────────────────────────────────────────
  const labLabel = lab === 'paris' ? 'Paris' : 'Montréal'

  // ── Styles ───────────────────────────────────────────────────────────────
  const PAGE_BG =
    'radial-gradient(110% 80% at 26% 8%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%), ' +
    'radial-gradient(120% 110% at 78% 112%, rgba(113,120,132,0.2) 0%, rgba(113,120,132,0) 60%), ' +
    'radial-gradient(140% 120% at 92% 44%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%), ' +
    '#F9F9FA'

  return (
    <>
      <div
        style={{
          minHeight: 'calc(100vh - 3rem)',
          display: 'flex',
          flexDirection: 'column',
          background: PAGE_BG,
          fontFamily: 'Roboto Slab, Georgia, serif',
          color: '#18244c',
        }}
      >
        {/* ── Secondary toolbar ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px 14px',
            flexShrink: 0,
            borderBottom: '1px solid rgba(20,40,90,0.1)',
          }}
        >
          {/* Left: kicker + title */}
          <div>
            <div
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#7e95d6',
                marginBottom: 3,
              }}
            >
              FAME / {labLabel}
            </div>
            <h1
              style={{
                fontFamily: 'Roboto Slab, Georgia, serif',
                fontSize: 20,
                fontWeight: 600,
                color: '#15203f',
                margin: 0,
              }}
            >
              {t('title')}
            </h1>
          </div>

          {/* Right: search + controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={t('search')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid rgba(20,40,90,0.15)',
                background: 'rgba(255,255,255,0.7)',
                color: '#15203f',
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 11,
                width: 200,
                outline: 'none',
              }}
            />
            {isMember && (
              <button
                onClick={() => setEditMode(v => !v)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: editMode ? '1.5px solid #e8b149' : '1px solid rgba(20,40,90,0.15)',
                  background: editMode ? 'rgba(232,177,73,0.12)' : 'rgba(255,255,255,0.6)',
                  color: editMode ? '#b88c30' : '#6b7596',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 10,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  transition: 'all 0.14s',
                }}
              >
                {editMode ? t('editModeOn') : t('editMode')}
              </button>
            )}
            {isMember && editMode && (
              <button
                onClick={() => setAddOpen(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#2f4486',
                  color: '#eef3ff',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 10,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                + {t('addPublication')}
              </button>
            )}
          </div>
        </div>

        {/* ── Main content row ──────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* ── Publication list (scroll) ────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 40px' }}>
            {loading ? (
              <div style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
                color: '#7e95d6',
                textAlign: 'center',
                paddingTop: 60,
              }}>
                {t('loading')}
              </div>
            ) : visible.length === 0 ? (
              <div style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 13,
                color: '#7e95d6',
                textAlign: 'center',
                paddingTop: 60,
              }}>
                {t('noResults')}
              </div>
            ) : (
              <div style={{ maxWidth: 780, margin: '0 auto' }}>
                {grouped.map(({ year, items }) => (
                  <div key={year} style={{ marginBottom: 36 }}>
                    {/* Year group header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 14,
                    }}>
                      <span style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#2f4486',
                        letterSpacing: '0.14em',
                        flexShrink: 0,
                      }}>
                        {year}
                      </span>
                      <div style={{
                        flex: 1,
                        height: 1,
                        background: 'rgba(20,40,90,0.12)',
                      }} />
                      <span style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: 10,
                        color: '#6b7596',
                        flexShrink: 0,
                      }}>
                        {items.length} {t('countSuffix')}
                      </span>
                    </div>

                    {/* Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {items.map(p => {
                        const badge = TYPE_BADGE[p.type]
                        return (
                          <article
                            key={p.id}
                            style={{
                              position: 'relative',
                              background: '#fbf9f3',
                              borderRadius: 9,
                              boxShadow: '0 14px 34px -20px rgba(0,5,30,0.4), inset 0 0 0 1px rgba(0,0,0,0.05)',
                              padding: '20px 22px',
                            }}
                          >
                            {/* Edit mode: delete button */}
                            {editMode && (
                              <button
                                onClick={() => setPendingDeleteId(p.id)}
                                aria-label={t('deleteLabel')}
                                style={{
                                  position: 'absolute',
                                  top: -8,
                                  right: -8,
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  border: '1.5px solid rgba(220,68,55,0.5)',
                                  background: '#fff',
                                  color: '#c0473b',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 14,
                                  lineHeight: 1,
                                  fontFamily: 'system-ui, sans-serif',
                                  transition: 'background 0.12s, color 0.12s',
                                  zIndex: 2,
                                }}
                                onMouseEnter={e => {
                                  const btn = e.currentTarget as HTMLButtonElement
                                  btn.style.background = '#c0473b'
                                  btn.style.color = '#fff'
                                }}
                                onMouseLeave={e => {
                                  const btn = e.currentTarget as HTMLButtonElement
                                  btn.style.background = '#fff'
                                  btn.style.color = '#c0473b'
                                }}
                              >
                                ×
                              </button>
                            )}

                            {/* Meta row: type badge + venue */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              marginBottom: 8,
                              flexWrap: 'wrap',
                            }}>
                              {/* Type badge */}
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '2px 8px',
                                borderRadius: 20,
                                border: `1px solid ${badge.border}`,
                                background: badge.bg,
                                fontFamily: 'IBM Plex Mono, monospace',
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                color: badge.color,
                              }}>
                                <span style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: badge.color,
                                  flexShrink: 0,
                                }} />
                                {t(typeI18nKey(p.type) as Parameters<typeof t>[0])}
                              </span>

                              {/* Venue */}
                              {p.revue_ou_conf && (
                                <span style={{
                                  fontFamily: 'IBM Plex Mono, monospace',
                                  fontSize: 10,
                                  color: '#6b7596',
                                }}>
                                  {p.revue_ou_conf}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h3 style={{
                              margin: '0 0 8px',
                              fontSize: 17,
                              fontWeight: 600,
                              fontFamily: 'Roboto Slab, Georgia, serif',
                              color: '#15203f',
                              lineHeight: 1.35,
                            }}>
                              {p.titre}
                            </h3>

                            {/* Authors */}
                            {p.auteurs.length > 0 && (
                              <div style={{
                                fontFamily: 'IBM Plex Mono, monospace',
                                fontSize: 11,
                                color: '#43507a',
                                marginBottom: p.lien ? 10 : 0,
                              }}>
                                {p.auteurs.map((a, i) => (
                                  <span key={i}>
                                    <span style={{ fontWeight: 600 }}>{a}</span>
                                    {i < p.auteurs.length - 1 && (
                                      <span style={{ color: '#9fb2e6', marginRight: 2 }}>{', '}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Link chip */}
                            {p.lien && (
                              <a
                                href={p.lien}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginTop: 10,
                                  padding: '3px 9px',
                                  borderRadius: 5,
                                  border: '1px solid rgba(47,68,134,0.28)',
                                  fontFamily: 'IBM Plex Mono, monospace',
                                  fontSize: 10,
                                  color: '#2f4486',
                                  textDecoration: 'none',
                                  background: 'rgba(47,68,134,0.04)',
                                }}
                              >
                                ↗ {t('linkLabel')}
                              </a>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Filter sidebar ───────────────────────────────────────────── */}
          <aside
            style={{
              width: 300,
              flexShrink: 0,
              background: 'rgba(244,243,236,0.92)',
              backdropFilter: 'blur(12px)',
              borderLeft: '1px solid rgba(20,40,90,0.1)',
              overflowY: 'auto',
              padding: '20px 16px',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <span style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#2f4486',
              }}>
                {t('filters')}
              </span>
              <button
                onClick={resetFilters}
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 9,
                  color: '#6b7596',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  textDecoration: 'underline',
                }}
              >
                {t('reset')}
              </button>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <div style={{
                flex: 1,
                background: '#fff',
                border: '1px solid rgba(20,40,90,0.1)',
                borderRadius: 10,
                padding: '10px 12px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'Roboto Slab, Georgia, serif',
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#15203f',
                  lineHeight: 1,
                  marginBottom: 4,
                }}>
                  {visible.length}
                </div>
                <div style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 9,
                  color: '#6b7596',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {t('statPublications')}
                </div>
              </div>
              <div style={{
                flex: 1,
                background: '#fff',
                border: '1px solid rgba(20,40,90,0.1)',
                borderRadius: 10,
                padding: '10px 12px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'Roboto Slab, Georgia, serif',
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#1e9b7e',
                  lineHeight: 1,
                  marginBottom: 4,
                }}>
                  {visibleAuthorCount}
                </div>
                <div style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: 9,
                  color: '#6b7596',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  {t('statAuthors')}
                </div>
              </div>
            </div>

            {/* ── Type filter ───────────────────────────────────────────── */}
            <FilterSection label={t('type')}>
              {allTypes.map(tp => {
                const badge = TYPE_BADGE[tp]
                const active = fType.has(tp)
                const cnt = countForType(tp)
                return (
                  <FilterBtn
                    key={tp}
                    active={active}
                    count={cnt}
                    onClick={() => toggleType(tp)}
                    dot={badge.color}
                  >
                    {t(typeI18nKey(tp) as Parameters<typeof t>[0])}
                  </FilterBtn>
                )
              })}
            </FilterSection>

            {/* ── Author filter ─────────────────────────────────────────── */}
            <FilterSection label={t('author')}>
              {allAuthors.map(a => {
                const active = fAuthor.has(a)
                const cnt = countForAuthor(a)
                return (
                  <FilterBtn
                    key={a}
                    active={active}
                    count={cnt}
                    onClick={() => toggleAuthor(a)}
                    initials={initials(a)}
                  >
                    {a}
                  </FilterBtn>
                )
              })}
            </FilterSection>

            {/* ── Year filter ───────────────────────────────────────────── */}
            <FilterSection label={t('year')}>
              {allYears.map(yr => {
                const active = fYear.has(yr)
                const cnt = countForYear(yr)
                return (
                  <FilterBtn
                    key={yr}
                    active={active}
                    count={cnt}
                    onClick={() => toggleYear(yr)}
                  >
                    {yr}
                  </FilterBtn>
                )
              })}
            </FilterSection>
          </aside>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {isMember && (
        <AddPublicationModal
          open={addOpen}
          lab={lab}
          onClose={() => setAddOpen(false)}
          onCreated={handleCreated}
        />
      )}

      <ConfirmDialog
        open={!!pendingDeleteId}
        message={t('confirmDelete')}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        danger
        confirmLabel={t('deleteConfirmLabel')}
      />
    </>
  )
}

// ─── FilterSection ──────────────────────────────────────────────────────────

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#2f4486',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  )
}

// ─── FilterBtn ───────────────────────────────────────────────────────────────

type FilterBtnProps = {
  active: boolean
  count: number
  onClick: () => void
  children: React.ReactNode
  dot?: string
  initials?: string
}

function FilterBtn({ active, count, onClick, children, dot, initials: ini }: FilterBtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px',
        borderRadius: 6,
        border: active ? '1.5px solid #2f4486' : '1px solid rgba(20,40,90,0.12)',
        background: active ? 'rgba(47,68,134,0.12)' : 'rgba(20,30,60,0.03)',
        color: active ? '#2f4486' : '#5a6486',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 11,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.1s',
        width: '100%',
      }}
    >
      {/* Dot (type) */}
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dot,
          flexShrink: 0,
        }} />
      )}
      {/* Initials bubble (author) */}
      {ini && (
        <span style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#2f4486',
          color: '#fff',
          fontSize: 8,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {ini}
        </span>
      )}
      <span style={{ flex: 1 }}>{children}</span>
      <span style={{
        fontSize: 9,
        color: active ? '#2f4486' : '#9fb2e6',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {count}
      </span>
    </button>
  )
}
