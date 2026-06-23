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

export function NavMenu({ locale, lab, member }: Props) {
  const [open, setOpen] = useState(false)
  const t = useTranslations('nav')
  const base = `/${locale}/${lab}`

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-fame-text-muted hover:text-fame-text-light font-mono text-xs uppercase tracking-widest"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
        </svg>
        {t('menu')}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 bg-fame-navy/95 backdrop-blur rounded-lg shadow-2xl border border-white/10 py-2 min-w-[160px]">
            {NAV_LINKS.map(({ key, href }) => (
              <Link
                key={key}
                href={`${base}${href}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-fame-text-muted hover:text-fame-text-light hover:bg-white/5 font-mono"
              >
                {t(key)}
              </Link>
            ))}
            {member && (
              <>
                <hr className="border-white/10 my-1" />
                {MEMBER_LINKS.map(({ key, href }) => (
                  <Link
                    key={key}
                    href={`${base}${href}`}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-fame-text-muted hover:text-fame-text-light hover:bg-white/5 font-mono"
                  >
                    {t(key)}
                  </Link>
                ))}
              </>
            )}
            {member?.is_admin && (
              <>
                <hr className="border-white/10 my-1" />
                <Link
                  href={`/${locale}/admin/proposals`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-fame-gold hover:text-fame-gold/80 hover:bg-white/5 font-mono"
                >
                  {t('admin') ?? 'Admin'}
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
