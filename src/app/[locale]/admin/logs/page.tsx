import { redirect } from 'next/navigation'
import { requireAdmin, AuthError } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { LogsDashboard } from '@/components/admin/LogsDashboard'

export default async function LogsAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  try { await requireAdmin() } catch (e) {
    if (e instanceof AuthError) redirect(`/${locale}/auth/login`)
    throw e
  }
  const service = await createServiceClient()
  const { data: unanswered } = await service.from('chat_unanswered')
    .select('id, question, lang, resolved, created_at').order('created_at', { ascending: false }).limit(200)
  const { data: flagged } = await service.from('chat_flagged')
    .select('id, question, reason, created_at').order('created_at', { ascending: false }).limit(200)

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <LogsDashboard
        unanswered={(unanswered ?? []) as never}
        flagged={(flagged ?? []) as never}
        backHref={`/${locale}/admin/assistant`}
      />
    </main>
  )
}
