'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import type { Member } from '@/types'

const NAV_LINKS = [
  { key: 'subjects', href: '' },
  { key: 'tasks', href: '/tasks' },
  { key: 'publications', href: '/publications' },
  { key: 'team', href: '/team' },
  { key: 'propose', href: '/propose' },
] as const

const MEMBER_LINKS = [
  { key: 'data', href: '/data' },
  { key: 'prompts', href: '/prompts' },
] as const

type Props = { locale: string; lab: string; member: Member | null }

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  textDecoration: 'none',
  padding: '9px 11px',
  borderRadius: 9,
  fontSize: 13.5,
}

export function NavMenu({ locale, lab, member }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('nav')
  const base = `/${locale}/${lab}`

  return (
    <div className="relative">
      <button className="font-mono text-fame-text-light"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="nav-menu"
        aria-haspopup="menu"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(31,46,92,0.6)',
          border: '1px solid rgba(150,180,255,0.22)',
          borderRadius: 9,
          padding: '7px 14px',
          cursor: 'pointer',
          fontSize: 12,
          letterSpacing: '0.12em',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ width: 15, height: 1.5, background: '#cdd8f5' }} />
          <span style={{ width: 15, height: 1.5, background: '#cdd8f5' }} />
          <span style={{ width: 15, height: 1.5, background: '#cdd8f5' }} />
        </span>
        {t('menu')}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            id="nav-menu"
            className="absolute right-0 z-40 bg-fame-sand"
            style={{
              top: 'calc(100% + 12px)',
              width: 236,
              border: '1px solid rgba(20,40,90,0.12)',
              borderRadius: 13,
              boxShadow: '0 30px 70px -24px rgba(0,5,30,0.62)',
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div className="font-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#9a9684',
                padding: '8px 10px 6px',
              }}
            >
              {t('navigation')}
            </div>
            {NAV_LINKS.map(({ key, href }) => (
              <Link
                key={key}
                href={`${base}${href}`}
                onClick={() => setOpen(false)}
                className="font-serif hover:bg-[rgba(47,68,134,0.08)] transition-colors text-fame-text-body"
                style={itemStyle}
              >
                {t(key)}
              </Link>
            ))}
            {member && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(20,40,90,0.08)', margin: '4px 0' }} />
                {MEMBER_LINKS.map(({ key, href }) => (
                  <Link
                    key={key}
                    href={`${base}${href}`}
                    onClick={() => setOpen(false)}
                    className="font-serif hover:bg-[rgba(47,68,134,0.08)] transition-colors text-fame-text-body"
                    style={itemStyle}
                  >
                    {t(key)}
                  </Link>
                ))}
              </>
            )}
            {member?.is_admin && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(20,40,90,0.08)', margin: '4px 0' }} />
                <Link
                  href={`/${locale}/admin/proposals`}
                  onClick={() => setOpen(false)}
                  className="font-serif hover:bg-[rgba(232,177,73,0.12)] transition-colors"
                  style={{ ...itemStyle, color: '#b88c30', fontWeight: 600 }}
                >
                  {t('admin')}
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
