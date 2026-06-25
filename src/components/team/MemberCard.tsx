'use client'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import type { Member } from '@/types'
import { ROLE_KEY } from './team-shared'

type Props = {
  member: Member
  isSelf: boolean
  isAdmin: boolean
  editMode: boolean
  onEdit: (member: Member) => void
  onDelete: (id: string) => void
}

export function MemberCard({ member, isSelf, isAdmin, editMode, onEdit, onDelete }: Props) {
  const t = useTranslations('team')

  return (
    <div
      style={{
        position: 'relative',
        background: '#fbf9f3',
        borderRadius: 11,
        boxShadow: '0 16px 36px -22px rgba(0,5,30,0.42), inset 0 0 0 1px rgba(0,0,0,0.05)',
        padding: '22px 18px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {/* Delete × button (admin only, not self) */}
      {editMode && isAdmin && !isSelf && (
        <button
          onClick={() => onDelete(member.id)}
          aria-label={t('removeLabel')}
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
            lineHeight: '1',
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

      {/* Edit pencil button (self or admin) */}
      {(isSelf || isAdmin) && (
        <button
          onClick={() => onEdit(member)}
          aria-label={t('editTitle')}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            width: 24,
            height: 24,
            borderRadius: 5,
            border: '1px solid rgba(20,40,90,0.15)',
            background: 'rgba(255,255,255,0.7)',
            color: '#6b7596',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontFamily: 'system-ui, sans-serif',
            transition: 'background 0.12s, color 0.12s',
            zIndex: 2,
          }}
          onMouseEnter={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.background = '#2f4486'
            btn.style.color = '#fff'
            btn.style.borderColor = 'transparent'
          }}
          onMouseLeave={e => {
            const btn = e.currentTarget as HTMLButtonElement
            btn.style.background = 'rgba(255,255,255,0.7)'
            btn.style.color = '#6b7596'
            btn.style.borderColor = 'rgba(20,40,90,0.15)'
          }}
        >
          ✎
        </button>
      )}

      {/* Avatar */}
      <div style={{ marginBottom: 13 }}>
        <Avatar
          name={`${member.prenom} ${member.nom}`}
          photoUrl={member.photo_url}
          size={88}
        />
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#15203f',
          fontFamily: 'Roboto Slab, Georgia, serif',
          marginBottom: 4,
        }}
      >
        {member.prenom} {member.nom}
      </div>

      {/* Role label */}
      <div
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#2f4486',
          marginBottom: 4,
        }}
      >
        {t(ROLE_KEY[member.role] as Parameters<typeof t>[0])}
      </div>

      {/* Domain chips */}
      {member.domaines.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 4,
            margin: '12px 0 13px',
          }}
        >
          {member.domaines.map((d, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 9.5,
                color: '#43507a',
                background: '#eceadf',
                border: '1px solid rgba(0,0,0,0.05)',
                padding: '4px 8px',
                borderRadius: 5,
              }}
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Spacer to push email to bottom */}
      <div style={{ flex: 1 }} />

      {/* Email */}
      <a
        href={`mailto:${member.email}`}
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 10.5,
          color: '#6b7596',
          textDecoration: 'none',
          borderTop: '1px solid rgba(20,40,90,0.08)',
          paddingTop: 11,
          marginTop: member.domaines.length === 0 ? 13 : 0,
          display: 'block',
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        ✉ {member.email}
      </a>
    </div>
  )
}
