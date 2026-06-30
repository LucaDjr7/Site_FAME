'use client'
import React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import type { Lab, Subject, MemberRef, SubjectStatus, InheritableField } from '@/types'
import { localizedSubject, toLocale2 } from '@/lib/subjects/localized'
import { resolveInheritance } from '@/lib/subjects/inheritance'
import { vitrineHeadline, vitrineSubtitle, vitrineNumber } from '@/lib/subjects/vitrine'

const STATUS_COLOR: Record<SubjectStatus, string> = { active: '#1e9b7e', 'on-hold': '#e8b149', done: '#2f4486' }

type Props = { subject: Subject; members: MemberRef[]; labName: string; locale: string; lab?: Lab; byId?: Map<string, Subject> }

export function PaperSheet({ subject, members, labName, locale, lab, byId = new Map() }: Props) {
  const t = useTranslations('paper')
  const ts = useTranslations('lab')
  const loc = toLocale2(locale)
  const L = resolveInheritance(subject, byId, loc)
  // Helper: return badge element if field is inherited AND mother is in byId.
  function inheritBadge(field: InheritableField) {
    const motherId = subject.inherits?.[field]
    if (!motherId) return null
    const mother = byId.get(motherId)
    if (!mother) return null
    const motherTitle = localizedSubject(mother, loc).titre
    const href = lab ? `/${locale}/${lab}/paper/${motherId}` : undefined
    const badge = (
      <span className="font-mono" style={{
        fontSize: 9, color: '#7e95d6', background: 'rgba(47,68,134,0.08)',
        borderRadius: 5, padding: '2px 7px', display: 'inline-block', marginTop: 2,
      }}>
        {t('relations.inheritedFrom', { title: motherTitle })}
      </span>
    )
    return href ? <Link href={href} style={{ textDecoration: 'none' }}>{badge}</Link> : badge
  }

  const dotColor = STATUS_COLOR[subject.statut] ?? '#5768ac'
  const dateLabel = new Date(subject.created_at).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const authors = subject.auteurs
    .map(id => members.find(m => m.id === id))
    .filter((m): m is MemberRef => !!m)

  const headline = vitrineHeadline({ question: L.question, titre: L.titre })
  const subtitle = vitrineSubtitle({ question: L.question, titre: L.titre })
  const number = vitrineNumber(subject.ordre)

  return (
    <article className="paper-scroll" style={{
      position: 'absolute', left: '50%', top: 118, bottom: 124, transform: 'translateX(-50%)',
      width: 'clamp(420px, calc(100vw - 700px), 880px)', pointerEvents: 'auto', overflowY: 'auto',
      background: '#faf9f5', color: '#16263f', borderRadius: 8,
      boxShadow: '0 40px 90px -24px rgba(0,5,30,0.85), inset 0 0 0 1px rgba(0,0,0,0.05)',
    }}>
      {/* ── Héros clair ── */}
      <div style={{ padding: '32px 34px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#3a5a8a', fontWeight: 500 }}>
              {L.kicker || labName}
            </span>
            {inheritBadge('kicker')}
          </span>
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#b3ada0', flexShrink: 0 }}>
            {ts('vitrine.ficheLabel')}
          </span>
        </div>

        <div style={{ height: 1, background: '#16263f', margin: '16px 0 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <span className="font-serif" style={{ fontWeight: 300, fontSize: 72, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 4 }}>
            {number}
          </span>
          <div className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a9a395', textAlign: 'right', marginTop: 8, lineHeight: 1.7 }}>
            {subject.periode && <div>{subject.periode}{inheritBadge('periode')}</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, color: dotColor }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
              {ts(`status.${subject.statut}`)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9a9485', marginBottom: 10 }}>
            {ts('vitrine.theQuestion')}
          </div>
          <h1 className="font-serif" style={{ margin: 0, fontWeight: 700, fontSize: 38, lineHeight: 1.04, letterSpacing: '-0.02em' }}>
            {headline}
          </h1>
          {subtitle && (
            <div className="font-serif" style={{ fontStyle: 'italic', fontSize: 19, color: '#6a7589', marginTop: 12 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* ── Bande navy : accroche ── */}
      {L.accroche && (
        <div style={{ background: '#15203f', padding: '22px 34px' }}>
          <p className="font-serif" style={{ margin: 0, fontStyle: 'italic', fontSize: 19, lineHeight: 1.45, color: '#cdd8ea' }}>
            {L.accroche}
          </p>
        </div>
      )}

      {/* ── Corps clair ── */}
      <div style={{ padding: '24px 34px 38px' }}>
        {/* Auteurs + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingBottom: 18, marginBottom: 20, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          {authors.map((a, i) => (
            <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Avatar name={`${a.prenom} ${a.nom}`} photoUrl={a.photo_url} size={24} />
              <span className="text-fame-text-body" style={{ fontSize: 12 }}>
                {a.prenom} {a.nom}{i === 0 ? ` · ${t('responsible')}` : ''}
              </span>
            </span>
          ))}
          <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7596' }}>{dateLabel}</span>
        </div>

        <Section heading={t('context')} body={L.context} badge={inheritBadge('context')} />

        <Section heading={t('method')} body={L.method} badge={inheritBadge('method')} />
        <Section heading={t('results')} body={L.results} badge={inheritBadge('results')} />

        {/* Mots-clés */}
        {L.keywords.length > 0 && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {L.keywords.map((k, i) => (
                <span className="font-mono" key={i} style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#43507a', background: '#eceadf', border: '1px solid rgba(0,0,0,0.05)', padding: '5px 10px', borderRadius: 6 }}>{k}</span>
              ))}
            </div>
            {inheritBadge('keywords') && (
              <div style={{ marginTop: 5 }}>{inheritBadge('keywords')}</div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function Section({ heading, body, badge }: { heading: string; body: string; badge?: React.ReactNode }) {
  if (!body) return null
  return (
    <>
      <h2 className="font-mono" style={{ margin: '0 0 8px', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5b7cf0', fontWeight: 600 }}>{heading}</h2>
      <p className="text-fame-text-body" style={{ margin: '0 0 6px', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{body}</p>
      {badge && <div style={{ marginBottom: 16 }}>{badge}</div>}
    </>
  )
}
