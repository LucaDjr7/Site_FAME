import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { createServerClient as createSupabaseMiddlewareClient } from '@supabase/ssr'

const intlMiddleware = createMiddleware(routing)

const MEMBER_ONLY_PATHS = ['/data', '/prompts']
const ADMIN_ONLY_PATHS = ['/admin']

export async function middleware(request: NextRequest) {
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

  // Check member-only pages
  const matchesPath = (paths: string[]) =>
    paths.some(p => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + '/'))
  const needsMember = matchesPath(MEMBER_ONLY_PATHS)
  const needsAdmin = matchesPath(ADMIN_ONLY_PATHS)

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
