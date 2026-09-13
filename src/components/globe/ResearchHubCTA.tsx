'use client'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

export function ResearchHubCTA() {
  const t = useTranslations('home')
  const locale = useLocale()
  return (
    <Link
      href={`/${locale}/research`}
      className="font-mono"
      style={{
        position: 'fixed',
        left: '26px',
        bottom: '32px',
        zIndex: 1100,
        fontSize: '11.5px',
        letterSpacing: '0.04em',
        color: '#eef3ff',
        background: 'rgba(31,46,92,0.6)',
        border: '1px solid rgba(150,180,255,0.22)',
        borderRadius: '20px',
        padding: '8px 16px',
        textDecoration: 'none',
        backdropFilter: 'blur(6px)',
      }}
    >
      {t('researchCta')}
    </Link>
  )
}
