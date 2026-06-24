import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { TopBar } from '@/components/layout/TopBar'

const LABS = ['paris', 'montreal'] as const

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string; lab: string }>
}

export default async function LabLayout({ children, params }: Props) {
  const { locale, lab } = await params
  if (!LABS.includes(lab as typeof LABS[number])) notFound()

  const t = await getTranslations({ locale, namespace: 'privacy' })

  return (
    <>
      <TopBar locale={locale} lab={lab} />
      <main className="pt-12 bg-fame-sand-bg">
        {children}
      </main>
      <footer className="h-12 flex items-center justify-center border-t border-fame-ecru bg-fame-sand-bg">
        <Link
          href={`/${locale}/privacy`}
          className="text-[10px] font-mono text-fame-text-muted hover:text-fame-blue"
        >
          {t('link')}
        </Link>
      </footer>
    </>
  )
}
