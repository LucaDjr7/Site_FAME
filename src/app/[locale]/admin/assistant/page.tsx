import { redirect } from 'next/navigation'
import { requireAdmin, AuthError } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { isAssistantEnabled } from '@/lib/rag/settings'
import { AssistantDashboard } from '@/components/admin/AssistantDashboard'

export default async function AssistantAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AuthError) redirect(`/${locale}/auth/login`)
    throw e
  }

  const service = await createServiceClient()
  const month = new Date().toISOString().slice(0, 7)
  const budget = Number(process.env.ASSISTANT_MONTHLY_BUDGET_USD ?? '50')
  const { data: usageRow } = await service.from('chat_usage').select('est_cost_usd').eq('month', month).maybeSingle()
  const enabled = await isAssistantEnabled({ service })

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <AssistantDashboard
        enabled={enabled}
        usage={{ month, estCost: Number(usageRow?.est_cost_usd ?? 0), budget }}
        logsHref={`/${locale}/admin/logs`}
      />
    </main>
  )
}
