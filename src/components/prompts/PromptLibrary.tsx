'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import { PromptCard } from './PromptCard'
import type { Lab, Prompt, PromptTarget } from '@/types'
import { LAB_LABELS } from '@/lib/constants'
import { TARGET_META, TARGET_ORDER } from './prompt-shared'

// Intentional variance: 3-gradient composite with specific position offsets (at 26%/78%/92%).
const PAGE_BG =
  'radial-gradient(110% 80% at 26% 8%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%), ' +
  'radial-gradient(120% 110% at 78% 112%, rgba(113,120,132,0.2) 0%, rgba(113,120,132,0) 60%), ' +
  'radial-gradient(140% 120% at 92% 44%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%), ' +
  '#F9F9FA'

type Props = { lab: Lab }

export function PromptLibrary({ lab }: Props) {
  const t = useTranslations('prompts')
  const { addToast } = useToast()

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<PromptTarget | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null)

  const labLabel = LAB_LABELS[lab] ?? lab

  useEffect(() => {
    let cancelled = false
    async function fetchPrompts() {
      setLoading(true)
      try {
        const res = await fetch(`/api/prompts?lab=${lab}`)
        if (res.ok && !cancelled) {
          const data: Prompt[] = await res.json()
          setPrompts(data)
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchPrompts()
    return () => { cancelled = true }
  }, [lab, reloadKey])

  function reload() { setReloadKey(k => k + 1) }

  const filtered = filter ? prompts.filter(p => p.type_cible === filter) : prompts

  async function addPrompt() {
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        labo: lab,
        titre: t('untitled'),
        type_cible: filter ?? 'subject',
        texte: '',
      }),
    })
    if (res.ok) {
      const created: Prompt = await res.json()
      setPrompts(prev => [created, ...prev])
      setNewlyCreatedId(created.id)
    }
  }

  function handleSaved(updated: Prompt) {
    setNewlyCreatedId(null)
    setPrompts(prev => prev.map(p => (p.id === updated.id ? updated : p)))
    addToast(t('saved'), 'success')
  }

  function handleDeleted(id: string) {
    setNewlyCreatedId(null)
    setPrompts(prev => prev.filter(p => p.id !== id))
    addToast(t('deleted'), 'info')
    reload()
  }

  function handleCopied() {
    addToast(t('copied'), 'success')
  }

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '9px 11px',
    borderRadius: 9,
    border: active ? '1px solid #2f4486' : '1px solid rgba(20,40,90,0.12)',
    background: active ? 'rgba(47,68,134,0.12)' : 'rgba(20,30,60,0.03)',
    color: active ? '#2f4486' : '#5a6486',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    fontSize: 12.5,
  })

  return (
    <div className="font-serif"
      style={{
        minHeight: 'calc(100vh - 6rem)',
        display: 'flex',
        flexDirection: 'column',
        color: '#18244c',
        background: PAGE_BG,
      }}
    >
      {/* ── Secondary toolbar ─────────────────────────────────────── */}
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
          <div className="font-mono text-fame-text-muted"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            {t('kicker', { lab: labLabel })}
          </div>
          <h1 className="font-serif text-fame-text-dark"
            style={{
              fontSize: 20,
              fontWeight: 600,
              margin: 0,
            }}
          >
            {t('title')}
          </h1>
        </div>

        {/* Right: new prompt button */}
        <button className="font-mono bg-fame-blue text-fame-text-light"
          onClick={addPrompt}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            fontSize: 10,
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >
          + {t('newPrompt')}
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Type sidebar ─────────────────────────────────────── */}
        <div
          style={{
            width: 248,
            flexShrink: 0,
            overflowY: 'auto',
            borderRight: '1px solid rgba(20,40,90,0.1)',
            background: 'rgba(244,243,236,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '22px 18px 26px',
          }}
        >
          <h2 className="font-serif text-fame-blue"
            style={{
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              margin: '0 0 4px',
            }}
          >
            {t('sidebarTitle')}
          </h2>
          <p className="font-serif"
            style={{
              fontSize: 12,
              color: '#5b668c',
              margin: '0 0 16px',
              lineHeight: 1.55,
            }}
          >
            {t('sidebarHelp')}
          </p>

          {/* All types button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              className="font-serif"
              onClick={() => setFilter(null)}
              style={filterBtnStyle(filter === null)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {t('allTypes')}
              </span>
              <span className="font-mono" style={{  fontSize: 10, opacity: 0.7 }}>
                {prompts.length}
              </span>
            </button>

            {TARGET_ORDER.map(tc => {
              const meta = TARGET_META[tc]
              const count = prompts.filter(p => p.type_cible === tc).length
              const active = filter === tc
              return (
                <button
                  key={tc}
                  className="font-serif"
                  onClick={() => setFilter(active ? null : tc)}
                  style={filterBtnStyle(active)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: meta.color,
                        flexShrink: 0,
                      }}
                    />
                    {t(`types.${meta.i18nKey}` as Parameters<typeof t>[0])}
                  </span>
                  <span className="font-mono" style={{  fontSize: 10, opacity: 0.7 }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Prompt list ────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '34px 44px 90px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              maxWidth: 780,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {/* Intro row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <p className="font-mono"
                style={{
                  margin: 0,
                  maxWidth: 560,
                  fontSize: 13.5,
                  color: '#43507a',
                  lineHeight: 1.6,
                }}
              >
                {t('subtitle')}{' '}
                <code
                  style={{
                    fontSize: 12,
                    background: 'rgba(47,68,134,0.08)',
                    padding: '1px 5px',
                    borderRadius: 4,
                  }}
                >
                  {'{{…}}'}
                </code>{' '}
                {t('subtitleEnd')}
              </p>
              <span className="font-mono"
                style={{
                  fontSize: 11,
                  color: '#6b7596',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {filtered.length} {t('countSuffix')}
              </span>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="font-mono text-fame-text-muted"
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  paddingTop: 40,
                }}
              >
                {t('loading')}
              </div>
            ) : filtered.length === 0 ? (
              /* Empty state */
              <div className="font-serif"
                style={{
                  border: '1px dashed rgba(20,40,90,0.2)',
                  borderRadius: 12,
                  padding: '46px 20px',
                  textAlign: 'center',
                  color: '#6b7596',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {t('noPrompts')}
              </div>
            ) : (
              /* Prompt cards */
              filtered.map(p => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  onSaved={handleSaved}
                  onDeleted={handleDeleted}
                  onCopied={handleCopied}
                  startEditing={p.id === newlyCreatedId}
                />
              ))
            )}

            {/* Add a prompt button at bottom */}
            {!loading && (
              <button className="font-mono text-fame-blue"
                onClick={addPrompt}
                style={{
                  border: '1px dashed rgba(47,68,134,0.4)',
                  background: 'rgba(47,68,134,0.04)',
                  borderRadius: 10,
                  padding: '11px 18px',
                  fontSize: 12,
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                  letterSpacing: '0.04em',
                }}
              >
                + {t('addPrompt')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
