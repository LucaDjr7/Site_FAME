import { redirect } from 'next/navigation'
import { requireAdmin, AuthError } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { isAssistantEnabled } from '@/lib/rag/settings'
import { AssistantDashboard } from '@/components/admin/AssistantDashboard'
import { LogsDashboard, type Unanswered, type Flagged } from '@/components/admin/LogsDashboard'

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
  const { data: unanswered } = await service.from('chat_unanswered')
    .select('id, question, lang, resolved, created_at').order('created_at', { ascending: false }).limit(200)
  const { data: flagged } = await service.from('chat_flagged')
    .select('id, question, reason, created_at').order('created_at', { ascending: false }).limit(200)

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-12">
      <AssistantDashboard
        enabled={enabled}
        usage={{ month, estCost: Number(usageRow?.est_cost_usd ?? 0), budget }}
      />
      <LogsDashboard
        unanswered={(unanswered ?? []) as Unanswered[]}
        flagged={(flagged ?? []) as Flagged[]}
      />
    </main>
  )
}
