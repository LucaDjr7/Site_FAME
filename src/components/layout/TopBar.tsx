import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavMenu } from './NavMenu'
import { AuthButton } from './AuthButton'

type Props = { locale: string; lab?: string }

export async function TopBar({ locale, lab }: Props) {
  const session = await getSession()
  const member = session?.member ?? null
  const t = await getTranslations('nav')

  // Admin pages have no lab segment in the URL — fall back to the caller's
  // own lab so the nav menu still links back into their lab's pages.
  const resolvedLab = lab ?? member?.labo ?? 'paris'

  return (
    <header className="fixed top-0 left-0 right-0 z-20 h-12 flex items-center justify-between px-6 bg-fame-navy"
      style={{ borderBottom: '1px solid rgba(20,40,90,0.4)' }}>
      <Link href={`/${locale}`} className="group font-serif font-bold text-white text-lg tracking-wide transition-colors">
        FAME
        <span className="text-slate-200 group-hover:text-white font-mono text-xs ml-2 normal-case tracking-normal transition-colors">
          {resolvedLab === 'paris' ? t('labParis') : t('labMontreal')}
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <NavMenu locale={locale} lab={resolvedLab} member={member} />
        <AuthButton member={member} locale={locale} />
      </div>
    </header>
  )
}
