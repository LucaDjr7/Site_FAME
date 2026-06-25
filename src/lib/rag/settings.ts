import { createServiceClient } from '@/lib/supabase/server'
type SupabaseLike = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function isAssistantEnabled(deps: { service?: SupabaseLike } = {}): Promise<boolean> {
  if (process.env.ASSISTANT_DISABLED === '1' || process.env.ASSISTANT_DISABLED === 'true') return false
  const service = deps.service ?? (await createServiceClient())
  const { data } = await service.from('app_settings').select('value').eq('key', 'assistant_enabled').maybeSingle()
  if (data == null) return true // défaut : activé
  return data.value !== false
}
