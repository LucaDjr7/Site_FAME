import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavMenu } from './NavMenu'
import { AuthButton } from './AuthButton'

type Props = { locale: string; lab: string }

export async function TopBar({ locale, lab }: Props) {
  const session = await getSession()
  const member = session?.member ?? null
  const t = await getTranslations('nav')

  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-12 flex items-center justify-between px-6"
      style={{ background: 'rgba(21,32,63,0.88)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <Link href={`/${locale}`} className="font-serif font-bold text-fame-text-light text-lg tracking-wide hover:text-white transition-colors">
        FAME
        <span className="text-fame-text-muted font-mono text-xs ml-2 normal-case tracking-normal">
          {lab === 'paris' ? t('labParis') : t('labMontreal')}
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <NavMenu locale={locale} lab={lab} member={member} />
        <AuthButton member={member} locale={locale} />
      </div>
    </header>
  )
}
