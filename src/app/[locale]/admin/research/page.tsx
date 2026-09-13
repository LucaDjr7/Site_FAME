import { redirect } from 'next/navigation'
import { requireAdmin, AuthError } from '@/lib/auth'
import { AdminResearchClient } from '@/components/admin/AdminResearchClient'

type Props = { params: Promise<{ locale: string }> }

// Admin-only (RSC enforces the role; middleware only gates auth).
export default async function AdminResearchPage({ params }: Props) {
  const { locale } = await params
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AuthError) redirect(`/${locale}/auth/login`)
    throw e
  }
  return <AdminResearchClient />
}
