'use client'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { MemberCard } from './MemberCard'
import { InviteModal } from './InviteModal'
import { EditMemberModal } from './EditMemberModal'
import type { Lab, Member, Role } from '@/types'
import { LAB_LABELS } from '@/lib/constants'

type Props = {
  lab: Lab
  currentMemberId: string | null
  isAdmin: boolean
}

const ROLE_ORDER: Role[] = ['direction', 'researcher', 'phd', 'engineering']

const ROLE_GROUP_KEY: Record<Role, string> = {
  direction: 'roles.direction',
  researcher: 'roles.researchers',
  phd: 'roles.phd',
  engineering: 'roles.engineering',
}

// Intentional variance: 3-gradient composite with specific position offsets (at 22%/80%/90%).
const PAGE_BG =
  'radial-gradient(110% 80% at 22% 8%, rgba(181,157,135,0.28) 0%, rgba(181,157,135,0) 52%), ' +
  'radial-gradient(120% 110% at 80% 112%, rgba(113,120,132,0.2) 0%, rgba(113,120,132,0) 60%), ' +
  'radial-gradient(140% 120% at 90% 44%, rgba(47,68,134,0.08) 0%, rgba(47,68,134,0) 55%), ' +
  '#F9F9FA'

export function MemberGrid({ lab, currentMemberId, isAdmin }: Props) {
  const t = useTranslations('team')
  const { addToast } = useToast()

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Member | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const isMember = !!currentMemberId

  function reload() { setReloadKey(k => k + 1) }

  useEffect(() => {
    let cancelled = false
    async function fetchMembers() {
      setLoading(true)
      try {
        const res = await fetch(`/api/members?lab=${lab}`)
        if (res.ok) {
          const data: Member[] = await res.json()
          if (!cancelled) setMembers(data)
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchMembers()
    return () => { cancelled = true }
  }, [lab, reloadKey])

  // Group members by role
  const grouped = ROLE_ORDER
    .map(role => ({
      role,
      items: members.filter(m => m.role === role),
    }))
    .filter(g => g.items.length > 0)

  async function handleDelete() {
    if (!pendingDeleteId) return
    const id = pendingDeleteId
    setPendingDeleteId(null)
    const res = await fetch(`/api/members/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers(prev => prev.filter(m => m.id !== id))
      addToast(t('deleted'), 'info')
    } else {
      addToast(t('errorGeneric'), 'error')
    }
  }

  function handleSaved(updated: Member) {
    setMembers(prev => prev.map(m => (m.id === updated.id ? updated : m)))
    addToast(t('saved'), 'success')
  }

  const labLabel = LAB_LABELS[lab] ?? lab

  return (
    <>
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

          {/* Right: member count + controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="font-mono"
              style={{
                fontSize: 11,
                color: '#6b7596',
              }}
            >
              {members.length} {t('members')}
            </span>

            {/* Edit-mode toggle (members only) */}
            {isMember && (
              // border width is non-standard 1.5px (active) vs 1px (inactive) — kept inline;
              // charted #e8b149 replaced by currentColor via text-fame-gold when active.
              <button className={`font-mono ${editMode ? 'text-fame-gold' : ''}`}
                onClick={() => setEditMode(v => !v)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: editMode ? '1.5px solid currentColor' : '1px solid rgba(20,40,90,0.15)',
                  background: editMode ? 'rgba(232,177,73,0.12)' : 'rgba(255,255,255,0.6)',
                  color: editMode ? undefined : '#6b7596',
                  fontSize: 10,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  transition: 'all 0.14s',
                }}
              >
                {editMode ? t('editModeOn') : t('editMode')}
              </button>
            )}

            {/* Invite button (admin only) */}
            {isAdmin && (
              <button className="font-mono bg-fame-blue text-fame-text-light"
                onClick={() => setInviteOpen(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 10,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                + {t('inviteByEmail')}
              </button>
            )}
          </div>
        </div>

        {/* ── Body scroll area ───────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px' }}>
          {loading ? (
            <div className="font-mono text-fame-text-muted"
              style={{
                fontSize: 12,
                textAlign: 'center',
                paddingTop: 60,
              }}
            >
              {t('loading')}
            </div>
          ) : members.length === 0 ? (
            <div className="font-mono text-fame-text-muted"
              style={{
                fontSize: 13,
                textAlign: 'center',
                paddingTop: 60,
              }}
            >
              {t('empty')}
            </div>
          ) : (
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              {grouped.map(({ role, items }) => (
                <div key={role} style={{ marginBottom: 40 }}>
                  {/* Role group header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <span className="font-mono text-fame-blue"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.18em',
                        flexShrink: 0,
                      }}
                    >
                      {t(ROLE_GROUP_KEY[role] as Parameters<typeof t>[0])}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background: 'rgba(20,40,90,0.12)',
                      }}
                    />
                    <span className="font-mono"
                      style={{
                        fontSize: 10,
                        color: '#6b7596',
                        letterSpacing: '0.1em',
                        flexShrink: 0,
                      }}
                    >
                      {items.length}
                    </span>
                  </div>

                  {/* Member grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(212px, 1fr))',
                      gap: 18,
                    }}
                  >
                    {items.map(member => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        isSelf={member.id === currentMemberId}
                        isAdmin={isAdmin}
                        editMode={editMode}
                        onEdit={m => setEditTarget(m)}
                        onDelete={id => setPendingDeleteId(id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────── */}
      {isAdmin && (
        <InviteModal
          open={inviteOpen}
          lab={lab}
          onClose={() => setInviteOpen(false)}
          onInvited={reload}
        />
      )}

      <EditMemberModal
        open={!!editTarget}
        member={editTarget}
        isAdmin={isAdmin}
        onClose={() => setEditTarget(null)}
        onSaved={updated => {
          handleSaved(updated)
          setEditTarget(null)
        }}
      />

      <ConfirmDialog
        open={!!pendingDeleteId}
        message={t('confirmRemove')}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        danger
        confirmLabel={t('removeLabel')}
      />
    </>
  )
}
