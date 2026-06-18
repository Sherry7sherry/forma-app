import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { appEnv } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    appEnv.supabaseUrl(),
    appEnv.supabaseAnonKey(),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
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

/**
 * True service-role admin client — RLS is genuinely bypassed.
 *
 * IMPORTANT: this must NOT be built with @supabase/ssr + the request cookies.
 * That path reads the user's auth cookie and sends the *user's* JWT in the
 * Authorization header, so PostgREST runs the query as the `authenticated`
 * role and RLS still applies — defeating the point. `user_profiles` has no
 * INSERT policy, so an RLS-bound upsert there can silently fail. Using the raw
 * supabase-js client with no session attaches only the service-role key, which
 * is what actually bypasses RLS.
 *
 * Server-only — never import this into client code (the key must never ship to
 * the browser).
 */
export function createAdminClient() {
  return createSupabaseClient(
    appEnv.supabaseUrl(),
    appEnv.supabaseServiceRoleKey(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Back-compat alias — prefer createAdminClient().
export const createServiceClient = createAdminClient
