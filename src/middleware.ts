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

  // Strip locale prefix to check path
  const pathWithoutLocale = pathname.replace(/^\/(en|fr)/, '')
  const isApiRoute = pathname.startsWith('/api/')

  // Run intl middleware first (handles locale redirect / cookie)
  const intlResponse = intlMiddleware(request)

  // For API routes and static assets, skip auth checks
  if (isApiRoute) return intlResponse ?? NextResponse.next()

  // Check member-only pages
  const needsMember = MEMBER_ONLY_PATHS.some(p => pathWithoutLocale.includes(p))
  const needsAdmin = ADMIN_ONLY_PATHS.some(p => pathWithoutLocale.includes(p))

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
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
