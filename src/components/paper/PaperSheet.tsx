'use client'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import type { Subject, MemberRef, SubjectStatus } from '@/types'

const STATUS_COLOR: Record<SubjectStatus, string> = { active: '#1e9b7e', 'on-hold': '#e8b149', done: '#2f4486' }

type Props = { subject: Subject; members: MemberRef[]; labName: string; locale: string }

export function PaperSheet({ subject, members, labName, locale }: Props) {
  const t = useTranslations('paper')
  const ts = useTranslations('lab')
  const statusColor = STATUS_COLOR[subject.statut] ?? '#5768ac'
  const dateLabel = new Date(subject.created_at).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const authors = subject.auteurs
    .map(id => members.find(m => m.id === id))
    .filter((m): m is MemberRef => !!m)

  return (
    <article className="paper-scroll" style={{
      position: 'absolute', left: '50%', top: 118, bottom: 124, transform: 'translateX(-50%)',
      width: 'min(500px,40vw)', pointerEvents: 'auto', overflowY: 'auto', background: '#fbf9f3',
      borderRadius: 8, boxShadow: '0 40px 90px -24px rgba(0,5,30,0.85), inset 0 0 0 1px rgba(0,0,0,0.05)',
      color: '#15203f',
    }}>
      <div style={{ padding: '30px 34px 38px' }}>
        {/* Kicker + status pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6b7596' }}>
            {subject.kicker ? `${subject.kicker} · ${labName}` : labName}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.06em', color: '#43507a', background: '#eceadf', padding: '5px 10px', borderRadius: 20 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
            {ts(`status.${subject.statut}`)}
          </span>
        </div>

        {/* Title */}
        <h1 style={{ margin: '0 0 14px', fontSize: 27, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.01em' }}>{subject.titre}</h1>

        {/* Authors + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          {authors.map((a, i) => (
            <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Avatar name={`${a.prenom} ${a.nom}`} photoUrl={a.photo_url} size={24} />
              <span style={{ fontSize: 12, color: '#2a3457' }}>
                {a.prenom} {a.nom}{i === 0 ? ` · ${t('responsible')}` : ''}
              </span>
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6b7596' }}>{dateLabel}</span>
        </div>

        <Section heading={t('context')} body={subject.context} />

        {/* Figure placeholder */}
        <div style={{ borderRadius: 6, background: 'repeating-linear-gradient(135deg,#e4e2d6 0 9px,#eceadf 9px 18px)', height: 150, position: 'relative', marginBottom: 8 }} />
        <p style={{ margin: '0 0 20px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: '#9a9684' }}>{t('figurePlaceholder')}</p>

        <Section heading={t('method')} body={subject.method} />
        <Section heading={t('results')} body={subject.results} />

        {/* Keywords */}
        {subject.keywords.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {subject.keywords.map((k, i) => (
              <span key={i} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: '0.04em', color: '#43507a', background: '#eceadf', border: '1px solid rgba(0,0,0,0.05)', padding: '5px 10px', borderRadius: 6 }}>{k}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function Section({ heading, body }: { heading: string; body: string }) {
  if (!body) return null
  return (
    <>
      <h2 style={{ margin: '0 0 6px', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5b7cf0', fontWeight: 600 }}>{heading}</h2>
      <p style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.6, color: '#2a3457', whiteSpace: 'pre-wrap' }}>{body}</p>
    </>
  )
}
