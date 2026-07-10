import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { appEnv } from '@/lib/env'

const PUBLIC_PATHS = ['/', '/en', '/zh', '/login', '/signup', '/body-assessment', '/body-assessment/insight', '/api/stripe/webhook']

// Once a user has accepted the health disclaimer AND finished onboarding, those
// flags never revert. We cache that fact in a cookie keyed to the user's id so
// subsequent requests skip the per-request `user_profiles` lookup entirely
// (auth.getUser() still runs — that's required). The value is the user id, so a
// stale cookie left behind after logout can't let a *different* user skip the
// gates on a shared browser.
const GATE_COOKIE = 'forma_gate'
const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    appEnv.supabaseUrl(),
    appEnv.supabaseAnonKey(),
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith('/api/stripe/webhook'))

  // API routes do their OWN auth + return JSON. They must never be caught by the
  // page-level gate redirects below — otherwise a fetch() to e.g.
  // /api/disclaimer/accept gets 307'd to the /disclaimer HTML page instead of
  // running, which is exactly what left the disclaimer "Continue" button stuck
  // on "Saving…" (the accept request never reached its handler).
  const isApi = path.startsWith('/api')

  // Not logged in + trying to access a protected *page* → redirect to login.
  // (API routes handle their own 401s, so don't redirect them to HTML.)
  if (!user && !isPublic && !isApi) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Logged in + hitting auth pages → redirect to home
  if (user && (path === '/login' || path === '/signup')) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Fast path: this user has already cleared both gates (cookie matches their
  // id) — skip the DB lookups below entirely.
  const gatesCleared = !!user && request.cookies.get(GATE_COOKIE)?.value === user.id

  // Logged in → enforce health disclaimer acceptance, then onboarding.
  //
  // IMPORTANT: we treat a MISSING profile (null) the same as a profile that
  // hasn't accepted the disclaimer. This covers:
  //   • fresh users whose `user_profiles` row hasn't been created yet
  //   • environments where migration 003_health_disclaimer hasn't run yet
  //   • any query error that causes `.single()` to return null
  //
  // In all these cases the safest behaviour is to send the user to /disclaimer
  // so the gate is never silently bypassed.
  if (user && !gatesCleared && !isApi && !path.startsWith('/disclaimer') && !path.startsWith('/onboarding') && !isPublic) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed, health_disclaimer_accepted_at')
      .eq('id', user.id)
      .single()

    // Missing profile OR disclaimer not yet accepted → gate
    if (!profile || !profile.health_disclaimer_accepted_at) {
      const url = new URL('/disclaimer', request.url)
      url.searchParams.set('next', path)
      return NextResponse.redirect(url)
    }

    // Disclaimer accepted but onboarding not finished → send there next
    if (!profile.onboarding_completed) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    // Both gates cleared — cache it on the response so we can skip this query
    // on subsequent requests until the cookie expires.
    supabaseResponse.cookies.set(GATE_COOKIE, user.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: GATE_COOKIE_MAX_AGE,
    })
  }

  // Logged in, on /onboarding → still enforce the disclaimer gate.
  // Without this a user could bypass /disclaimer by navigating to /onboarding directly.
  if (user && !gatesCleared && path.startsWith('/onboarding')) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('health_disclaimer_accepted_at')
      .eq('id', user.id)
      .single()

    // Same logic: null profile == needs disclaimer
    if (!profile || !profile.health_disclaimer_accepted_at) {
      const url = new URL('/disclaimer', request.url)
      url.searchParams.set('next', path)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
