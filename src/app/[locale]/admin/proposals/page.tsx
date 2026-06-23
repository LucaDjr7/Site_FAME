import { redirect } from 'next/navigation'
import { requireAdmin, AuthError } from '@/lib/auth'
import { AdminProposalsClient } from '@/components/admin/AdminProposalsClient'

type Props = { params: Promise<{ locale: string }> }

// Admin-only (RSC enforces the role; middleware only gates auth).
export default async function AdminProposalsPage({ params }: Props) {
  const { locale } = await params
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AuthError) redirect(`/${locale}/auth/login`)
    throw e
  }
  return <AdminProposalsClient />
}
