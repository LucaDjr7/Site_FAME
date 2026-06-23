import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'

const LABS = ['paris', 'montreal'] as const

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string; lab: string }>
}

export default async function LabLayout({ children, params }: Props) {
  const { locale, lab } = await params
  if (!LABS.includes(lab as typeof LABS[number])) notFound()

  return (
    <>
      <TopBar locale={locale} lab={lab} />
      <main className="pt-12 min-h-screen bg-fame-sand-bg">
        {children}
      </main>
    </>
  )
}
