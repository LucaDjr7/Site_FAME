import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { requireAdmin } from '@/lib/auth'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params

  try {
    await requireAdmin()
  } catch {
    notFound()
  }

  return (
    <>
      <TopBar locale={locale} />
      <main className="pt-12 bg-fame-sand-bg">{children}</main>
    </>
  )
}
