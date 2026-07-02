import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { createServerClient as createSupabaseMiddlewareClient } from '@supabase/ssr'

const intlMiddleware = createMiddleware(routing)

const MEMBER_ONLY_PATHS = ['/data', '/prompts']
const ADMIN_ONLY_PATHS = ['/admin']

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // API routes must never be touched by the intl middleware: it would 307-
  // redirect /api/* to /en/api/* (a non-existent route), breaking every fetch.
  // Short-circuit BEFORE invoking next-intl. (The matcher also excludes /api,
  // this is belt-and-suspenders.)
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Strip locale prefix to check path
  const pathWithoutLocale = pathname.replace(/^\/(en|fr)/, '')

  // Run intl middleware (handles locale redirect / cookie) for page routes
  const intlResponse = intlMiddleware(request)

  // Check member-only pages. ATTENTION : `/data` et `/prompts` sont des routes
  // LAB-PRÉFIXÉES (`/[lab]/data`), donc pathWithoutLocale vaut `/paris/data` — un
  // match sur le préfixe `/data` échouait silencieusement (gate mort). On teste
  // donc aussi le dernier segment. `/admin` n'est PAS lab-préfixé (préfixe direct).
  const segments = pathWithoutLocale.split('/').filter(Boolean)
  const memberSegs = MEMBER_ONLY_PATHS.map(p => p.replace(/^\//, ''))
  const needsMember = segments.some(s => memberSegs.includes(s))
  const needsAdmin = ADMIN_ONLY_PATHS.some(p => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + '/'))

  // NOTE: this is an authentication gate only (is the caller logged in?).
  // It does NOT verify is_admin at the edge — RLS blocks reading members
  // without the service-role key, which must not live in edge middleware.
  // Admin-role enforcement MUST happen in each /admin page's RSC via requireAdmin().
  if (needsMember || needsAdmin) {
    // Build response to set cookies from supabase-ssr
    const response = intlResponse ?? NextResponse.next()
    const supabase = createSupabaseMiddlewareClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cs) => cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const locale = pathname.split('/')[1] ?? 'en'
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url))
    }
  }

  return intlResponse ?? NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
