import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env (URL / ANON_KEY)')
  const cookieStore = await cookies()
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Service-role client — MUST bypass RLS. It must NOT carry the request's auth
// cookies: @supabase/ssr would otherwise set Authorization to the caller's JWT,
// which overrides the service-role key and makes PostgREST run queries as the
// `authenticated` role under RLS (returning 0 rows for protected reads). A plain
// cookie-less client keeps Authorization = service-role key on every request.
export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env (URL / SERVICE_ROLE_KEY)')
  return createSupabaseClient(
    url,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
