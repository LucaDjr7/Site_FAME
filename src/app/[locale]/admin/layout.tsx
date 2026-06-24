import { TopBar } from '@/components/layout/TopBar'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params

  return (
    <>
      <TopBar locale={locale} />
      <main className="pt-12 bg-fame-sand-bg">{children}</main>
    </>
  )
}
